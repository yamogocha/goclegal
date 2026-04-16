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

const DAILY_BUDGET = 25;

const THRESHOLDS = {
  hardStop: 1.1,   // 110%
  nearLimit: 0.85, // 85%
};
  

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

  async function getActiveCampaigns() {
    const customer = getCustomer();
  
    const query = `
      SELECT
        campaign.id,
        campaign.status
      FROM campaign
      WHERE campaign.status != 'REMOVED'
    `;
  
    return customer.query(query);
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
      c => c.campaign?.status === "PAUSED"
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