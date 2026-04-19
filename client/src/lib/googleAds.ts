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


const rsaAssetsSchema = z.object({
  headlines: z.array(z.string()),
  descriptions: z.array(z.string()),
});
// Deep Search Asset Generator
async function generateRSAAssets(params: {
  keyword: string;
  location: string;
}) {

  if (!canMakeAICall()) {
    console.log("[AI] limit reached → skip RSA generation");
    return null;
  }

  trackAICall();

  const prompt = `
${GOC_LEGAL_BRAND_CONTEXT}

TASK:
Generate HIGH-CONVERSION Google Ads RSA assets.

INPUT:
Keyword: ${params.keyword}
Location: ${params.location}

REQUIREMENTS:
- Headlines: 10–15 (max 30 chars each)
- Descriptions: 3–4 (max 90 chars each)
- Focus on HIGH INTENT (hire-ready users)
- Include emotional triggers:
  - lowball insurance
  - urgency (2-year statute)
  - DA background credibility
- NO legal advice

Return JSON:
{
  "headlines": string[],
  "descriptions": string[]
}
`;

  const res = await openai.responses.create({
    model: "gpt-5",
    input: prompt,
  });

  
  return rsaAssetsSchema.parse(JSON.parse(res.output_text));
}

type RsaAssets = z.infer<typeof rsaAssetsSchema>;

type OptimizeAdsDryRunRow = {
  adId: number;
  keyword: string;
  newAssets: RsaAssets | null;
};


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

export async function optimizeAds({ dryRun = false } = {}) {
  const lowAds = await getLowPerformingAssets();

  const results: OptimizeAdsDryRunRow[] = [];

  for (const ad of lowAds) {
    const adId = ad.ad_group_ad?.ad?.id;
    if (adId == null) continue;

    const keyword = extractTopKeyword(ad);

    const newAssets = await generateRSAAssets({
      keyword,
      location: "Oakland, CA",
    });

    const payload = {
      adId,
      keyword,
      newAssets,
    };

    if (dryRun) {
      results.push(payload);
      continue;
    }

    if (newAssets) {
      const adGroupId = ad.ad_group_ad?.ad_group;
    
      if (!adGroupId) {
        console.log("[SKIP - missing adGroupId]", adId);
        continue;
      }
    
      const parsedAdGroupId = String(adGroupId).split("/").pop()!;
    
      await updateAdAssets({
        adGroupId: parsedAdGroupId,
        adId,
        assets: newAssets,
      });
    }
  }
  return results;
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
  const customer = getCustomer();

  const text = `[${params.keyword}]`; // exact match

  await customer.adGroupCriteria.create([
    {
      ad_group: `customers/${process.env.GOOGLE_ADS_CUSTOMER_ID}/adGroups/${params.adGroupId}`,
      status: "ENABLED",
      keyword: {
        text,
        match_type: "EXACT",
      },
    },
  ]);
}

type SearchTermMiningDryRunRow = {
  action: "add_keyword";
  term: string;
  adGroupId: string;
  reasoning: string;
};
export async function runSearchTermMining({ dryRun = false } = {}) {
  const terms = await getSearchTermWinners();

  console.log("ALL TERMS:", terms.length);
  console.log("TOP TERMS:", terms.slice(0, 5));

  const results: (SearchTermMiningDryRunRow | NegativeKeywordDryRunRow)[] = [];

  const MAX_ACTIONS = 5;

  const candidates = terms
    .filter(t => t.score >= 2)
    .slice(0, MAX_ACTIONS);

  if (candidates.length === 0) return results;

  const batchTerms = candidates.map(c => c.term);

  let classifications: Classification[] = [];

  if (canMakeAICall()) {
    classifications = await classifyWithCacheBatch(batchTerms);
  }

  for (const row of candidates) {
    const { term, campaignId } = row;

    if (!campaignId) {
      console.log("[SKIP - missing campaignId]", term);
      continue;
    }

    const key = getKey(campaignId, term);

    let action: "add_keyword" | "add_negative" | "ignore" = "ignore";
    let reasoning = "fallback";

    const c = classifications.find(x => x.term === term);

    if (c) {
      action = c.action;
      reasoning = c.reasoning;
    } else {
      // fallback logic
      if (row.conversions >= 1 && row.cpa < 60) {
        action = "add_keyword";
        reasoning = "fallback: good performer";
      } else if (row.clicks >= 2 && row.conversions === 0 && row.cost > 20) {
        action = "add_negative";
        reasoning = "fallback: wasted spend";
      }
    }

    console.log("DECISION:", { term, action, reasoning });

    // mark processed EARLY
    processedTerms.add(key);

    // -------------------------
    // APPLY ACTION
    // -------------------------

    if (action === "add_keyword") {
      const payload: SearchTermMiningDryRunRow = {
        action: "add_keyword",
        term,
        adGroupId: row.adGroupId,
        reasoning,
      };

      if (dryRun) {
        results.push(payload);
      } else {
        await addExactMatchKeyword({
          adGroupId: row.adGroupId,
          keyword: term,
        });
      }
    }

    if (action === "add_negative") {
      if (await negativeKeywordExists(campaignId, term)) {
        console.log("[SKIP DUP NEGATIVE - mining]", term);
        continue;
      }

      const payload: NegativeKeywordDryRunRow = {
        action: "add_negative",
        term,
        campaignId,
        reasoning,
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
  const customer = getCustomer();

  await customer.campaignCriteria.create([
    {
      campaign: `customers/${process.env.GOOGLE_ADS_CUSTOMER_ID}/campaigns/${params.campaignId}`,
      negative: true,
      keyword: {
        text: params.keyword,
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
    .filter(w => w.score >= 3)
    .slice(0, MAX_NEGATIVES);

  for (const row of candidates) {
    const { term, campaignId } = row;

    const key = getKey(campaignId, term);

    // skip if already handled in mining
    if (processedTerms.has(key)) {
      console.log("[SKIP - handled in mining]", term);
      continue;
    }

    // dedup against Google Ads
    if (await negativeKeywordExists(campaignId, term)) {
      console.log("[SKIP DUP NEGATIVE - cleanup]", term);
      continue;
    }

    const payload: NegativeKeywordDryRunRow = {
      action: "add_negative",
      term,
      campaignId,
      reasoning: "cleanup: high waste score",
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


// ai Keyword Filterexpor
const classificationSchema = z.array(
  z.object({
    term: z.string(),
    category: z.enum(["high_intent", "medium_intent", "low_intent", "irrelevant"]),
    action: z.enum(["add_keyword", "add_negative", "ignore"]),
    reasoning: z.string(),
  }),
);
type Classification = {
  term: string;
  category: "high_intent" | "medium_intent" | "low_intent" | "irrelevant";
  action: "add_keyword" | "add_negative" | "ignore";
  reasoning: string;
};

async function classifyBatch(terms: string[]): Promise<Classification[]> {
  if (terms.length === 0) return [];

  if (!canMakeAICall()) {
    console.log("[AI] limit reached → skipping batch");
    return [];
  }

  trackAICall(); //  track BEFORE calling

  const prompt = `
${GOC_LEGAL_BRAND_CONTEXT}

Classify each search term for a personal injury law firm.

TERMS:
${terms.map((t, i) => `${i + 1}. ${t}`).join("\n")}

Return STRICT JSON:
[
  {
    "term": "...",
    "category": "high_intent | medium_intent | low_intent | irrelevant",
    "action": "add_keyword | add_negative | ignore",
    "reasoning": "short explanation"
  }
]
`;

  const res = await openai.responses.create({
    model: "gpt-5-mini",
    input: prompt,
  });

  return classificationSchema.parse(JSON.parse(res.output_text));
}

// cache per term globally
const classificationCache = new Map<string, Classification>();

async function classifyWithCacheBatch(terms: string[]) {
  const uncached: string[] = [];
  const results: Classification[] = [];

  for (const term of terms) {
    if (classificationCache.has(term)) {
      results.push(classificationCache.get(term)!);
    } else {
      uncached.push(term);
    }
  }

  if (uncached.length > 0) {
    const fresh = await classifyBatch(uncached);

    for (const item of fresh) {
      classificationCache.set(item.term, item);
      results.push(item);
    }
  }

  return results;
}

export async function manageGoogleAds() {
  try {
    resetAICallCount(); // reset at start
    await optimizeAds(); // fix bad ads
    await runSearchTermMining();      // Add winners
    await runNegativeKeywordCleanup(); // Remove waste

    return Response.json({ ok: true });
  } catch (err: unknown) {
    console.error(err);
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: message }, { status: 500 });
  }
}


