import { GoogleAdsApi, type services  } from "google-ads-api";
import { GOC_LEGAL_BRAND_CONTEXT, getOpenAI } from "@/lib/openai";

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



export async function getCampaignStats(): Promise<CampaignStat[]> {
  const customer = getCustomer();

  const rows = await customer.query(`
    SELECT
      campaign.id,
      campaign_budget.amount_micros,
      metrics.cost_micros,
      metrics.clicks,
      metrics.conversions
    FROM campaign
    WHERE campaign.status != 'REMOVED'
      AND segments.date DURING LAST_30_DAYS
  `);

  const map = new Map<string, CampaignStat>();

  for (const r of rows) {
    const id = r.campaign?.id;
    if (!id) continue;

    const campaignId = String(id);

    const budget = (r.campaign_budget?.amount_micros ?? 0) / 1_000_000;
    const cost = (r.metrics?.cost_micros ?? 0) / 1_000_000;
    const clicks = r.metrics?.clicks ?? 0;
    const conversions = r.metrics?.conversions ?? 0;

    if (!map.has(campaignId)) {
      map.set(campaignId, {
        campaignId,
        budget,
        cost: 0,
        clicks: 0,
        conversions: 0,
      });
    }

    const c = map.get(campaignId)!;
    c.cost += cost;
    c.clicks += clicks;
    c.conversions += conversions;
  }

  return Array.from(map.values());
}

export async function updateCampaignBudget({
  campaignId,
  budget,
}: {
  campaignId: string;
  budget: number;
}) {
  const customer = getCustomer();

  const amountMicros = Math.round(budget * 1_000_000);

  // fetch budget resource name
  const rows = await customer.query(`
    SELECT
      campaign.id,
      campaign.campaign_budget
    FROM campaign
    WHERE campaign.id = ${campaignId}
    LIMIT 1
  `);

  const budgetResource = rows[0]?.campaign?.campaign_budget;
  if (!budgetResource) {
    throw new Error("Missing campaign budget resource");
  }

  await customer.campaignBudgets.update([
    {
      resource_name: budgetResource,
      amount_micros: amountMicros,
    },
  ]);
}

// types
type CampaignStat = {
  campaignId: string;
  budget: number; // current daily budget
  cost: number;
  clicks: number;
  conversions: number;
};

export async function runBudgetAllocation() {
  console.log("[BUDGET] Starting allocation");

  const results: Array<{
    campaignId: string;
    action: string;
    oldBudget: number;
    newBudget: number;
  }> = [];

  // -------------------------
  // CONFIG (keep minimal)
  // -------------------------
  const MIN_CLICKS = 20;
  const MIN_COST = 50;

  const INCREASE_RATE = 0.15;
  const DECREASE_RATE = 0.15;

  const MIN_BUDGET = 5;
  const MAX_CHANGE = 0.2; // safety cap

  // -------------------------
  // FETCH
  // -------------------------
  const campaigns: CampaignStat[] = await getCampaignStats();

  if (!campaigns.length) return results;

  // -------------------------
  // PROCESS
  // -------------------------
  for (const c of campaigns) {
    const { campaignId, budget, cost, clicks, conversions } = c;

    // skip low data (critical)
    if (clicks < MIN_CLICKS && cost < MIN_COST) {
      console.log("[SKIP LOW DATA]", campaignId);
      continue;
    }

    let newBudget = budget;
    let action = "none";

    // -------------------------
    // WINNER
    // -------------------------
    if (conversions > 0) {
      newBudget = budget * (1 + INCREASE_RATE);
      action = "increase";
    }

    // -------------------------
    // LOSER
    // -------------------------
    else if (cost >= MIN_COST && conversions === 0) {
      newBudget = budget * (1 - DECREASE_RATE);
      action = "decrease";
    }

    else {
      continue;
    }

    // -------------------------
    // GUARDRAILS
    // -------------------------
    const maxUp = budget * (1 + MAX_CHANGE);
    const maxDown = budget * (1 - MAX_CHANGE);

    if (newBudget > maxUp) newBudget = maxUp;
    if (newBudget < maxDown) newBudget = maxDown;

    if (newBudget < MIN_BUDGET) newBudget = MIN_BUDGET;

    // round (clean)
    newBudget = Math.round(newBudget * 100) / 100;

    // skip tiny changes
    if (Math.abs(newBudget - budget) < 0.5) {
      console.log("[SKIP SMALL CHANGE]", campaignId);
      continue;
    }

    // -------------------------
    // APPLY
    // -------------------------
    try {
      await updateCampaignBudget({
        campaignId,
        budget: newBudget,
      });

      console.log("[UPDATED]", campaignId, budget, "→", newBudget);

      results.push({
        campaignId,
        action,
        oldBudget: budget,
        newBudget,
      });
    } catch (err) {
      console.error("[FAILED]", campaignId, err);
    }
  }

  return results;
}



// Fetch Low-Performance Assets
async function getLowPerformingAssets() {
  const customer = getCustomer();

  const query = `
    SELECT
      ad_group_ad.ad.id,
      ad_group_ad.ad_group,
      ad_group_ad.ad.responsive_search_ad.headlines,
      ad_group_ad.ad.responsive_search_ad.descriptions,
      metrics.impressions,
      metrics.clicks,
      metrics.conversions,
      metrics.cost_micros
    FROM ad_group_ad
    WHERE metrics.impressions > 20
  `;

  const rows = await customer.query(query);

  const results: Array<
    services.IGoogleAdsRow & {
      _score: number;
      _action: "optimize" | "pause";
      _signals: string[];
    }
  > = [];

  for (const r of rows) {
    const m = r.metrics;
    if (!m) continue;

    const cost = (m.cost_micros ?? 0) / 1_000_000;
    const clicks = m.clicks ?? 0;
    const conversions = m.conversions ?? 0;
    const impressions = m.impressions ?? 0;

    const ctr = impressions > 0 ? clicks / impressions : 0;
    const cvr = clicks > 0 ? conversions / clicks : 0;

    let score = 0;
    const signals: string[] = [];

    // -------------------------
    // LIGHTWEIGHT SIGNALS (no overfitting)
    // -------------------------

    if (impressions > 100 && ctr < 0.02) {
      score += 1;
      signals.push("low_ctr");
    }

    if (clicks >= 5 && conversions === 0) {
      score += 1;
      signals.push("no_conversion");
    }

    if (clicks >= 5 && cvr < 0.1) {
      score += 1;
      signals.push("low_cvr");
    }

    if (cost > 20 && conversions === 0) {
      score += 1;
      signals.push("spent_no_result");
    }

    // -------------------------
    // DECISION (LOW THRESHOLD)
    // -------------------------

    let action: "optimize" | "pause" = "optimize";

    if (score >= 3) {
      action = "pause";
    }

    results.push({
      ...r,
      _score: score,
      _action: action,
      _signals: signals,
    });
  }

  // -------------------------
  // SORT (worst first)
  // -------------------------
  results.sort((a, b) => b._score - a._score);

  // -------------------------
  // LIMIT (keep it tight)
  // -------------------------
  const selected = results.slice(0, 3);

  // -------------------------
  // GUARANTEE NON-EMPTY
  // -------------------------
  if (!selected.length && rows.length > 0) {
    const fallback = rows[0];

    return [
      {
        ...fallback,
        _score: 0,
        _action: "optimize",
        _signals: ["fallback_low_data"],
      },
    ];
  }

  return selected;
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

// ai generator
async function decideAdCopy(
  keywords: string[]
): Promise<AdDecision[]> {
  const prompt = `
You write Google Ads copy for a personal injury law firm.

ONLY return JSON.

GOAL:
Generate high-converting ad copy.

RULES:
- Use strong legal intent language
- Highlight:
  - former prosecutor advantage
  - direct attorney access
  - real case results
- Be clear and credible
- No hype, no exaggeration
- No emojis

FORMAT:
[
  {
    "keyword": "input keyword",
    "headlines": ["h1", "h2", "h3"],
    "descriptions": ["d1", "d2"]
  }
]
`;

  const res = await openai.responses.create({
    model: "gpt-5",
    input: `${GOC_LEGAL_BRAND_CONTEXT}

KEYWORDS:
${keywords.join("\n")}

${prompt}`,
  });

  try {
    const parsed = JSON.parse(res.output_text || "[]");

    if (!Array.isArray(parsed)) return [];

    return parsed.filter((x): x is AdDecision => {
      return (
        x &&
        typeof x.keyword === "string" &&
        Array.isArray(x.headlines) &&
        Array.isArray(x.descriptions)
      );
    });
  } catch {
    console.error("AI parse error");
    return [];
  }
}

// types
type AdDecision = {
  keyword: string;
  headlines: string[];
  descriptions: string[];
};

export async function runAdCopyOptimization({ dryRun = false } = {}) {
  const results: Array<{
    adId: number;
    keyword: string;
    headlines: string[];
    descriptions: string[];
    status: string;
  }> = [];

  const normalize = (s: string) =>
    s.toLowerCase().replace(/[^\w\s]/g, "").trim();

  // -------------------------
  // FETCH
  // -------------------------
  const ads = await getLowPerformingAssets();

  const candidates = ads
    .map((ad: any) => {
      const adId = ad.ad_group_ad?.ad?.id;
      const adGroupId = ad.ad_group_ad?.ad_group;

      if (!adId || !adGroupId) return null;

      return {
        adId,
        adGroupId: String(adGroupId).split("/").pop(),
        keyword: normalize(extractTopKeyword(ad)),
      };
    })
    .filter(Boolean)
    .slice(0, 1) as {
    adId: number;
    adGroupId: string;
    keyword: string;
  }[];

  if (!candidates.length) return results;

  const keywords = candidates.map((c) => c.keyword);

  console.log("[AD INPUT]", keywords);

  // -------------------------
  // AI
  // -------------------------
  const decisions = await decideAdCopy(keywords);

  console.log("[AD AI OUTPUT]", decisions);

  if (!decisions.length) return results;

  const ad = candidates[0];

  // -------------------------
  // USE MULTIPLE VARIATIONS (KEY CHANGE)
  // -------------------------
  const MAX_VARIATIONS = 2; // keep tight + safe
  const variations = decisions.slice(0, MAX_VARIATIONS);

  for (const d of variations) {
    const headlines = (d.headlines || []).slice(0, 3);
    const descriptions = (d.descriptions || []).slice(0, 2);

    if (!headlines.length || !descriptions.length) continue;

    let status = "dry_run";

    if (!dryRun) {
      try {
        await updateAdAssets({
          adGroupId: ad.adGroupId,
          adId: ad.adId,
          assets: { headlines, descriptions },
        });

        status = "updated";
        console.log("[UPDATED]", ad.adId);
      } catch (err) {
        status = "failed";
        console.error("[FAILED]", ad.adId, err);
      }
    }

    results.push({
      adId: ad.adId,
      keyword: ad.keyword,
      headlines,
      descriptions,
      status,
    });
  }

  return results;
}
