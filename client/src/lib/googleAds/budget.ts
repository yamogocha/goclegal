import { getCustomer } from "./index";
import { getErrorMessage, notifySlackError, notifySlackResult } from "@/lib";
import util from "node:util";


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
    qualifiedLeads: number,
    qualifiedLeadCPA: number,
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
  topSearchTerms?: {
    term: string;
    clicks: number;
    conversions: number;
    spend: number;
  }[];
  adGroups: any[];
  errors: {
    type: string;
    err: string;
  }[];
};

type NumericLike = number | string | null | undefined;
const toNumber = (v: NumericLike): number => Number(v ?? 0);
const microsToDollars = (v: number) => v / 1e6;

// GUARDRAILS
const DAILY_CAP_MICROS = 25 * 1000000;
const MIN_BUDGET_MICROS = 5 * 1000000;
const CHANGE_THRESHOLD = 0.05;

// MATURITY
const isMature = (impr: number, clicks: number) => impr >= 1000 || clicks >= 20;
const isLowData = (spend: number, clicks: number) => clicks < 5 && spend < 20 * 1000000;

// MAIN
export async function runBudgetControl(): Promise<BudgetControlResult> {
  const start = Date.now();
  const results: BudgetControlResult =
  {
    ok: true,
    // backward compatibility
    success: true,
    durationMs: 0,
    summary: {
      activeCampaigns: 0,
      pausedCampaigns: 0,
      updatedBudgets: 0,
      pausedAdGroups: 0,
      totalSpend: 0,
      totalConversions: 0,
      costPerLead: 0,
      qualifiedLeads: 0,
      qualifiedLeadCPA: 0,
    },
    campaigns: [],
    adGroups: [],
    errors: [],
  };

  try {
    console.log({
      GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID?.length,
      GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET?.length,
      GOOGLE_REFRESH_TOKEN: process.env.GOOGLE_REFRESH_TOKEN?.length,
    });
    const customer = getCustomer();
    // 1. Load campaigns and current budget settings
    const campaigns = await customer.query(`
        SELECT
          campaign.id,
          campaign.status,
          campaign_budget.resource_name,
          campaign_budget.amount_micros
        FROM campaign
      `);

    const active = campaigns.filter((c: any) => c.campaign?.status === 2);
    const paused = campaigns.filter((c: any) => c.campaign?.status === 3);

    results.summary.activeCampaigns = active.length;
    results.summary.pausedCampaigns = paused.length;
    // 2. Load 30-day performance metrics (spend, clicks, conversions)
    const perf30d = await customer.query(`
      SELECT
        campaign.id,
        campaign.name,
        metrics.cost_micros,
        metrics.clicks,
        metrics.impressions,
        metrics.conversions,
        metrics.all_conversions,
        metrics.cost_per_conversion,
        metrics.conversions_value
      FROM campaign
      WHERE campaign.status = 'ENABLED'
        AND segments.date DURING LAST_30_DAYS
    `);
    // 3. Load search terms to see what actually generated conversions
    const searchTerms = await customer.query(`
    SELECT
      search_term_view.search_term,
      metrics.clicks,
      metrics.cost_micros,
      metrics.conversions,
      metrics.all_conversions
    FROM search_term_view
    WHERE segments.date DURING LAST_30_DAYS
  `);

    const topConverters = searchTerms
      .filter((x: any) => toNumber(x.metrics?.conversions) > 0)
      .sort((a: any, b: any) => toNumber(b.metrics?.conversions) - toNumber(a.metrics?.conversions))
      .slice(0, 10);

    results.topSearchTerms = topConverters.map((x: any) => ({
      term: x.search_term_view?.search_term, clicks: toNumber(x.metrics?.clicks),
      conversions: toNumber(x.metrics?.conversions),
      spend: toNumber(x.metrics?.cost_micros) / 1e6
    }));
    // 4. Build campaign lookup for fast metric access
    const perfMap = new Map<string, any>();
    for (const p of perf30d as any[]) { if (p.campaign?.id != null) { perfMap.set(String(p.campaign.id), p) } }
    const activeCount = active.length || 1;

    // 5. Evaluate each campaign and decide whether budget should change
    for (const c of active) {
      const id = c.campaign?.id != null ? String(c.campaign.id) : null;
      const resourceName = c.campaign_budget?.resource_name;

      if (!id || !resourceName) { continue }

      try {
        // 5a. Gather campaign metrics and calculate lead performance
        const current = toNumber(c.campaign_budget?.amount_micros);
        const perf = perfMap.get(id);
        const spend = toNumber(perf?.metrics?.cost_micros);
        const clicks = toNumber(perf?.metrics?.clicks);
        const impressions = toNumber(perf?.metrics?.impressions);
        const conversions = toNumber(perf?.metrics?.conversions);
        const costPerConversion = conversions ? microsToDollars(spend) / conversions : null;
        const conversionRate = clicks ? conversions / clicks : 0;
        // 5b. Determine whether campaign has enough data to trust decisions
        const mature = isMature(impressions, clicks);
        const lowData = isLowData(spend, clicks);
        // 5c. Decide whether budget should increase, decrease, or stay flat
        let adjusted = current;
        let reason = "no_change";

        if (!mature || lowData) { reason = "learning_phase" }
        else if (spend > 100 * 1e6 && conversions === 0) { reason = "zero_conversions" }
        else {
          let weight = conversions || clicks || (1 / activeCount);
          weight = Math.min(weight, 1);
          adjusted = current * (0.9 + 0.2 * weight);
          reason = "performance_adjust";
        }
        // 5d. Apply guardrails and update budget if change is meaningful
        const finalBudget = Math.min(Math.max(Math.floor(adjusted), MIN_BUDGET_MICROS), DAILY_CAP_MICROS);
        const shouldUpdate = current > 0 && Math.abs(finalBudget - current) / current > CHANGE_THRESHOLD;
        // 5e. Record results for Slack reporting
        if (shouldUpdate) {
          await customer.campaignBudgets.update([{ resource_name: resourceName, amount_micros: finalBudget }]);
          results.summary.updatedBudgets++;
          results.campaigns.push({ id, action: "UPDATED", before: current, after: finalBudget, reason, spend, clicks, impressions, conversions, costPerConversion, conversionRate, maturity: mature ? "mature" : "learning" });
        } else {
          results.campaigns.push({ id, action: "SKIPPED", before: current, after: finalBudget, reason, spend, clicks, impressions, conversions, costPerConversion, conversionRate, maturity: mature ? "mature" : "learning" });
        }
      } catch (err) {
        results.ok = false;
        results.success = false;
        const error = getErrorMessage(err);
        results.errors.push({ type: `campaign:${id}`, err: error });
        await notifySlackError("Google Ads Budget Control Campaign Failure", err, { campaignId: id });
      }
    }
    // 6. Build account-level summary metrics
    const totalSpend = results.campaigns.reduce((s, c) => s + c.spend, 0);
    const totalConversions = results.campaigns.reduce((s, c) => s + c.conversions, 0);
    results.summary.totalSpend = microsToDollars(totalSpend);
    results.summary.totalConversions = totalConversions;
    // Placeholder until CRM/offline imports exist
    results.summary.qualifiedLeads = totalConversions;
    results.summary.qualifiedLeadCPA = totalConversions > 0 ? microsToDollars(totalSpend) / totalConversions : 0;
    results.summary.costPerLead = totalConversions > 0 ? microsToDollars(totalSpend) / totalConversions : 0;

    // FINALIZE
    results.ok = results.errors.length === 0;
    results.success = results.ok;
    results.durationMs = Date.now() - start;
    // 7. Send budget and lead quality report to Slack
    // await notifySlackResult("Google Ads Budget Control Result", results);
    return results;
  } catch (err) {
    // await notifySlackError("Google Ads Budget Control Fatal Failure", err);
    console.error("========== FULL ERROR ==========");
    console.error(util.inspect(err, {
      depth: null,
      colors: false,
      showHidden: true,
    }));

    console.error("========== PROPERTIES ==========");
    console.error("name:", err?.name);
    console.error("message:", err?.message);
    console.error("code:", err?.code);
    console.error("cause:", err?.cause);
    console.error("stack:", err?.stack);

    if (err?.response) {
      console.error("response:", util.inspect(err.response, { depth: null }));
    }
    throw err;
  }
}