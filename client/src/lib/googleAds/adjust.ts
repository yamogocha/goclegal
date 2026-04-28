import { getCustomer } from "./index";
import type { resources, services } from "google-ads-api";

const LOOKBACK = "LAST_30_DAYS";
const MIN_COST = 5;
const TARGET_HOURS = 6;

// Only allow real Google Ads devices
const DEVICE = {
  DESKTOP: "0",
  MOBILE: "1",
  TABLET: "2",
};

const VALID_DEVICES = new Set([
  DEVICE.DESKTOP,
  DEVICE.MOBILE,
  DEVICE.TABLET,
]);

// -----------------------------
// Types
// -----------------------------
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

// -----------------------------
// Fetch performance
// -----------------------------
async function getPerformance() {
  const customer = getCustomer();

  const rows = await customer.query(`
    SELECT
      segments.hour,
      segments.device,
      metrics.cost_micros,
      metrics.conversions
    FROM campaign
    WHERE segments.date DURING ${LOOKBACK}
  `);

  const hourMap = new Map<number, HourPerf>();
  const deviceMap = new Map<string, DevicePerf>();

  for (const r of rows) {
    const hour = r.segments?.hour ?? 0;

    const rawDevice = String(r.segments?.device ?? DEVICE.DESKTOP);
    const device = VALID_DEVICES.has(rawDevice)
      ? rawDevice
      : DEVICE.DESKTOP;

    const cost = (r.metrics?.cost_micros ?? 0) / 1_000_000;
    const conversions = r.metrics?.conversions ?? 0;

    // Hours
    if (!hourMap.has(hour)) {
      hourMap.set(hour, { hour, cost: 0, conversions: 0 });
    }
    const h = hourMap.get(hour)!;
    h.cost += cost;
    h.conversions += conversions;

    // Devices
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

// -----------------------------
// Select top hours
// -----------------------------
function selectTopHours(hours: HourPerf[]) {
  return hours
    .filter(h => h.cost >= MIN_COST)
    .map(h => ({
      ...h,
      score: h.conversions > 0 ? h.conversions / h.cost : 0,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, TARGET_HOURS)
    .map(h => h.hour)
    .sort((a, b) => a - b);
}

// -----------------------------
// Expand hours (±1 smoothing)
// -----------------------------
function expandHours(hours: number[]) {
  const set = new Set<number>();

  for (const h of hours) {
    set.add(h);

    if (h > 0) set.add(h - 1);
    if (h < 23) set.add(h + 1);
  }

  return Array.from(set).sort((a, b) => a - b);
}

// -----------------------------
// Merge to blocks
// -----------------------------
function buildHourBlocks(hours: number[]) {
  const blocks: Array<{ start: number; end: number }> = [];
  if (!hours.length) return blocks;

  let start = hours[0];
  let prev = hours[0];

  for (let i = 1; i < hours.length; i++) {
    const curr = hours[i];

    if (curr === prev + 1) {
      prev = curr;
    } else {
      blocks.push({ start, end: prev + 1 });
      start = curr;
      prev = curr;
    }
  }

  blocks.push({ start, end: prev + 1 });
  return blocks;
}

// Device modifiers (robust)
function selectDeviceModifiers(devices: DevicePerf[]) {
  const modifiers: Record<string, number> = {};

  // Always bias mobile
  modifiers[DEVICE.MOBILE] = 1.25;

  const ranked = devices
    .filter(d => d.cost >= MIN_COST)
    .map(d => ({
      device: d.device,
      score: d.conversions > 0 ? d.conversions / d.cost : 0,
    }))
    .sort((a, b) => b.score - a.score);

  if (ranked.length > 0) {
    const best = ranked[0]?.device;
    const worst = ranked[ranked.length - 1]?.device;

    if (best && best !== DEVICE.MOBILE) {
      modifiers[best] = 1.15;
    }

    if (worst) {
      modifiers[worst] = 0.7;
    }
  }

  // Always suppress tablet
  modifiers[DEVICE.TABLET] = 0.7;

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

async function removeExistingSchedules(campaignIds: string[], dryRun: boolean) {
  const customer = getCustomer();

  const rows = await customer.query(`
    SELECT campaign_criterion.resource_name
    FROM campaign_criterion
    WHERE campaign.id IN (${campaignIds.join(",")})
      AND campaign_criterion.type = 'AD_SCHEDULE'
  `);

  const resourceNames = rows
    .map((r: services.IGoogleAdsRow) => r.campaign_criterion?.resource_name)
    .filter((name): name is string => Boolean(name));

  if (!resourceNames.length) return;

  console.log("[cleanup] removing schedules:", resourceNames.length);

  if (dryRun) return;

  await customer.campaignCriteria.remove(resourceNames);
}

async function applySchedules(
  campaignIds: string[],
  blocks: { start: number; end: number }[],
  dryRun: boolean
) {
  const customer = getCustomer();

  const days = [
    "MONDAY",
    "TUESDAY",
    "WEDNESDAY",
    "THURSDAY",
    "FRIDAY",
    "SATURDAY",
    "SUNDAY",
  ] as const;

  const creates: resources.ICampaignCriterion[] = [];

  for (const id of campaignIds) {
    for (const day of days) {
      for (const b of blocks) {
        creates.push({
          campaign: `customers/${process.env.GOOGLE_ADS_CUSTOMER_ID}/campaigns/${id}`,
          ad_schedule: {
            day_of_week: day,
            start_hour: b.start,
            end_hour: b.end,
          },
        });
      }
    }
  }

  console.log("[apply] schedule ops:", creates.length);

  if (dryRun || !creates.length) return;

  await customer.campaignCriteria.create(creates);
}

// Upsert device modifiers
async function upsertDeviceModifiers(
  campaignIds: string[],
  modifiers: Record<string, number>,
  dryRun: boolean
) {
  const customer = getCustomer();

  const updates: resources.ICampaignCriterion[] = [];

  for (const id of campaignIds) {
    for (const [device, bid] of Object.entries(modifiers)) {
      updates.push({
        resource_name: `customers/${process.env.GOOGLE_ADS_CUSTOMER_ID}/campaignCriteria/${id}~${device}`,
        bid_modifier: bid,
      });
    }
  }

  console.log("[apply] device modifiers:", modifiers);

  if (dryRun || !updates.length) return;

  await customer.campaignCriteria.update(updates);
}

export async function weeklyGoogleAdsTune({ dryRun = false } = {}) {
  console.log("=== Ads Weekly Tune (Stable v2) ===");

  const { hours, devices } = await getPerformance();

  const baseHours = selectTopHours(hours);
  const expandedHours = expandHours(baseHours);
  const blocks = buildHourBlocks(expandedHours);
  const deviceModifiers = selectDeviceModifiers(devices);

  console.log("[baseHours]:", baseHours);
  console.log("[expandedHours]:", expandedHours);
  console.log("[blocks]:", blocks);
  console.log("[deviceModifiers]:", deviceModifiers);

  const campaignIds = await getCampaignIds();
  if (!campaignIds.length) return;

  await removeExistingSchedules(campaignIds, dryRun);
  await applySchedules(campaignIds, blocks, dryRun);
  await upsertDeviceModifiers(campaignIds, deviceModifiers, dryRun);

  console.log("=== Done ===");
}
