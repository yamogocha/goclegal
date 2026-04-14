import "server-only";

import { GoogleAdsApi, type services } from "google-ads-api";
import { GOC_LEGAL_BRAND_CONTEXT, openai } from "@/lib/openai";
import { z } from "zod";
import { canMakeAICall, resetAICallCount, trackAICall } from "./budgetMonitor";


const client = new GoogleAdsApi({
  client_id: process.env.GOOGLE_CLIENT_ID!,
  client_secret: process.env.GOOGLE_CLIENT_SECRET!,
  developer_token: process.env.GOOGLE_ADS_DEVELOPER_TOKEN!,
});

export function getCustomer() {
  return client.Customer({
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
      metrics.impressions > 100
  `;

  const rows = await customer.query(query);

  return rows.filter(r => {
    const m = r.metrics;
    if (m == null || m.cost_micros == null) return false;
    const cost = m.cost_micros / 1_000_000;
    return cost > 100 && (m.conversions ?? 0) === 0;
  });
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

type SearchTermMiningDryRunRow = {
  action: "add_keyword";
  term: string;
  adGroupId: string;
  reasoning: string;
};

type NegativeKeywordDryRunRow = {
  action: "add_negative";
  term: string;
  campaignId: string;
  reasoning: string;
};

async function updateAdAssets(adId: number, assets: { headlines: string[], descriptions: string[] }) {
  const customer = getCustomer();

  await customer.adGroupAds.update([
    {
      resource_name: `customers/${process.env.GOOGLE_ADS_CUSTOMER_ID}/adGroupAds/${adId}`,
      ad: {
        responsive_search_ad: {
          headlines: assets.headlines.map((h: string) => ({ text: h })),
          descriptions: assets.descriptions.map((d: string) => ({ text: d })),
        },
      },
    },
  ]);
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
      await updateAdAssets(adId, newAssets);
    }
  }
  return results;
}



type SearchTermWinnerRow = {
  search_term_view: { search_term: string };
  metrics: {
    clicks: number;
    conversions: number;
    cost_micros: number;
  };
  ad_group: { id: string };
};

function rowToSearchTermWinner(r: services.IGoogleAdsRow): SearchTermWinnerRow | null {
  const term = r.search_term_view?.search_term;
  const adGroupId = r.ad_group?.id;
  const m = r.metrics;
  if (term == null || adGroupId == null || m == null) return null;
  const conversions = m.conversions ?? 0;
  if (conversions < 1) return null;
  return {
    search_term_view: { search_term: term },
    metrics: {
      clicks: m.clicks ?? 0,
      conversions,
      cost_micros: m.cost_micros ?? 0,
    },
    ad_group: { id: String(adGroupId) },
  };
}

async function getSearchTermWinners(): Promise<SearchTermWinnerRow[]> {
  const customer = getCustomer();

  const query = `
    SELECT
      search_term_view.search_term,
      ad_group.id,
      metrics.clicks,
      metrics.conversions,
      metrics.cost_micros
    FROM search_term_view
    WHERE
      metrics.impressions > 50
      AND segments.date DURING LAST_30_DAYS
  `;

  const rows = await customer.query(query);

  const out: SearchTermWinnerRow[] = [];
  for (const r of rows) {
    const mapped = rowToSearchTermWinner(r);
    if (mapped) out.push(mapped);
  }
  return out;
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

export async function runSearchTermMining({ dryRun = false } = {}) {
  const winners = await getSearchTermWinners();
  const terms = winners.map(r => r.search_term_view.search_term);

  const batches = chunk(terms, 20);
  const results: SearchTermMiningDryRunRow[] = [];

  for (const batch of batches) {
    if (!canMakeAICall()) {
      console.log("[AI] stopping loop early");
      break;
    }

    const classifications = await classifyWithCacheBatch(batch);

    for (const row of winners) {
      const term = row.search_term_view.search_term;

      const c = classifications.find(x => x.term === term);
      if (!c || c.action !== "add_keyword") continue;

      const payload: SearchTermMiningDryRunRow = {
        action: "add_keyword",
        term,
        adGroupId: row.ad_group.id,
        reasoning: c.reasoning,
      };

      if (dryRun) {
        results.push(payload);
        continue;
      }

      await addExactMatchKeyword({
        adGroupId: row.ad_group.id,
        keyword: term,
      });

      console.log("[AI keyword added]", term);
    }
  }
  return results;
}



type SearchTermWasteRow = {
  search_term_view: { search_term: string };
  metrics: {
    clicks: number;
    conversions: number;
    cost_micros: number;
  };
  campaign: { id: string };
};

function rowToSearchTermWaste(r: services.IGoogleAdsRow): SearchTermWasteRow | null {
  const term = r.search_term_view?.search_term;
  const campaignId = r.campaign?.id;
  const m = r.metrics;
  if (term == null || campaignId == null || m == null) return null;
  const conversions = m.conversions ?? 0;
  if (conversions !== 0) return null;
  return {
    search_term_view: { search_term: term },
    metrics: {
      clicks: m.clicks ?? 0,
      conversions,
      cost_micros: m.cost_micros ?? 0,
    },
    campaign: { id: String(campaignId) },
  };
}

async function getWasteSearchTerms(): Promise<SearchTermWasteRow[]> {
  const customer = getCustomer();

  const query = `
    SELECT  
      search_term_view.search_term,
      campaign.id,
      metrics.clicks,
      metrics.conversions,
      metrics.cost_micros
    FROM search_term_view
    WHERE
      segments.date DURING LAST_30_DAYS
      AND metrics.clicks > 8
  `;

  const rows = await customer.query(query);

  const out: SearchTermWasteRow[] = [];
  for (const r of rows) {
    const mapped = rowToSearchTermWaste(r);
    if (mapped) out.push(mapped);
  }
  return out;
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

export async function runNegativeKeywordCleanup({ dryRun = false } = {}) {
  const waste = await getWasteSearchTerms();
  const terms = waste.map(r => r.search_term_view.search_term);

  const batches = chunk(terms, 20);
  const results: NegativeKeywordDryRunRow[] = [];

  for (const batch of batches) {
    if (!canMakeAICall()) {
      console.log("[AI] stopping loop early");
      break;
    }

    const classifications = await classifyWithCacheBatch(batch);

    for (const row of waste) {
      const term = row.search_term_view.search_term;

      const c = classifications.find(x => x.term === term);
      if (!c || c.action !== "add_negative") continue;

      const payload: NegativeKeywordDryRunRow = {
        action: "add_negative",
        term,
        campaignId: row.campaign.id,
        reasoning: c.reasoning,
      };

      if (dryRun) {
        results.push(payload);
        continue;
      }

      await addNegativeKeyword({
        campaignId: row.campaign.id,
        keyword: term,
      });

      console.log("[AI negative added]", term);
    }
  }
  return results;
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

  trackAICall(); // 🔥 track BEFORE calling

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

function chunk<T>(arr: T[], size: number): T[][] {
  const res: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    res.push(arr.slice(i, i + size));
  }
  return res;
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


