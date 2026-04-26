import { type services  } from "google-ads-api";
import { GOC_LEGAL_BRAND_CONTEXT, getOpenAI } from "@/lib/openai";
import { getCustomer } from "./index";

const openai = getOpenAI();

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


// core optimization (single pass, no duplication)
export async function runCoreOptimization({ dryRun = false } = {}) {
  const customer = getCustomer();

  const results = {
    keyword: [] as any[],
    negative: [] as any[],
    pause: [] as any[],
    budget: [] as any[],
    ad: [] as any[],
    errors: [] as any[],
  };

  const normalize = (s: string) =>
    s.toLowerCase().replace(/[^\w\s]/g, "").trim();

  try {
    // fetch once
    const [terms, campaigns, ads] = await Promise.all([
      getSearchTermWinners(),
      customer.query(`
        SELECT campaign.id, campaign.status,
               campaign_budget.amount_micros,
               metrics.cost_micros, metrics.clicks, metrics.conversions
        FROM campaign
        WHERE segments.date DURING LAST_30_DAYS
      `),
      getLowPerformingAssets(),
    ]);

    if (!terms.length) return results;

    const addedKw = new Set<string>();
    const addedNeg = new Set<string>();

    // =========================
    // KEYWORD + NEGATIVE + PAUSE
    // =========================
    for (const t of terms.slice(0, 15)) {
      const kw = normalize(t.term);
      const words = kw.split(/\s+/);

      if (words.length < 2 || words.length > 4) continue;

      try {
        // high intent → add exact
        if (t.score >= 2 && t.conversions > 0 && !addedKw.has(kw)) {
          if (!dryRun) {
            await addExactMatchKeyword({
              adGroupId: t.adGroupId,
              keyword: kw,
            });
          }
          addedKw.add(kw);
          results.keyword.push({ keyword: kw });
        }

        // low intent → negative
        else if (
          (t.score <= -1 || (t.clicks >= 3 && t.conversions === 0)) &&
          !addedNeg.has(kw)
        ) {
          if (!dryRun) {
            await addNegativeKeyword({
              campaignId: t.campaignId,
              keyword: kw,
            });
          }
          addedNeg.add(kw);
          results.negative.push({ keyword: kw });
        }

        // waste → pause (signal only, safe skip if invalid resource)
        if (t.cost > 20 && t.conversions === 0) {
          results.pause.push({ keyword: kw, reason: "waste" });
        }
      } catch (err) {
        results.errors.push({ type: "keyword_loop", kw, err: String(err) });
      }
    }

    // =========================
    // BUDGET (skip paused)
    // =========================
    for (const r of campaigns) {
      try {
        const status = r.campaign?.status;
        if (status !== "ENABLED") continue; // critical fix

        const campaignId = String(r.campaign?.id);
        const budget = (r.campaign_budget?.amount_micros ?? 0) / 1e6;
        const cost = (r.metrics?.cost_micros ?? 0) / 1e6;
        const conversions = r.metrics?.conversions ?? 0;

        if (cost < 50) continue;

        let newBudget = budget;

        if (conversions > 0) newBudget = budget * 1.15;
        else if (conversions === 0) newBudget = budget * 0.85;

        newBudget = Math.max(5, Math.round(newBudget * 100) / 100);

        if (Math.abs(newBudget - budget) < 0.5) continue;

        if (!dryRun) {
          await updateCampaignBudget({ campaignId, budget: newBudget });
        }

        results.budget.push({
          campaignId,
          from: budget,
          to: newBudget,
        });
      } catch (err) {
        results.errors.push({ type: "budget", err: String(err) });
      }
    }

    // =========================
    // AD COPY (1 ONLY)
    // =========================
    const ad = ads?.[0];

    if (ad) {
      try {
        const adId = ad.ad_group_ad?.ad?.id;
        const adGroupId = ad.ad_group_ad?.ad_group?.split("/").pop();

        if (adId && adGroupId) {
          const keyword = normalize(extractTopKeyword(ad));
          const decision = (await decideAdCopy([keyword]))?.[0];

          if (decision) {
            const headlines = decision.headlines.slice(0, 3);
            const descriptions = decision.descriptions.slice(0, 2);

            if (!dryRun) {
              await updateAdAssets({
                adGroupId,
                adId,
                assets: { headlines, descriptions },
              });
            }

            results.ad.push({ adId, keyword });
          }
        }
      } catch (err) {
        results.errors.push({ type: "ad", err: String(err) });
      }
    }

    return results;
  } catch (err) {
    return {
      ...results,
      errors: [{ type: "fatal", err: String(err) }],
    };
  }
}