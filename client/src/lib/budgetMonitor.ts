import type { services } from "google-ads-api";
import { getCustomer } from "./googleAds";

function campaignIdsFromRows(rows: services.IGoogleAdsRow[]): string[] {
  const ids: string[] = [];
  for (const r of rows) {
    const id = r.campaign?.id;
    if (id != null) ids.push(String(id));
  }
  return ids;
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

  async function setCampaignStatus(campaignId: string, status: "ENABLED" | "PAUSED") {
    const customer = getCustomer();
  
    await customer.campaigns.update([
      {
        resource_name: `customers/${process.env.GOOGLE_ADS_CUSTOMER_ID}/campaigns/${campaignId}`,
        status,
      },
    ]);
  }

  async function getActiveCampaigns() {
    const customer = getCustomer();
  
    const query = `
      SELECT
        campaign.id,
        campaign.name,
        campaign.status
      FROM campaign
      WHERE campaign.status != 'REMOVED'
    `;
  
    return customer.query(query);
  }

function getPacingMultiplier(spend: number, now = new Date()) {
    const hour = now.getHours();
  
    // assume day runs 6am → 10pm (16 hours)
    const startHour = 6;
    const endHour = 22;
    const totalHours = endHour - startHour;
  
    const elapsed = Math.max(1, hour - startHour);
    const expectedSpend = (elapsed / totalHours) * 25;
  
    const ratio = spend / expectedSpend;
  
    return {
      ratio,
      action:
        ratio > 1.3 ? "slow_down" :
        ratio < 0.7 ? "speed_up" :
        "balanced"
    };
  }

  async function adjustCampaignBids(campaignId: string, modifier: number) {
    const customer = getCustomer();
  
    // modifier example: 0.7 = -30%, 1.2 = +20%
  
    await customer.campaignCriteria.update([
      {
        resource_name: `customers/${process.env.GOOGLE_ADS_CUSTOMER_ID}/campaignCriteria/${campaignId}~MOBILE`,
        bid_modifier: modifier,
      },
    ]);
  }
  
  const DAILY_BUDGET = 25;
  
  function isPeakHour(date = new Date()) {
    const h = date.getHours();
    return (
      (h >= 7 && h <= 10) ||
      (h >= 12 && h <= 14) ||
      (h >= 17 && h <= 21)
    );
  }
  
export async function controlBudgetAdvanced() {
  const spend = await getTodaySpend();
  const campaignRows = await getActiveCampaigns();
  const campaignIds = campaignIdsFromRows(campaignRows);
  const peak = isPeakHour();
  const pacing = getPacingMultiplier(spend);

  console.log("[budget]", { spend, pacing, peak });

  // 🔴 HARD STOP (safety)
  if (spend >= DAILY_BUDGET * 1.1) {
    for (const id of campaignIds) {
      await setCampaignStatus(id, "PAUSED");
    }
    console.log("[budget] HARD STOP");
    return;
  }

  // 🟡 NEAR LIMIT → aggressive slow down
  if (spend >= DAILY_BUDGET * 0.85) {
    for (const id of campaignIds) {
      await adjustCampaignBids(id, 0.5); // -50%
    }
    console.log("[budget] near cap → slowing heavily");
    return;
  }

  // 🧠 PACING LOGIC
  if (pacing.action === "slow_down") {
    for (const id of campaignIds) {
      await adjustCampaignBids(id, 0.7); // -30%
    }
    console.log("[budget] pacing slow down");
  }

  if (pacing.action === "speed_up" && peak) {
    for (const id of campaignIds) {
      await adjustCampaignBids(id, 1.2); // +20%
    }
    console.log("[budget] pacing speed up");
  }

  // ⏰ OFF HOURS → reduce but don't kill
  if (!peak) {
    for (const id of campaignIds) {
      await adjustCampaignBids(id, 0.6);
    }
    console.log("[budget] off hours reduction");
  }

  // 🟢 PEAK HOURS → boost mobile
  if (peak) {
    for (const id of campaignIds) {
      await adjustCampaignBids(id, 1.15);
    }
    console.log("[budget] peak boost");
  }

  // 🟢 Ensure campaigns enabled
  for (const id of campaignIds) {
    await setCampaignStatus(id, "ENABLED");
  }
}

export { controlBudgetAdvanced as controlBudget };

let aiCallCount = 0;

const MAX_AI_CALLS = 5; // 🔥 adjust as needed

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