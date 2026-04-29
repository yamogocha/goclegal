import { getCustomer } from "./index";
import type { resources } from "google-ads-api";

const LOOKBACK = "LAST_30_DAYS";
const MIN_COST = 5;

// maturity
const isMature = (impr: number, clicks: number) =>
  impr >= 1000 || clicks >= 20;

// low data guard
const isLowData = (cost: number, conv: number) =>
  cost < 50 && conv === 0;

// error
function extractError(err: any) {
  if (!err) return "unknown";
  if (err.message) return err.message;
  try { return JSON.stringify(err); } catch { return "parse_failed"; }
}

// hourly performance
async function getPerformance() {
  const rows = await getCustomer().query(`
    SELECT segments.hour, metrics.cost_micros, metrics.conversions, metrics.clicks, metrics.impressions
    FROM campaign
    WHERE segments.date DURING ${LOOKBACK}
  `);

  const map = new Map<number, any>();

  for (const r of rows) {
    const h = r.segments?.hour ?? 0;

    if (!map.has(h)) {
      map.set(h, { hour: h, cost: 0, conv: 0, clicks: 0, impr: 0 });
    }

    const cur = map.get(h);
    cur.cost += (r.metrics?.cost_micros ?? 0) / 1e6;
    cur.conv += r.metrics?.conversions ?? 0;
    cur.clicks += r.metrics?.clicks ?? 0;
    cur.impr += r.metrics?.impressions ?? 0;
  }

  return [...map.values()];
}

// bad hours
function findBadHours(hours: any[]) {
  const totalCost = hours.reduce((s, h) => s + h.cost, 0);
  const totalConv = hours.reduce((s, h) => s + h.conv, 0);

  const avgCPA = totalConv > 0 ? totalCost / totalConv : Infinity;

  const bad = hours
    .filter(h => h.cost >= MIN_COST)
    .filter(h => {
      const cpa = h.conv > 0 ? h.cost / h.conv : Infinity;
      return (
        (h.conv === 0 && h.cost > 15) ||
        (h.conv > 0 && cpa > avgCPA * 2)
      );
    })
    .map(h => h.hour);

  return { bad, avgCPA, totalCost, totalConv };
}

// build schedule blocks
function buildBlocks(badHours: number[]) {
  const badSet = new Set(badHours);

  const good: number[] = [];
  for (let h = 0; h < 24; h++) {
    if (!badSet.has(h)) good.push(h);
  }

  if (!good.length) return [];

  const blocks: { start: number; end: number }[] = [];
  let start = good[0];
  let prev = good[0];

  for (let i = 1; i < good.length; i++) {
    if (good[i] === prev + 1) prev = good[i];
    else {
      blocks.push({ start, end: prev + 1 });
      start = good[i];
      prev = good[i];
    }
  }
  blocks.push({ start, end: prev + 1 });

  return blocks.length > 6
    ? [{ start: blocks[0].start, end: blocks[blocks.length - 1].end }]
    : blocks;
}

// campaign perf
async function getCampaignPerf() {
  const rows = await getCustomer().query(`
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

  return rows.map((r: any) => ({
    id: String(r.campaign.id),
    cost: (r.metrics?.cost_micros ?? 0) / 1e6,
    conv: r.metrics?.conversions ?? 0,
    clicks: r.metrics?.clicks ?? 0,
    impr: r.metrics?.impressions ?? 0,
  }));
}

// schedules
async function removeSchedules(ids: string[], dryRun: boolean) {
  const customer = getCustomer();

  const rows = await customer.query(`
    SELECT campaign_criterion.resource_name
    FROM campaign_criterion
    WHERE campaign.id IN (${ids.join(",")})
      AND campaign_criterion.type = 'AD_SCHEDULE'
  `);

  const names = rows.map((r: any) => r.campaign_criterion?.resource_name).filter(Boolean);

  if (!dryRun && names.length) {
    await customer.campaignCriteria.remove(names);
  }

  return { removed: names.length };
}

async function applySchedules(ids: string[], blocks: any[], dryRun: boolean) {
  const customer = getCustomer();
  const creates: resources.ICampaignCriterion[] = [];

  for (const id of ids) {
    for (const day of ["MONDAY","TUESDAY","WEDNESDAY","THURSDAY","FRIDAY","SATURDAY","SUNDAY"]) {
      for (const b of blocks) {
        creates.push({
          campaign: `customers/${process.env.GOOGLE_ADS_CUSTOMER_ID}/campaigns/${id}`,
          ad_schedule: {
            day_of_week: day as any,
            start_hour: b.start,
            end_hour: b.end,
            start_minute: "ZERO",
            end_minute: "ZERO",
          },
        });
      }
    }
  }

  if (!dryRun && creates.length) {
    await customer.campaignCriteria.create(creates);
  }

  return { applied: creates.length };
}

// keyword promotion
async function promoteKeywords(ids: string[], avgCPA: number, dryRun: boolean) {
  const customer = getCustomer();

  const rows = await customer.query(`
    SELECT
      ad_group_criterion.resource_name,
      ad_group_criterion.status,
      ad_group_criterion.keyword.text,
      metrics.cost_micros,
      metrics.conversions
    FROM keyword_view
    WHERE campaign.id IN (${ids.join(",")})
      AND segments.date DURING ${LOOKBACK}
  `);

  const normalized = rows.map((r: any) => {
    const cost = (r.metrics?.cost_micros ?? 0) / 1e6;
    const conv = r.metrics?.conversions ?? 0;
    const cpa = conv > 0 ? cost / conv : Infinity;

    return {
      resource: r.ad_group_criterion?.resource_name,
      text: r.ad_group_criterion?.keyword?.text,
      status: r.ad_group_criterion?.status,
      cost,
      conv,
      cpa,
    };
  });

  const qualified = normalized.filter(k =>
    k.resource &&
    (
      (k.conv >= 2 && k.cpa <= avgCPA * 1.5) ||
      (k.conv >= 1 && k.cost > 25)
    )
  );

  const toEnable = qualified.filter(k => k.status !== "ENABLED");

  if (!dryRun && toEnable.length) {
    await customer.adGroupCriteria.update(
      toEnable.map(k => ({
        resource_name: k.resource,
        status: "ENABLED",
      }))
    );
  }

  return {
    evaluated: rows.length,
    promoted: toEnable.length,
  };
}

// main
export async function weeklyAdjustments({ dryRun = false } = {}) {
  const start = Date.now();
  const errors: string[] = [];

  try {
    const perf = await getPerformance();
    const { bad, avgCPA, totalCost, totalConv } = findBadHours(perf);

    const campaignPerf = await getCampaignPerf();

    const matureCount = campaignPerf.filter(c =>
      isMature(c.impr, c.clicks)
    ).length;

    const lowData = isLowData(totalCost, totalConv);

    const applySchedule = !lowData && matureCount > 0;

    let schedule = { removed: 0, applied: 0 };

    if (applySchedule) {
      try {
        const ids = campaignPerf.map(c => c.id);

        const cleanup = await removeSchedules(ids, dryRun);
        const blocks = buildBlocks(bad);
        const applied = await applySchedules(ids, blocks, dryRun);

        schedule = {
          removed: cleanup.removed,
          applied: applied.applied,
        };
      } catch (err) {
        errors.push(`schedule:${extractError(err)}`);
      }
    }

    let keywords = { evaluated: 0, promoted: 0 };

    try {
      const ids = campaignPerf.map(c => c.id);
      keywords = await promoteKeywords(ids, avgCPA, dryRun);
    } catch (err) {
      errors.push(`keywords:${extractError(err)}`);
    }

    return {
      ok: errors.length === 0,
      dryRun,
      durationMs: Date.now() - start,

      decision: {
        applySchedule,
        reason: lowData ? "low_data" : "ok",
        totalCost,
        totalConv,
        matureCampaigns: matureCount,
      },

      schedule,
      keywords,
      badHours: bad,
      avgCPA,

      errors,
    };

  } catch (err) {
    return {
      ok: false,
      error: extractError(err),
    };
  }
}