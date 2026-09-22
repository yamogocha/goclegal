import { getCustomer } from "./index";
import { getErrorMessage, notifySlackError, notifySlackResult } from "@/lib/error";

type BudgetControlResult = {
  ok: boolean;
  success: boolean;
  durationMs: number;
  summary: {
    activeCampaigns: number;
    pausedCampaigns: number;
    updatedBudgets: number;
    pausedAdGroups: number;
    totalSpend: number;
    totalConversions: number;
    costPerLead: number;
    qualifiedLeads: number;
    qualifiedLeadCPA: number;
  };
  campaigns: {
    id: string | number;
    action: "UPDATED" | "SKIPPED";
    before: number;
    after: number;
    reason: string;
    spend: number;
    clicks: number;
    impressions: number;
    conversions: number;
    costPerConversion: number | null;
    conversionRate: number;
    maturity: "learning" | "mature";
  }[];
  topSearchTerms?: { term: string; clicks: number; conversions: number; spend: number }[];
  adGroups: any[];
  errors: { type: string; err: string }[];
};

type NumericLike = number | string | null | undefined;
const toNumber = (v: NumericLike): number => Number(v ?? 0);
const microsToDollars = (v: number) => v / 1e6;
const DAILY_CAP_MICROS = 25 * 1e6;
const MIN_BUDGET_MICROS = 5 * 1e6;
const CHANGE_THRESHOLD = 0.05;
const isMature = (impr: number, clicks: number) => impr >= 1000 || clicks >= 20;
const isLowData = (spend: number, clicks: number) => clicks < 5 && spend < 20 * 1e6;

// Only these search intents qualify as auto-injury traffic.
const AUTO_INJURY_PATTERNS = [
  /\bcar accident\b/, /\bcar wreck\b/, /\bcar crash\b/, /\bauto accident\b/, /\bauto wreck\b/, /\bauto crash\b/,
  /\bautomobile accident\b/, /\bautomobile wreck\b/, /\bautomobile crash\b/, /\bvehicle accident\b/, /\bvehicle wreck\b/,
  /\bvehicle crash\b/, /\bmotor vehicle accident\b/, /\bmotor vehicle wreck\b/, /\bmotor vehicle crash\b/,
  /\bcollision\b/, /\btraffic accident\b/, /\btraffic collision\b/,
];

// Normalize search terms before classification.
const normalize = (s: string) => s.toLowerCase().replace(/[^\w\s]/g, "").trim();
const isAutoInjurySearch = (s: string) => AUTO_INJURY_PATTERNS.some(p => p.test(normalize(s)));

export async function runBudgetControl(): Promise<BudgetControlResult> {
  const start = Date.now();
  const results: BudgetControlResult = {
    ok: true,
    success: true,
    durationMs: 0,
    summary: { activeCampaigns: 0, pausedCampaigns: 0, updatedBudgets: 0, pausedAdGroups: 0, totalSpend: 0, totalConversions: 0, costPerLead: 0, qualifiedLeads: 0, qualifiedLeadCPA: 0 },
    campaigns: [],
    adGroups: [],
    errors: [],
  };

  try {
    const customer = getCustomer();

    console.log("Query #1");
    const campaigns = await customer.query(`
      SELECT campaign.id, campaign.status, campaign_budget.resource_name, campaign_budget.amount_micros
      FROM campaign
    `);
    console.log("Query #1 OK");

    const active = campaigns.filter((c: any) => c.campaign?.status === 2);
    const paused = campaigns.filter((c: any) => c.campaign?.status === 3);
    results.summary.activeCampaigns = active.length;
    results.summary.pausedCampaigns = paused.length;

    console.log("Query #2");
    const perf30d = await customer.query(`
      SELECT campaign.id, campaign.name, metrics.cost_micros, metrics.clicks, metrics.impressions, metrics.conversions, metrics.all_conversions, metrics.cost_per_conversion, metrics.conversions_value
      FROM campaign
      WHERE campaign.status = 'ENABLED' AND segments.date DURING LAST_30_DAYS
    `);
    console.log("Query #2 OK");

    // Pull search terms by campaign so invalid conversions can be removed from qualified lead metrics.
    console.log("Query #3");
    const searchTerms = await customer.query(`
      SELECT campaign.id, search_term_view.search_term, metrics.clicks, metrics.cost_micros, metrics.conversions, metrics.all_conversions
      FROM search_term_view
      WHERE segments.date DURING LAST_30_DAYS
    `);
    console.log("Query #3 OK");

    const topConverters = searchTerms
      .filter((x: any) => toNumber(x.metrics?.conversions) > 0)
      .sort((a: any, b: any) => toNumber(b.metrics?.conversions) - toNumber(a.metrics?.conversions))
      .slice(0, 10);

    results.topSearchTerms = topConverters.map((x: any) => ({
      term: x.search_term_view?.search_term,
      clicks: toNumber(x.metrics?.clicks),
      conversions: toNumber(x.metrics?.conversions),
      spend: microsToDollars(toNumber(x.metrics?.cost_micros)),
    }));

    // Only auto-injury search terms count as qualified conversions.
    const qualifiedConversionsByCampaign = new Map<string, number>();
    for (const x of searchTerms as any[]) {
      const campaignId = x.campaign?.id != null ? String(x.campaign.id) : null;
      const term = x.search_term_view?.search_term || "";
      if (!campaignId || !isAutoInjurySearch(term)) continue;
      qualifiedConversionsByCampaign.set(campaignId, (qualifiedConversionsByCampaign.get(campaignId) || 0) + toNumber(x.metrics?.conversions));
    }

    const perfMap = new Map<string, any>();
    for (const p of perf30d as any[]) if (p.campaign?.id != null) perfMap.set(String(p.campaign.id), p);

    const activeCount = active.length || 1;

    for (const c of active) {
      const id = c.campaign?.id != null ? String(c.campaign.id) : null;
      const resourceName = c.campaign_budget?.resource_name;
      if (!id || !resourceName) continue;

      try {
        const current = toNumber(c.campaign_budget?.amount_micros);
        const perf = perfMap.get(id);
        const spend = toNumber(perf?.metrics?.cost_micros);
        const clicks = toNumber(perf?.metrics?.clicks);
        const impressions = toNumber(perf?.metrics?.impressions);
        const conversions = toNumber(perf?.metrics?.conversions);
        const qualifiedConversions = qualifiedConversionsByCampaign.get(id) || 0;
        const costPerConversion = conversions ? microsToDollars(spend) / conversions : null;
        const conversionRate = clicks ? conversions / clicks : 0;
        const mature = isMature(impressions, clicks);
        const lowData = isLowData(spend, clicks);

        let adjusted = current;
        let reason = "no_change";

        if (!mature || lowData) reason = "learning_phase";
        else if (spend > 100 * 1e6 && qualifiedConversions === 0) reason = "zero_qualified_conversions";
        else {
          let weight = qualifiedConversions || clicks || (1 / activeCount);
          weight = Math.min(weight, 1);
          adjusted = current * (0.9 + 0.2 * weight);
          reason = "performance_adjust";
        }

        const finalBudget = Math.min(Math.max(Math.floor(adjusted), MIN_BUDGET_MICROS), DAILY_CAP_MICROS);
        const shouldUpdate = current > 0 && Math.abs(finalBudget - current) / current > CHANGE_THRESHOLD;

        if (shouldUpdate) {
          await customer.campaignBudgets.update([{ resource_name: resourceName, amount_micros: finalBudget }]);
          results.summary.updatedBudgets++;
          results.campaigns.push({ id, action: "UPDATED", before: current, after: finalBudget, reason, spend, clicks, impressions, conversions, costPerConversion, conversionRate, maturity: mature ? "mature" : "learning" });
        } else {
          results.campaigns.push({ id, action: "SKIPPED", before: current, after: finalBudget, reason, spend, clicks, impressions, conversions, costPerConversion, conversionRate, maturity: mature ? "mature" : "learning" });
        }
      } catch (err) {
        results.ok = false;
        const error = getErrorMessage(err);
        results.errors.push({ type: `campaign:${id}`, err: error });
        await notifySlackError("Google Ads Budget Control Campaign Failure", err, { campaignId: id });
      }
    }

    const totalSpend = results.campaigns.reduce((s, c) => s + c.spend, 0);
    const totalConversions = results.campaigns.reduce((s, c) => s + c.conversions, 0);
    const qualifiedLeads = results.campaigns.reduce((s, c) => s + (qualifiedConversionsByCampaign.get(String(c.id)) || 0), 0);

    results.summary.totalSpend = microsToDollars(totalSpend);
    results.summary.totalConversions = totalConversions;
    results.summary.qualifiedLeads = qualifiedLeads;
    results.summary.qualifiedLeadCPA = qualifiedLeads > 0 ? microsToDollars(totalSpend) / qualifiedLeads : 0;
    results.summary.costPerLead = qualifiedLeads > 0 ? microsToDollars(totalSpend) / qualifiedLeads : 0;

    results.ok = results.errors.length === 0;
    results.success = results.ok;
    results.durationMs = Date.now() - start;

    await notifySlackResult("Google Ads Budget Control Result", results);
    return results;
  } catch (err) {
    await notifySlackError("Google Ads Budget Control Fatal Failure", err);
    throw err;
  }
}