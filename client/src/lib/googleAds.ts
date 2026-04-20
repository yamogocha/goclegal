import "server-only";

import { GoogleAdsApi, type services } from "google-ads-api";
import { GOC_LEGAL_BRAND_CONTEXT, openai } from "@/lib/openai";
import { z } from "zod";
import { canMakeAICall, resetAICallCount, trackAICall } from "./budgetMonitor";


export const googleAdsClient = new GoogleAdsApi({
  client_id: process.env.GOOGLE_CLIENT_ID!,
  client_secret: process.env.GOOGLE_CLIENT_SECRET!,
  developer_token: process.env.GOOGLE_ADS_DEVELOPER_TOKEN!,
});

export function getCustomer() {
  return googleAdsClient.Customer({
    customer_id: process.env.GOOGLE_ADS_CUSTOMER_ID!,
    login_customer_id: process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID!,
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN!,
  });
}

// ai generation helper
const unifiedDecisionSchema = z.array(
  z.object({
    term: z.string(),
    action: z.enum(["add_keyword", "add_negative", "optimize_ad", "ignore"]),
    keywords: z.array(z.string()).optional(),
    headlines: z.array(z.string()).optional(),
    descriptions: z.array(z.string()).optional(),
    reasoning: z.string(),
  })
);

type UnifiedDecision = z.infer<typeof unifiedDecisionSchema>[number];

async function decideSearchTermsAndAds(terms: string[]): Promise<UnifiedDecision[]> {
  if (!canMakeAICall()) {
    console.log("[AI] limit reached → skip unified decision");
    return [];
  }

  trackAICall();

  const prompt = `
${GOC_LEGAL_BRAND_CONTEXT}

You are optimizing Google Ads for a personal injury law firm.

For each search term:

1. Decide ONE action:
- add_keyword → high intent, generate 2–3 keywords
- add_negative → irrelevant/waste
- optimize_ad → generate new RSA assets
- ignore

2. If add_keyword:
- generate EXACTLY 2 keywords
- each keyword MUST:
  - be 2–4 words ONLY
  - be under 30 characters
  - NOT be a sentence
  - NOT start with: how, what, when, why, should, can
  - MUST look like a Google Ads keyword (short phrase)

3. If optimize_ad:
- generate:
  - 10–15 headlines (max 30 chars)
  - 3–4 descriptions (max 90 chars)

TERMS:
${terms.map((t, i) => `${i + 1}. ${t}`).join("\n")}

Return JSON:
[
  {
    "term": "...",
    "action": "...",
    "keywords": [],
    "headlines": [],
    "descriptions": [],
    "reasoning": "..."
  }
]
`;

  const res = await openai.responses.create({
    model: "gpt-5-mini",
    input: prompt,
  });

  return unifiedDecisionSchema.parse(JSON.parse(res.output_text));
}

// Fetch Low-Performance Assets
async function getLowPerformingAssets() {
  const customer = getCustomer();

  const query = `
    SELECT
      ad_group_ad.ad.id,
      ad_group_ad.ad.responsive_search_ad.headlines,
      ad_group_ad.ad.responsive_search_ad.descriptions,
      metrics.impressions,
      metrics.clicks,
      metrics.conversions,
      metrics.cost_micros
    FROM ad_group_ad
    WHERE
      metrics.impressions > 50
  `;

  const rows = await customer.query(query);

  const DAILY_BUDGET = 25;
  const TARGET_CPA = DAILY_BUDGET * 2; // ~50

  const results: Array<
    services.IGoogleAdsRow & {
      _score: number;
      _action: "ignore" | "optimize" | "pause";
      _signals: string[];
    }
  > = [];

  for (const r of rows) {
    const m = r.metrics;
    if (!m) continue;

    const cost = (m.cost_micros ?? 0) / 1_000_000;
    const conversions = m.conversions ?? 0;
    const clicks = m.clicks ?? 0;
    const impressions = m.impressions ?? 0;

    const cpa = conversions > 0 ? cost / conversions : cost;
    const ctr = impressions > 0 ? clicks / impressions : 0;
    const cvr = clicks > 0 ? conversions / clicks : 0;

    let score = 0;
    const signals: string[] = [];

    // BAD
    if (cost > 30 && conversions === 0) {
      score += 3;
      signals.push("spent_no_conversion");
    }

    if (conversions > 0 && cpa > TARGET_CPA * 1.5) {
      score += 3;
      signals.push("very_high_cpa");
    }

    if (conversions > 0 && cpa > TARGET_CPA) {
      score += 2;
      signals.push("high_cpa");
    }

    if (clicks >= 5 && cvr < 0.1) {
      score += 2;
      signals.push("low_cvr");
    }

    if (ctr < 0.02 && impressions > 200) {
      score += 1;
      signals.push("low_ctr");
    }

    // GOOD
    if (conversions >= 2) {
      score -= 2;
      signals.push("has_volume");
    }

    if (cpa > 0 && cpa < TARGET_CPA * 0.8) {
      score -= 2;
      signals.push("good_cpa");
    }

    if (cvr > 0.2 && clicks >= 5) {
      score -= 1;
      signals.push("strong_cvr");
    }

    // LEARNING
    if (clicks < 5 || cost < 20) {
      score -= 2;
      signals.push("learning_phase");
    }

    let action: "ignore" | "optimize" | "pause" = "ignore";

    if (score >= 4) action = "pause";
    else if (score >= 2) action = "optimize";

    console.log("AD SCORE:", {
      adId: r.ad_group_ad?.ad?.id,
      score,
      action,
      cost,
      clicks,
      conversions,
      cpa,
      signals,
    });

    if (action !== "ignore") {
      // return ORIGINAL row, just attach metadata
      results.push({
        ...r,
        _score: score,
        _action: action,
        _signals: signals,
      });
    }
  }

  return results;
}

function extractTopKeyword(ad: services.IGoogleAdsRow): string {
  return (
    ad.ad_group_ad?.ad?.responsive_search_ad?.headlines?.[0]?.text ??
    "personal injury lawyer"
  );
}

async function updateAdAssets(params: {
  adGroupId: string;
  adId: number;
  assets: { headlines: string[]; descriptions: string[] };
}) {
  const customer = getCustomer();

  const { adGroupId, adId, assets } = params;

  // 1. Create NEW ad (valid operation)
  await customer.adGroupAds.create([
    {
      ad_group: `customers/${process.env.GOOGLE_ADS_CUSTOMER_ID}/adGroups/${adGroupId}`,
      status: "ENABLED",
      ad: {
        responsive_search_ad: {
          headlines: assets.headlines.map((h) => ({ text: h })),
          descriptions: assets.descriptions.map((d) => ({ text: d })),
        },
        final_urls: ["https://www.goclegal.com"],
      },
    },
  ]);

  // 2. Pause OLD ad (allowed)
  await customer.adGroupAds.update([
    {
      resource_name: `customers/${process.env.GOOGLE_ADS_CUSTOMER_ID}/adGroupAds/${adGroupId}~${adId}`,
      status: "PAUSED",
    },
  ]);

  console.log("Replaced ad:", { adGroupId, adId });
}

async function negativeKeywordExists(
  campaignId: string,
  term: string
): Promise<boolean> {
  const customer = getCustomer();

  const query = `
    SELECT
      campaign_criterion.keyword.text
    FROM campaign_criterion
    WHERE
      campaign.id = ${campaignId}
      AND campaign_criterion.negative = TRUE
  `;

  const rows = await customer.query(query);

  return rows.some((r: services.IGoogleAdsRow) => {
    const existing = r.campaign_criterion?.keyword?.text?.toLowerCase();
    return existing === term.toLowerCase();
  });
}


const processedTerms = new Set<string>();
function getKey(campaignId: string, term: string) {
  return `${campaignId}:${term.toLowerCase()}`;
}

type ScoredSearchTerm = {
  term: string;
  adGroupId: string;
  campaignId: string;
  clicks: number;
  conversions: number;
  cost: number;
  cpa: number;
  score: number;
  signals: string[];
};
async function getSearchTermWinners(): Promise<ScoredSearchTerm[]> {
  const customer = getCustomer();

  const query = `
    SELECT
      search_term_view.search_term,
      ad_group.id,
      campaign.id,
      metrics.clicks,
      metrics.conversions,
      metrics.cost_micros,
      metrics.impressions
    FROM search_term_view
    WHERE
      segments.date DURING LAST_30_DAYS
  `;

  const rows = await customer.query(query);

  const DAILY_BUDGET = 25;
  const TARGET_CPA = DAILY_BUDGET * 2; // ~50

  const scored: ScoredSearchTerm[] = [];

  for (const r of rows) {
    const term = r.search_term_view?.search_term;
    const adGroupId = r.ad_group?.id;
    const m = r.metrics;

    const campaignId = r.campaign?.id;
    if (!term || !adGroupId || !campaignId || !m) continue;

    const clicks = m.clicks ?? 0;
    const conversions = m.conversions ?? 0;
    const cost = (m.cost_micros ?? 0) / 1_000_000;
    const impressions = m.impressions ?? 0;

    if (clicks < 2 && impressions < 10) continue; // noise filter

    const cpa = conversions > 0 ? cost / conversions : cost;
    const ctr = impressions > 0 ? clicks / impressions : 0;
    const cvr = clicks > 0 ? conversions / clicks : 0;

    let score = 0;
    const signals: string[] = [];

    // -------------------------
    // GOOD SIGNALS
    // -------------------------

    if (conversions >= 1) {
      score += 3;
      signals.push("has_conversion");
    }

    if (cpa > 0 && cpa < TARGET_CPA) {
      score += 2;
      signals.push("good_cpa");
    }

    if (cvr > 0.2 && clicks >= 5) {
      score += 2;
      signals.push("strong_cvr");
    }

    if (ctr > 0.03) {
      score += 1;
      signals.push("high_ctr");
    }

    // -------------------------
    // BAD SIGNALS
    // -------------------------

    if (clicks >= 5 && conversions === 0 && cost > 20) {
      score -= 2;
      signals.push("wasted_spend");
    }

    if (cpa > TARGET_CPA * 1.5) {
      score -= 2;
      signals.push("very_high_cpa");
    }

    // -------------------------
    // LEARNING BOOST
    // -------------------------

    if (clicks < 5) {
      score += 1; // allow exploration
      signals.push("low_data_boost");
    }

    console.log("TERM SCORE:", {
      term,
      score,
      clicks,
      conversions,
      cost,
      cpa,
      signals,
    });

    scored.push({
      term,
      adGroupId: String(adGroupId),
      campaignId: String(campaignId),
      clicks,
      conversions,
      cost,
      cpa,
      score,
      signals,
    });
  }

  // HIGH ROI: prioritize best terms first
  return scored.sort((a, b) => b.score - a.score);
}

async function addExactMatchKeyword(params: {
  adGroupId: string;
  keyword: string;
}) {
  const cleaned = params.keyword
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .trim();

  const words = cleaned.split(/\s+/);

  // 🚫 ABSOLUTE BLOCK (cannot fail)
  if (
    words.length > 4 ||
    cleaned.length > 30 ||
    /^(how|what|when|why|should|can)\b/.test(cleaned) ||
    /\bto\b/.test(cleaned)
  ) {
    console.log("[HARD BLOCK KEYWORD]", cleaned);
    return;
  }

  const customer = getCustomer();

  await customer.adGroupCriteria.create([
    {
      ad_group: `customers/${process.env.GOOGLE_ADS_CUSTOMER_ID}/adGroups/${params.adGroupId}`,
      status: "ENABLED",
      keyword: {
        text: `[${cleaned}]`,
        match_type: "EXACT",
      },
    },
  ]);
}

export async function runGoogleAdsEngine({ dryRun = false } = {}) {
  console.log("ENGINE V0");

  const terms = await getSearchTermWinners();

  return terms.slice(0, 3).map(t => ({
    term: t.term,
    score: t.score,
  }));
}



type ScoredWasteTerm = {
  term: string;
  campaignId: string;
  clicks: number;
  conversions: number;
  cost: number;
  cpa: number;
  score: number;
};
async function getWasteSearchTerms(): Promise<ScoredWasteTerm[]> {
  const customer = getCustomer();

  const query = `
    SELECT  
      search_term_view.search_term,
      campaign.id,
      metrics.clicks,
      metrics.conversions,
      metrics.cost_micros,
      metrics.impressions
    FROM search_term_view
    WHERE
      segments.date DURING LAST_30_DAYS
  `;

  const rows = await customer.query(query);

  const scored: ScoredWasteTerm[] = [];

  for (const r of rows) {
    const term = r.search_term_view?.search_term;
    const campaignId = r.campaign?.id;
    const m = r.metrics;

    if (!term || !campaignId || !m) continue;

    const clicks = m.clicks ?? 0;
    const conversions = m.conversions ?? 0;
    const cost = (m.cost_micros ?? 0) / 1_000_000;

    if (clicks < 2) continue; // light noise filter

    const cpa = conversions > 0 ? cost / conversions : cost;

    let score = 0;

    // strong waste signals
    if (conversions === 0 && cost > 20) score += 3;
    if (conversions === 0 && clicks >= 5) score += 2;
    if (cpa > 80) score += 2;

    if (score === 0) continue;

    scored.push({
      term,
      campaignId: String(campaignId),
      clicks,
      conversions,
      cost,
      cpa,
      score,
    });
  }

  console.log("WASTE SCORED:", scored);

  return scored.sort((a, b) => b.score - a.score);
}

async function addNegativeKeyword(params: {
  campaignId: string;
  keyword: string;
}) {
  const cleaned = params.keyword
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .trim();

  const words = cleaned.split(/\s+/);

  // 🚫 block only extreme cases
  if (words.length > 12 || cleaned.length > 120) {
    console.log("[BLOCKED NEGATIVE TOO LONG]", cleaned);
    return;
  }

  const customer = getCustomer();

  await customer.campaignCriteria.create([
    {
      campaign: `customers/${process.env.GOOGLE_ADS_CUSTOMER_ID}/campaigns/${params.campaignId}`,
      negative: true,
      keyword: {
        text: cleaned,
        match_type: "PHRASE",
      },
    },
  ]);
}

type NegativeKeywordDryRunRow = {
  action: "add_negative";
  term: string;
  campaignId: string;
  reasoning: string;
};
export async function runNegativeKeywordCleanup({ dryRun = false } = {}) {
  const waste = await getWasteSearchTerms();

  console.log("WASTE TERMS:", waste.length);

  const results: NegativeKeywordDryRunRow[] = [];

  const MAX_NEGATIVES = 3;

  const candidates = waste
    .filter(w => w.score >= 4) // 🔥 stricter than before
    .slice(0, MAX_NEGATIVES);

  for (const row of candidates) {
    const { term, campaignId } = row;

    const key = getKey(campaignId, term);

    // ✅ skip anything already processed by AI layer
    if (processedTerms.has(key)) {
      console.log("[SKIP - handled by AI]", term);
      continue;
    }

    // ✅ dedup against Google Ads
    if (await negativeKeywordExists(campaignId, term)) {
      console.log("[SKIP DUP NEGATIVE - cleanup]", term);
      continue;
    }

    const payload: NegativeKeywordDryRunRow = {
      action: "add_negative",
      term,
      campaignId,
      reasoning: "cleanup: extreme waste fallback",
    };

    if (dryRun) {
      results.push(payload);
    } else {
      await addNegativeKeyword({
        campaignId,
        keyword: term,
      });
    }
  }

  return results;
}

