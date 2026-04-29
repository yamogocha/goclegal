import { getCustomer } from "./index";

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
    clicks: number;
    impressions: number;
    maturity: "learning" | "mature";
  }[];
  adGroups: any[];
  errors: string[];
};

type NumericLike = number | string | null | undefined;
const toNumber = (v: NumericLike): number => Number(v ?? 0);

// guardrails
const DAILY_CAP_MICROS = 25 * 1_000_000;
const MIN_BUDGET_MICROS = 5 * 1_000_000;
const CHANGE_THRESHOLD = 0.05;

// maturity (aligned with search pipeline)
const isMature = (impr: number, clicks: number) =>
  impr >= 1000 || clicks >= 20;

// low data guard (new)
const isLowData = (spend: number, clicks: number) =>
  clicks < 5 && spend < 20 * 1_000_000;

const getErrorMessage = (err: unknown): string => {
  if (!err) return "unknown";
  if (err instanceof Error) return err.message;
  try { return JSON.stringify(err); } catch { return "parse_failed"; }
};

export async function runBudgetControl(): Promise<BudgetControlResult> {
  const errors: string[] = [];
  const campaignResults: BudgetControlResult["campaigns"] = [];

  let updatedBudgets = 0;

  try {
    const customer = getCustomer();

    // campaigns
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

    // 7d perf
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

        const mature = isMature(impressions, clicks);
        const lowData = isLowData(spend, clicks);

        let adjusted = current;
        let reason = "no_change";

        // =========================
        // LEARNING: DO NOTHING
        // =========================
        if (!mature || lowData) {
          reason = "learning_phase";
        }

        // =========================
        // MATURE: LIGHT WEIGHTING
        // =========================
        else {
          let weight = 1 / activeCount;

          if (conversions > 0) {
            weight = conversions;
          } else if (clicks > 0) {
            weight = clicks;
          }

          // normalize weight
          weight = Math.min(weight, 1);

          // small controlled adjustment only
          adjusted = current * (0.9 + 0.2 * weight);
          reason = "performance_adjust";
        }

        const finalBudget = Math.min(
          Math.max(Math.floor(adjusted), MIN_BUDGET_MICROS),
          DAILY_CAP_MICROS
        );

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
            clicks,
            impressions,
            maturity: mature ? "mature" : "learning",
          });
        } else {
          campaignResults.push({
            id,
            action: "SKIPPED",
            before: current,
            after: finalBudget,
            reason,
            spend,
            clicks,
            impressions,
            maturity: mature ? "mature" : "learning",
          });
        }
      } catch (err) {
        errors.push(`campaign:${id}:${getErrorMessage(err)}`);
      }
    }

    return {
      success: errors.length === 0,
      summary: {
        activeCampaigns: active.length,
        pausedCampaigns: paused.length,
        updatedBudgets,
        pausedAdGroups: 0,
      },
      campaigns: campaignResults,
      adGroups: [],
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