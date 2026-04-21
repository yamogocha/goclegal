import { GoogleAdsApi, type services } from "google-ads-api";
import { GOC_LEGAL_BRAND_CONTEXT, getOpenAI } from "@/lib/openai";
import { z } from "zod";
import { canMakeAICall, resetAICallCount, trackAICall } from "./budgetMonitor";

const openai = getOpenAI();
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

// ai generation helper
async function decideKeywords(
  terms: string[]
): Promise<KeywordDecision[]> {
  const prompt = `
You convert search terms into Google Ads keywords.

ONLY return JSON.

GOAL:
Compress each term into ONE short, high-intent keyword.

RULES:
- 2 to 4 words ONLY
- Must represent hiring intent
- Remove filler words (how, to, handle, need, etc.)
- Prefer "lawyer" or "attorney"
- Add location if useful (oakland)
- No explanations

EXAMPLES:

Input: how to handle a personal injury case from start to finish
Output: personal injury lawyer

Input: i need a personal injury lawyer
Output: personal injury lawyer

Input: legal aid oakland
Output: personal injury lawyer oakland

FORMAT:
[
  {
    "term": "input",
    "keyword": "compressed keyword"
  }
]
`;

  const res = await openai.responses.create({
    model: "gpt-5",
    input: `${GOC_LEGAL_BRAND_CONTEXT}

TERMS:
${terms.join("\n")}

${prompt}`,
  });

  try {
    const parsed = JSON.parse(res.output_text || "[]");

    if (!Array.isArray(parsed)) return [];

    return parsed.filter((x): x is KeywordDecision => {
      return (
        x &&
        typeof x.term === "string" &&
        typeof x.keyword === "string"
      );
    });
  } catch {
    console.error("AI parse error");
    return [];
  }
}

// types
type KeywordDecision = {
  term: string;
  keyword: string;
};

export async function runKeywordExpansion({ dryRun = false } = {}) {
  resetAICallCount();

  const results: Array<{ action: string; keyword: string }> = [];
  const added = new Set<string>();

  const normalize = (s: string) =>
    s.toLowerCase().replace(/[^\w\s]/g, "").trim();

  // enforce google-friendly keyword length
  const isValidLength = (kw: string) => {
    const words = kw.split(/\s+/);
    return words.length >= 2 && words.length <= 4;
  };

  // dedupe by simplified root
  const getRoot = (kw: string) =>
    kw
      .replace(/\b(near me|oakland|california)\b/g, "")
      .replace(/\s+/g, " ")
      .trim();

  // -------------------------
  // FETCH
  // -------------------------
  const terms = await getSearchTermWinners();

  const candidates = terms
    .filter((t: any) => t.score >= 2 && t.term)
    .slice(0, 5);

  if (!candidates.length) return results;

  const inputTerms = candidates.map((t: any) =>
    normalize(String(t.term))
  );

  // -------------------------
  // AI (single call)
  // -------------------------
  const decisions = await decideKeywords(inputTerms);

  const map = new Map<string, KeywordDecision>(
    decisions.map((d) => [normalize(d.term), d])
  );

  const rootSet = new Set<string>();
  const MAX_TOTAL = 5;

  // -------------------------
  // PROCESS
  // -------------------------
  for (const term of inputTerms) {
    if (results.length >= MAX_TOTAL) break;

    const d = map.get(term);
    if (!d) continue;

    const kw = normalize(d.keyword);

    if (!isValidLength(kw)) {
      console.log("[SKIP LENGTH]", kw);
      continue;
    }

    const root = getRoot(kw);

    if (rootSet.has(root)) {
      console.log("[SKIP DUP]", kw);
      continue;
    }

    rootSet.add(root);

    if (!dryRun) {
      try {
        await addExactMatchKeyword({
          adGroupId: candidates[0].adGroupId,
          keyword: kw,
        });
        console.log("[ADDED]", kw);
        results.push({ action: "add_keyword", keyword: kw });
      } catch (err) {
        console.error("[FAILED]", kw, err);
      }
    }
    results.push({ action: "add_keyword", keyword: kw });
  }

  return results;
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

// ai generation helper
async function decideNegatives(
  terms: string[]
): Promise<NegativeDecision[]> {
  const prompt = `
You analyze search terms for Google Ads.

ONLY return JSON.

GOAL:
Identify low-intent or irrelevant searches and convert them into clean negative keywords.

RULES:
- If NOT likely to hire a lawyer → negative = true
- If high intent → negative = false

NEGATIVE KEYWORD RULES:
- Must be natural phrase (not awkward fragments)
- 2 to 4 words
- Keep meaning of original term
- Remove filler but keep clarity
- Avoid overly broad words

BAD:
"how to"
"what is"
"free"

GOOD:
"how to handle injury claim"
"legal aid services"
"injury claim process"

FORMAT:
[
  {
    "term": "input",
    "negative": true/false,
    "keyword": "clean phrase"
  }
]
`;

  const res = await openai.responses.create({
    model: "gpt-5",
    input: `${GOC_LEGAL_BRAND_CONTEXT}

TERMS:
${terms.join("\n")}

${prompt}`,
  });

  try {
    const parsed = JSON.parse(res.output_text || "[]");

    if (!Array.isArray(parsed)) return [];

    return parsed.filter((x): x is NegativeDecision => {
      return (
        x &&
        typeof x.term === "string" &&
        typeof x.negative === "boolean" &&
        typeof x.keyword === "string"
      );
    });
  } catch {
    console.error("AI parse error");
    return [];
  }
}

// types
type NegativeDecision = {
  term: string;
  negative: boolean;
  keyword: string;
};

export async function runNegativeKeywordStrategy({ dryRun = false } = {}) {
  resetAICallCount();

  const results: Array<{ action: string; keyword: string }> = [];
  const added = new Set<string>();

  const normalize = (s: string) =>
    s.toLowerCase().replace(/[^\w\s]/g, "").trim();

  const isValid = (kw: string) => {
    if (!kw) return false;

    const words = kw.split(/\s+/);

    // allow slightly more natural phrases
    if (words.length < 2 || words.length > 4) return false;

    return true;
  };

  // -------------------------
  // FETCH
  // -------------------------
  const terms = await getSearchTermWinners();

  const candidates = terms
    .filter((t: any) => t.term)
    .slice(0, 10);

  if (!candidates.length) return results;

  const inputTerms = candidates.map((t: any) =>
    normalize(String(t.term))
  );

  // -------------------------
  // AI
  // -------------------------
  const decisions = await decideNegatives(inputTerms);

  const map = new Map<string, NegativeDecision>(
    decisions.map((d) => [normalize(d.term), d])
  );

  const MAX_TOTAL = 8;

  // -------------------------
  // PROCESS
  // -------------------------
  for (const term of inputTerms) {
    if (results.length >= MAX_TOTAL) break;

    const d = map.get(term);
    if (!d || !d.negative) continue;

    const kw = normalize(d.keyword);

    if (!isValid(kw)) {
      console.log("[SKIP INVALID]", kw);
      continue;
    }

    if (added.has(kw)) {
      console.log("[SKIP DUP]", kw);
      continue;
    }

    added.add(kw);

    if (!dryRun) {
      try {
        await addNegativeKeyword({
          campaignId: candidates[0].campaignId,
          keyword: kw,
        });
        console.log("[NEGATIVE ADDED]", kw);
      } catch (err) {
        console.error("[NEGATIVE FAILED]", kw, err);
        continue;
      }
    }

    // ✅ ALWAYS push result (fix)
    results.push({ action: "add_negative", keyword: kw });
  }

  return results;
}

