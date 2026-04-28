import { getCustomer } from "./index";

// // types
type BudgetControlResult = {
  success: boolean;
  summary: {
    activeCampaigns: number;
    pausedCampaigns: number;
    updatedBudgets: number;
    pausedAdGroups: number;
  };
  campaigns: {
    id: string | number;
    action: "UPDATED" | "SKIPPED";
    before: number;
    after: number;
    reason: string;
    spend: number;
  }[];
  adGroups: {
    id: string | number | undefined;
    action: "PAUSED" | "SKIPPED";
    reason: string;
    ctr: number;
    conversions: number;
    impressions: number;
    clicks: number;
  }[];
  errors: string[];
};

type NumericLike = number | string | null | undefined;

const toNumber = (v: NumericLike): number => Number(v ?? 0);

// // guardrails
const DAILY_CAP_MICROS = 25 * 1_000_000;
const MIN_BUDGET_MICROS = 5 * 1_000_000;
const MIN_SPEND_THRESHOLD = 5 * 1_000_000;
const REALLOCATION_FACTOR = 0.5;
const CHANGE_THRESHOLD = 0.05;
const MIN_IMPRESSIONS_IDLE = 200;

const getErrorMessage = (err: unknown): string => {
  if (!err) return "unknown_error";
  if (err instanceof Error) return err.message;

  if (typeof err === "object") {
    const e = err as any;

    if (typeof e.message === "string") return e.message;

    if (Array.isArray(e.errors)) {
      return e.errors
        .map((sub: any) => {
          const code = sub?.error_code
            ? Object.values(sub.error_code).join("_")
            : "unknown_code";
          return `${code}:${sub.message || "no_message"}`;
        })
        .join(" | ");
    }

    try {
      return JSON.stringify(e);
    } catch {
      return "unserializable_error_object";
    }
  }

  return String(err);
};

// // main
export async function runBudgetControl(): Promise<BudgetControlResult> {
  const errors: string[] = [];
  const campaignResults: BudgetControlResult["campaigns"] = [];
  const adGroupResults: BudgetControlResult["adGroups"] = [];

  let updatedBudgets = 0;
  let pausedAdGroups = 0;

  try {
    const customer = getCustomer();

    // // fetch campaigns
    const campaigns = await customer.query(`
      SELECT
        campaign.id,
        campaign.status,
        campaign_budget.resource_name,
        campaign_budget.amount_micros
      FROM campaign
      WHERE segments.date DURING LAST_30_DAYS
    `);

    const active = campaigns.filter((c: any) => c.campaign?.status === 2);
    const paused = campaigns.filter((c: any) => c.campaign?.status === 3);

    // // fetch 7-day performance trend
    const perf7d = await customer.query(`
      SELECT
        campaign.id,
        metrics.cost_micros,
        metrics.conversions,
        metrics.clicks,
        metrics.impressions
      FROM campaign
      WHERE campaign.status = 'ENABLED'
        AND segments.date DURING LAST_7_DAYS
    `);

    const perfMap = new Map<string, any>();
    for (const p of perf7d as any[]) {
      if (p.campaign?.id != null) {
        perfMap.set(String(p.campaign.id), p);
      }
    }

    // // build reclaim pool from consistently idle campaigns
    let reclaimPool = 0;

    for (const c of active) {
      const id = c.campaign?.id != null ? String(c.campaign.id) : null;
      if (!id) {
        continue;
      }
      const perf = perfMap.get(id);

      const spend = toNumber(perf?.metrics?.cost_micros);
      const impressions = toNumber(perf?.metrics?.impressions);
      const current = toNumber(c.campaign_budget?.amount_micros);

      if (spend === 0 && impressions >= MIN_IMPRESSIONS_IDLE) {
        reclaimPool += current * REALLOCATION_FACTOR;
      }
    }

    const totalConversions = active.reduce(
      (sum: number, c: any) =>
        sum + toNumber(perfMap.get(String(c.campaign.id))?.metrics?.conversions),
      0
    );

    const totalClicks = active.reduce(
      (sum: number, c: any) =>
        sum + toNumber(perfMap.get(String(c.campaign.id))?.metrics?.clicks),
      0
    );

    const activeCount = active.length || 1;

    // // campaign loop
    for (const c of active) {
      const id = c.campaign?.id ?? "unknown";
      const resourceName = c.campaign_budget?.resource_name;

      if (!resourceName) {
        campaignResults.push({
          id,
          action: "SKIPPED",
          before: 0,
          after: 0,
          reason: "missing_budget_resource",
          spend: 0,
        });
        continue;
      }

      try {
        const current = toNumber(c.campaign_budget?.amount_micros);
        const perf = perfMap.get(String(id));

        const spend = toNumber(perf?.metrics?.cost_micros);
        const conversions = toNumber(perf?.metrics?.conversions);
        const clicks = toNumber(perf?.metrics?.clicks);

        let weight = 1 / activeCount;

        if (totalConversions > 0) {
          weight = conversions / totalConversions;
        } else if (totalClicks > 0) {
          weight = clicks / totalClicks;
        }

        let adjusted = current;
        let reason = "no_change";

        // // reward performing campaigns (with threshold)
        if (reclaimPool > 0 && spend >= MIN_SPEND_THRESHOLD) {
          adjusted = current + reclaimPool * weight;
          reason = "reallocation_gain";
        }

        // // reduce idle campaigns (with floor protection)
        if (spend === 0 && current > MIN_BUDGET_MICROS) {
          adjusted = Math.max(
            current * (1 - REALLOCATION_FACTOR),
            MIN_BUDGET_MICROS
          );
          reason = "reallocation_from_idle";
        }

        const finalBudget = Math.min(Math.floor(adjusted), DAILY_CAP_MICROS);

        // // only update meaningful changes
        if (
          current > 0 &&
          Math.abs(finalBudget - current) / current > CHANGE_THRESHOLD
        ) {
          await customer.campaignBudgets.update([
            {
              resource_name: resourceName,
              amount_micros: finalBudget,
            },
          ]);

          updatedBudgets++;

          campaignResults.push({
            id,
            action: "UPDATED",
            before: current,
            after: finalBudget,
            reason,
            spend,
          });
        } else {
          campaignResults.push({
            id,
            action: "SKIPPED",
            before: current,
            after: finalBudget,
            reason,
            spend,
          });
        }
      } catch (err) {
        errors.push(`campaign:${id}:${getErrorMessage(err)}`);
      }
    }

    // // ad group logic unchanged
    try {
      const adGroups = await customer.query(`
        SELECT
          ad_group.id,
          ad_group.resource_name,
          metrics.ctr,
          metrics.conversions,
          metrics.impressions,
          metrics.clicks
        FROM ad_group
        WHERE ad_group.status = 'ENABLED'
          AND segments.date DURING LAST_7_DAYS
      `);

      const MIN_IMPRESSIONS = 100;
      const MIN_CLICKS = 10;

      const eligible = (adGroups as any[]).filter((ag) => {
        const impressions = toNumber(ag.metrics?.impressions);
        const clicks = toNumber(ag.metrics?.clicks);
        return impressions >= MIN_IMPRESSIONS || clicks >= MIN_CLICKS;
      });

      if (eligible.length > 0) {
        const worst = eligible.reduce((min, curr) => {
          const scoreMin =
            toNumber(min.metrics?.ctr) + toNumber(min.metrics?.conversions);
          const scoreCurr =
            toNumber(curr.metrics?.ctr) + toNumber(curr.metrics?.conversions);
          return scoreCurr < scoreMin ? curr : min;
        });

        const ctr = toNumber(worst.metrics?.ctr);
        const conversions = toNumber(worst.metrics?.conversions);
        const impressions = toNumber(worst.metrics?.impressions);
        const clicks = toNumber(worst.metrics?.clicks);

        if (
          worst.ad_group?.resource_name &&
          ctr < 0.01 &&
          conversions === 0
        ) {
          await customer.adGroups.update([
            {
              resource_name: worst.ad_group.resource_name,
              status: "PAUSED",
            },
          ]);

          pausedAdGroups++;

          adGroupResults.push({
            id: worst.ad_group.id,
            action: "PAUSED",
            reason: "low_ctr_no_conversion_mature",
            ctr,
            conversions,
            impressions,
            clicks,
          });
        } else {
          adGroupResults.push({
            id: worst.ad_group?.id,
            action: "SKIPPED",
            reason: "not_bad_enough",
            ctr,
            conversions,
            impressions,
            clicks,
          });
        }
      }
    } catch (err) {
      errors.push(`adgroup:${getErrorMessage(err)}`);
    }

    return {
      success: errors.length === 0,
      summary: {
        activeCampaigns: active.length,
        pausedCampaigns: paused.length,
        updatedBudgets,
        pausedAdGroups,
      },
      campaigns: campaignResults,
      adGroups: adGroupResults,
      errors,
    };
  } catch (err) {
    return {
      success: false,
      summary: {
        activeCampaigns: 0,
        pausedCampaigns: 0,
        updatedBudgets: 0,
        pausedAdGroups: 0,
      },
      campaigns: [],
      adGroups: [],
      errors: [`fatal:${getErrorMessage(err)}`],
    };
  }
}