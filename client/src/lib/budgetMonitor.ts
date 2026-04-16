import type { resources, services } from "google-ads-api";
import { getCustomer } from "./googleAds";

const LOOKBACK = "LAST_30_DAYS";
const MIN_COST = 10; // ignore weak data
const TARGET_HOURS = 6; // how many hours to keep

type HourPerf = {
  hour: number;
  cost: number;
  conversions: number;
};

type DevicePerf = {
  device: string;
  cost: number;
  conversions: number;
};

async function getPerformance() {
  const customer = getCustomer();

  const query = `
    SELECT
      segments.hour,
      segments.device,
      metrics.cost_micros,
      metrics.conversions
    FROM campaign
    WHERE segments.date DURING ${LOOKBACK}
  `;

  const rows = await customer.query(query);

  const hourMap = new Map<number, HourPerf>();
  const deviceMap = new Map<string, DevicePerf>();

  for (const r of rows) {
    const hour = r.segments?.hour ?? 0;
    const device = String(r.segments?.device ?? "UNKNOWN");
    const cost = (r.metrics?.cost_micros ?? 0) / 1_000_000;
    const conversions = r.metrics?.conversions ?? 0;

    // Hour aggregation
    if (!hourMap.has(hour)) {
      hourMap.set(hour, { hour, cost: 0, conversions: 0 });
    }
    const h = hourMap.get(hour)!;
    h.cost += cost;
    h.conversions += conversions;

    // Device aggregation
    if (!deviceMap.has(device)) {
      deviceMap.set(device, { device, cost: 0, conversions: 0 });
    }
    const d = deviceMap.get(device)!;
    d.cost += cost;
    d.conversions += conversions;
  }

  return {
    hours: Array.from(hourMap.values()),
    devices: Array.from(deviceMap.values()),
  };
}

//Rank & select winners
function selectTopHours(hours: HourPerf[]) {
  return hours
    .filter(h => h.cost >= MIN_COST)
    .map(h => ({
      ...h,
      score: h.conversions > 0 ? h.conversions / h.cost : 0,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, TARGET_HOURS)
    .map(h => h.hour);
}

function selectDeviceModifiers(devices: DevicePerf[]): Record<string, number> {
  const ranked = devices
    .filter(d => d.cost >= MIN_COST)
    .map(d => ({
      device: d.device,
      score: d.conversions > 0 ? d.conversions / d.cost : 0,
    }))
    .sort((a, b) => b.score - a.score);

  if (ranked.length === 0) return {};

  const best = ranked[0]?.device;
  const second = ranked[1]?.device;

  const modifiers: Record<string, number> = {};

  if (best) modifiers[best] = 1.25;     // +25%
  if (second) modifiers[second] = 1.1;  // +10%

  // Penalize worst
  const worst = ranked[ranked.length - 1]?.device;
  if (worst) modifiers[worst] = 0.7; // -30%

  return modifiers;
}

async function getCampaignIds(): Promise<string[]> {
  const customer = getCustomer();

  const rows = await customer.query(`
    SELECT campaign.id
    FROM campaign
    WHERE campaign.status != 'REMOVED'
  `);

  return rows
    .map((r: services.IGoogleAdsRow) => r.campaign?.id)
    .filter(Boolean)
    .map(String);
}

// Apply Ad Schedule (Dayparting)
async function updateAdSchedule(
  campaignIds: string[],
  hours: number[],
  dryRun: boolean
) {
  const customer = getCustomer();

  // Remove existing schedules (simplified approach)
  // In production: fetch & diff instead of wipe
  console.log("[schedule] setting hours:", hours);

  if (dryRun) return;

  const operations: resources.ICampaignCriterion[] = [];

  for (const id of campaignIds) {
    for (const hour of hours) {
      operations.push({
        campaign: `customers/${process.env.GOOGLE_ADS_CUSTOMER_ID}/campaigns/${id}`,
        ad_schedule: {
          day_of_week: "MONDAY", // simplify: apply to all days below
          start_hour: hour,
          end_hour: hour + 1,
        },
      });
    }
  }

  if (operations.length > 0) {
    await customer.campaignCriteria.create(operations);
  }
}

// Apply Device Modifiers
async function updateDeviceModifiers(
  campaignIds: string[],
  modifiers: Record<string, number>,
  dryRun: boolean
) {
  const customer = getCustomer();

  console.log("[devices] modifiers:", modifiers);

  if (dryRun) return;

  const ops: resources.ICampaignCriterion[] = [];

  for (const id of campaignIds) {
    for (const [device, bid] of Object.entries(modifiers)) {
      ops.push({
        campaign: `customers/${process.env.GOOGLE_ADS_CUSTOMER_ID}/campaigns/${id}`,
        device: {
          type: Number(device),
        },
        bid_modifier: bid,
      });
    }
  }

  if (ops.length > 0) {
    await customer.campaignCriteria.create(ops);
  }
}


export async function weeklyAdsOptimizer({ dryRun = false } = {}) {
  console.log("=== Weekly Ads Optimizer ===");

  const { hours, devices } = await getPerformance();

  const topHours = selectTopHours(hours);
  const deviceModifiers = selectDeviceModifiers(devices);

  console.log("[result] topHours:", topHours);
  console.log("[result] deviceModifiers:", deviceModifiers);

  const campaignIds = await getCampaignIds();
  if (campaignIds.length === 0) return;

  await updateAdSchedule(campaignIds, topHours, dryRun);
  await updateDeviceModifiers(campaignIds, deviceModifiers, dryRun);

  console.log("=== Optimization Complete ===");
}



const DAILY_BUDGET = 25;

const THRESHOLDS = {
  hardStop: 1.1,   // 110%
  nearLimit: 0.85, // 85%
};
  
async function getActiveCampaigns() {
  const customer = getCustomer();

  const rows = await customer.query(`
    SELECT campaign.id, campaign.status
    FROM campaign
    WHERE campaign.status != 'REMOVED'
  `);

  return rows;
}

function campaignIdsFromRows(rows: services.IGoogleAdsRow[]): string[] {
  return rows
    .map(r => r.campaign?.id)
    .filter((id): id is number => id !== undefined && id !== null)
    .map(String);
}


async function getTodaySpend() {
  const customer = getCustomer();

  const query = `
      SELECT
        metrics.cost_micros
      FROM customer
      WHERE segments.date DURING TODAY
    `;

  const rows = await customer.query(query);

  const totalMicros = rows.reduce(
    (sum, r: services.IGoogleAdsRow) =>
      sum + (r.metrics?.cost_micros ?? 0),
    0,
  );

  return totalMicros / 1_000_000; // dollars
}

function getPacing(spend: number, now = new Date()) {
  const hour = now.getHours();

  const start = 6;
  const end = 22;
  const total = end - start;

  const elapsed = Math.max(1, hour - start);
  const expected = (elapsed / total) * DAILY_BUDGET;

  const ratio = spend / expected;

  return {
    ratio,
    isOver: ratio > 1.2,
    isUnder: ratio < 0.6,
  };
}

async function setCampaignStatusBatch(ids: string[], status: "ENABLED" | "PAUSED") {
  const customer = getCustomer();

  await customer.campaigns.update(
    ids.map(id => ({
      resource_name: `customers/${process.env.GOOGLE_ADS_CUSTOMER_ID}/campaigns/${id}`,
      status,
    }))
  );
}
  
  export async function controlBudget({ dryRun = false } = {}) {
    const spend = await getTodaySpend();
    const campaigns = await getActiveCampaigns();
  
    const ids = campaignIdsFromRows(campaigns);
  
    if (ids.length === 0) return;
  
    const pacing = getPacing(spend);
  
    console.log("[budget]", { spend, pacing });
  
    // HARD STOP
    if (spend >= DAILY_BUDGET * THRESHOLDS.hardStop) {
      if (dryRun) {
        console.log("[DRY RUN] HARD STOP → would pause", ids);
      } else {
        await setCampaignStatusBatch(ids, "PAUSED");
      }
      return;
    }

    // NEAR LIMIT
    if (spend >= DAILY_BUDGET * THRESHOLDS.nearLimit) {
      if (dryRun) {
        console.log("[DRY RUN] NEAR LIMIT → would pause", ids);
      } else {
        await setCampaignStatusBatch(ids, "PAUSED");
      }
      return;
    }

    // NORMAL
    const pausedCampaigns = campaigns.filter(
      (c: services.IGoogleAdsRow) => c.campaign?.status === "PAUSED"
    );
    
    if (pausedCampaigns.length > 0) {
      const pausedIds = campaignIdsFromRows(pausedCampaigns);
    
      if (dryRun) {
        console.log("[DRY RUN] would re-enable", pausedIds);
      } else {
        await setCampaignStatusBatch(pausedIds, "ENABLED");
      }
    }
  }



let aiCallCount = 0;

const MAX_AI_CALLS = 5; // adjust as needed

export function canMakeAICall() {
  return aiCallCount < MAX_AI_CALLS;
}

export function trackAICall() {
  aiCallCount++;
}

export function getAICallCount() {
  return aiCallCount;
}

export function resetAICallCount() {
  aiCallCount = 0;
}