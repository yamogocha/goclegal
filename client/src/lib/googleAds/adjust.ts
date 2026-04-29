import { getCustomer } from "./index";
import type { resources } from "google-ads-api";

const LOOKBACK = "LAST_30_DAYS";
const MIN_COST = 10;

// extract error
function extractError(err: any) {
  if (!err) return "unknown_error";
  if (typeof err === "string") return err;
  if (err.message) return err.message;
  if (err.errors) return err.errors.map((e: any) => e.message).join("; ");
  return "error";
}

// get hourly performance
async function getPerformance() {
  const rows = await getCustomer().query(`
    SELECT segments.hour, metrics.cost_micros, metrics.conversions
    FROM campaign
    WHERE segments.date DURING ${LOOKBACK}
  `);

  const map = new Map<number, { hour: number; cost: number; conv: number }>();

  for (const r of rows) {
    const hour = r.segments?.hour ?? 0;
    const cost = (r.metrics?.cost_micros ?? 0) / 1e6;
    const conv = r.metrics?.conversions ?? 0;

    if (!map.has(hour)) map.set(hour, { hour, cost: 0, conv: 0 });

    const h = map.get(hour)!;
    h.cost += cost;
    h.conv += conv;
  }

  return [...map.values()];
}

// find bad hours
function findBadHours(hours: any[]) {
  const totalCost = hours.reduce((s, h) => s + h.cost, 0);
  const totalConv = hours.reduce((s, h) => s + h.conv, 0);

  const avgCPA = totalConv > 0 ? totalCost / totalConv : Infinity;

  const bad = hours
    .filter(h => h.cost >= MIN_COST)
    .filter(h => {
      const cpa = h.conv > 0 ? h.cost / h.conv : Infinity;
      return cpa > avgCPA * 2 || h.conv === 0;
    })
    .map(h => h.hour)
    .sort((a, b) => a - b);

  return { bad, avgCPA };
}

// build safe blocks
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

  const merged: typeof blocks = [];

  for (const b of blocks) {
    if (!merged.length) {
      merged.push(b);
      continue;
    }

    const last = merged[merged.length - 1];
    if (b.start - last.end <= 2) {
      last.end = b.end;
    } else {
      merged.push(b);
    }
  }

  if (merged.length > 6) {
    return [{
      start: merged[0].start,
      end: merged[merged.length - 1].end,
    }];
  }

  return merged;
}

// get search campaigns
async function getSearchCampaigns() {
  const rows = await getCustomer().query(`
    SELECT campaign.id, campaign.name, campaign.advertising_channel_type
    FROM campaign
    WHERE campaign.status != 'REMOVED'
  `);

  return rows
    .map((r: any) => ({
      id: String(r.campaign.id),
      name: r.campaign.name,
      type: Number(r.campaign.advertising_channel_type),
    }))
    .filter(c => c.type === 2);
}

// remove schedules
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

// apply schedules
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

// enable smart bidding
async function enableSmartBidding(ids: string[], dryRun: boolean) {
  const customer = getCustomer();

  const updates = ids.map(id => ({
    resource_name: `customers/${process.env.GOOGLE_ADS_CUSTOMER_ID}/campaigns/${id}`,
    maximize_conversions: {},
  }));

  if (!dryRun && updates.length) {
    await customer.campaigns.update(updates);
  }

  return { updated: updates.length };
}

// keyword promotion (with visibility)
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

  const evaluated = rows.length;

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
    k.conv >= 2 &&
    k.cpa <= avgCPA * 1.5
  );
  
  // NEW: candidate layer
  const candidates = normalized.filter(k =>
    k.resource &&
    k.conv >= 1 &&
    k.cost >= MIN_COST &&
    !qualified.includes(k)
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

  // 🔍 NEW: visibility layer
  const candidateDetails = candidates.slice(0, 10).map(k => ({
    keyword: k.text,
    conversions: k.conv,
    cost: Number(k.cost.toFixed(2)),
    cpa: Number(k.cpa.toFixed(2)),
    reason: "has conversion but not efficient enough yet",
  }));

  const topByConv = normalized
    .filter(k => k.conv > 0)
    .sort((a, b) => b.conv - a.conv)
    .slice(0, 5)
    .map(k => ({
      keyword: k.text,
      conversions: k.conv,
      cost: Number(k.cost.toFixed(2)),
      cpa: Number(k.cpa.toFixed(2)),
    }));

  const topByCPA = normalized
    .filter(k => k.conv > 0)
    .sort((a, b) => a.cpa - b.cpa)
    .slice(0, 5)
    .map(k => ({
      keyword: k.text,
      conversions: k.conv,
      cost: Number(k.cost.toFixed(2)),
      cpa: Number(k.cpa.toFixed(2)),
    }));

  return {
    evaluated,
    qualified: qualified.length,
    promoted: toEnable.length,
    candidates: candidateDetails,

    // what actually passed
    details: qualified.slice(0, 10).map(k => ({
      keyword: k.text,
      conversions: k.conv,
      cost: Number(k.cost.toFixed(2)),
      cpa: Number(k.cpa.toFixed(2)),
    })),

    // 🔍 new debug insight
    insights: {
      topByConversions: topByConv,
      topByEfficiency: topByCPA,
      avgCPA,
    },
  };
}

// main
export async function weeklyAdjustments({ dryRun = false } = {}) {
  const start = Date.now();

  try {
    const perf = await getPerformance();
    const { bad, avgCPA } = findBadHours(perf);
    const blocks = buildBlocks(bad);

    const campaigns = await getSearchCampaigns();
    const ids = campaigns.map(c => c.id);

    if (!ids.length) {
      return { ok: true, message: "no search campaigns" };
    }

    const cleanup = await removeSchedules(ids, dryRun);
    const schedule = await applySchedules(ids, blocks, dryRun);
    const smart = await enableSmartBidding(ids, dryRun);
    const keywords = await promoteKeywords(ids, avgCPA, dryRun);

    return {
      ok: true,
      dryRun,
      durationMs: Date.now() - start,

      explanation: {
        removedHours: bad.map(h => `${h}:00`),
        avgCPA,
        remainingSchedule: blocks.map(b => ({
          from: `${b.start}:00`,
          to: `${b.end}:00`,
        })),
      },

      campaigns,

      schedule: {
        removedExisting: cleanup.removed,
        appliedNew: schedule.applied,
      },

      smartBidding: {
        updated: smart.updated,
        strategy: "MAXIMIZE_CONVERSIONS",
      },

      keywords,
    };

  } catch (err) {
    return {
      ok: false,
      error: extractError(err),
      raw: err,
    };
  }
}