import { getCustomer } from "./index";

import {
  getErrorMessage,
  notifySlackError,
  notifySlackResult,
} from "@/lib";

type BudgetControlResult = {
  ok: boolean;

  // backward compatibility
  success: boolean;

  durationMs: number;

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

  errors: {
    type: string;
    err: string;
  }[];
};

type NumericLike =
  | number
  | string
  | null
  | undefined;

const toNumber = (
  v: NumericLike
): number =>
  Number(v ?? 0);

// =========================
// GUARDRAILS
// =========================

const DAILY_CAP_MICROS =
  25 * 1_000_000;

const MIN_BUDGET_MICROS =
  5 * 1_000_000;

const CHANGE_THRESHOLD =
  0.05;

// =========================
// MATURITY
// =========================

const isMature = (
  impr: number,
  clicks: number
) =>
  impr >= 1000 ||
  clicks >= 20;

const isLowData = (
  spend: number,
  clicks: number
) =>
  clicks < 5 &&
  spend < 20 * 1_000_000;

// =========================
// MAIN
// =========================

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
    },

    campaigns: [],

    adGroups: [],

    errors: [],
  };

  try {
    const customer =
      getCustomer();

    // =========================
    // CAMPAIGNS
    // =========================

    const campaigns =
      await customer.query(`
        SELECT
          campaign.id,
          campaign.status,
          campaign_budget.resource_name,
          campaign_budget.amount_micros
        FROM campaign
      `);

    const active =
      campaigns.filter(
        (c: any) =>
          c.campaign?.status === 2
      );

    const paused =
      campaigns.filter(
        (c: any) =>
          c.campaign?.status === 3
      );

    results.summary.activeCampaigns =
      active.length;

    results.summary.pausedCampaigns =
      paused.length;

    // =========================
    // PERFORMANCE
    // =========================

    const perf7d =
      await customer.query(`
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

    const perfMap =
      new Map<string, any>();

    for (const p of perf7d as any[]) {
      if (
        p.campaign?.id != null
      ) {
        perfMap.set(
          String(
            p.campaign.id
          ),
          p
        );
      }
    }

    const activeCount =
      active.length || 1;

    // =========================
    // BUDGET CONTROL
    // =========================

    for (const c of active) {
      const id =
        c.campaign?.id != null
          ? String(
            c.campaign.id
          )
          : null;

      const resourceName =
        c.campaign_budget
          ?.resource_name;

      if (
        !id ||
        !resourceName
      ) {
        continue;
      }

      try {
        const current =
          toNumber(
            c.campaign_budget
              ?.amount_micros
          );

        const perf =
          perfMap.get(id);

        const spend =
          toNumber(
            perf?.metrics
              ?.cost_micros
          );

        const clicks =
          toNumber(
            perf?.metrics?.clicks
          );

        const impressions =
          toNumber(
            perf?.metrics
              ?.impressions
          );

        const conversions =
          toNumber(
            perf?.metrics
              ?.conversions
          );

        const mature =
          isMature(
            impressions,
            clicks
          );

        const lowData =
          isLowData(
            spend,
            clicks
          );

        let adjusted =
          current;

        let reason =
          "no_change";

        // =========================
        // LEARNING / LOW DATA
        // =========================

        if (
          !mature ||
          lowData
        ) {
          reason =
            "learning_phase";
        }

        // =========================
        // MATURE CAMPAIGNS
        // =========================

        else {
          let weight =
            1 / activeCount;

          if (
            conversions > 0
          ) {
            weight =
              conversions;
          } else if (
            clicks > 0
          ) {
            weight = clicks;
          }

          // normalize
          weight = Math.min(
            weight,
            1
          );

          adjusted =
            current *
            (0.9 +
              0.2 * weight);

          reason =
            "performance_adjust";
        }

        const finalBudget =
          Math.min(
            Math.max(
              Math.floor(
                adjusted
              ),
              MIN_BUDGET_MICROS
            ),
            DAILY_CAP_MICROS
          );

        const shouldUpdate =
          current > 0 &&
          Math.abs(
            finalBudget -
            current
          ) /
          current >
          CHANGE_THRESHOLD;

        if (shouldUpdate) {
          await customer.campaignBudgets.update(
            [
              {
                resource_name:
                  resourceName,

                amount_micros:
                  finalBudget,
              },
            ]
          );

          results.summary.updatedBudgets++;

          results.campaigns.push(
            {
              id,

              action:
                "UPDATED",

              before:
                current,

              after:
                finalBudget,

              reason,

              spend,

              clicks,

              impressions,

              maturity:
                mature
                  ? "mature"
                  : "learning",
            }
          );
        } else {
          results.campaigns.push(
            {
              id,

              action:
                "SKIPPED",

              before:
                current,

              after:
                finalBudget,

              reason,

              spend,

              clicks,

              impressions,

              maturity:
                mature
                  ? "mature"
                  : "learning",
            }
          );
        }
      } catch (err) {
        results.ok = false;
        results.success = false;

        const error =
          getErrorMessage(err);

        results.errors.push({
          type: `campaign:${id}`,
          err: error,
        });

        await notifySlackError(
          "Google Ads Budget Control Campaign Failure",
          err,
          {
            campaignId: id,
          }
        );
      }
    }

    // =========================
    // FINALIZE
    // =========================

    results.ok =
      results.errors.length === 0;

    results.success =
      results.ok;

    results.durationMs =
      Date.now() - start;

    await notifySlackResult(
      "Google Ads Budget Control Result",
      results
    );

    return results;
  } catch (err) {
    await notifySlackError(
      "Google Ads Budget Control Fatal Failure",
      err
    );

    throw err;
  }
}