import { getCustomer } from "./index";

// check campaigns with realistic thresholds for small budgets and clearer actions
export async function checkCampaignsForPause() {
    const customer = getCustomer();
  
    const rows = await customer.query(`
      SELECT
        campaign.id,
        campaign.name,
        campaign.status,
        metrics.cost_micros,
        metrics.conversions,
        metrics.clicks,
        metrics.impressions
      FROM campaign
      WHERE campaign.status != 'REMOVED'
      AND segments.date DURING LAST_7_DAYS
    `);
  
    const campaigns = rows.map((r: any) => {
      const cost = r.metrics.cost_micros / 1_000_000;
      const conversions = r.metrics.conversions || 0;
      const clicks = r.metrics.clicks || 0;
      const impressions = r.metrics.impressions || 0;
      const ctr = impressions > 0 ? clicks / impressions : 0;
  
      return {
        id: String(r.campaign.id),
        name: r.campaign.name,
        status: r.campaign.status,
        cost,
        conversions,
        clicks,
        impressions,
        ctr,
        cpa: conversions > 0 ? cost / conversions : null,
      };
    });
  
    const recommendations = campaigns.map((c) => {
      let action = "KEEP";
      let reason = "performing or insufficient data";
  
      // RULE 1: clear waste (lower threshold)
      if (c.cost > 20 && c.conversions === 0) {
        action = "PAUSE";
        reason = "spend>20 no conversions";
      }
  
      // RULE 2: bad engagement
      else if (c.impressions > 100 && c.ctr < 0.02) {
        action = "PAUSE";
        reason = "low CTR";
      }
  
      // RULE 3: good performer
      else if (c.conversions > 0 && c.cpa && c.cpa < 150) {
        action = "KEEP";
        reason = "good CPA";
      }
  
      return { ...c, action, reason };
    });
  
    return {
      ok: true,
      summary: {
        totalCampaigns: campaigns.length,
        totalSpend: campaigns.reduce((s, c) => s + c.cost, 0),
      },
      campaigns: recommendations,
    };
  }
  
  // pause campaigns by ids minimal
  export async function pauseCampaigns(ids: string[]) {
    const customer = getCustomer();
  
    await customer.campaigns.update(
      ids.map((id) => ({
        resource_name: `customers/${process.env.GOOGLE_ADS_CUSTOMER_ID}/campaigns/${id}`,
        status: "PAUSED",
      }))
    );
  
    return { ok: true, paused: ids };
  }