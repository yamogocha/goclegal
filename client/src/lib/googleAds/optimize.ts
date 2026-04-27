
import { GOC_LEGAL_BRAND_CONTEXT, getOpenAI } from "@/lib/openai";
import { getCustomer } from "./index";
import { type services  } from "google-ads-api";

const openai = getOpenAI();

// core optimization (2-day engine: keyword, negatives, pause, ad)
export async function runCoreOptimization({ dryRun = false } = {}) {
  const customer = getCustomer();

  const results = {
    keyword_add: [] as any[],
    keyword_pause: [] as any[],
    negative_add: [] as any[],
    ad_update: [] as any[],
    errors: [] as any[],
  };

  const normalize = (s: string) =>
    s.toLowerCase().replace(/[^\w\s]/g, "").trim();

  const isHighIntent = (s: string) =>
    /\b(lawyer|attorney|injury|accident)\b/.test(s) &&
    !/\b(how|what|why|guide|process|steps|free)\b/.test(s);

  try {
    // =========================
    // FETCH (single pass)
    // =========================
    const rows = await customer.query(`
      SELECT
        search_term_view.search_term,
        ad_group.id,
        campaign.id,
        ad_group_criterion.criterion_id,
        metrics.clicks,
        metrics.conversions,
        metrics.cost_micros
      FROM search_term_view
      WHERE segments.date DURING LAST_30_DAYS
    `);

    const terms = rows.map((r: any) => ({
      term: r.search_term_view?.search_term,
      adGroupId: String(r.ad_group?.id),
      campaignId: String(r.campaign?.id),
      criterionId: r.ad_group_criterion?.criterion_id,
      clicks: r.metrics?.clicks ?? 0,
      conversions: r.metrics?.conversions ?? 0,
      cost: (r.metrics?.cost_micros ?? 0) / 1e6,
    })).filter((t: any) => t.term && t.adGroupId && t.campaignId);

    const addedKw = new Set<string>();
    const addedNeg = new Set<string>();

    const SHARED_NEG_LIST = process.env.GOOGLE_ADS_SHARED_NEGATIVE_LIST_ID;

    // =========================
    // LOOP (single pass logic)
    // =========================
    for (const t of terms.slice(0, 20)) {
      const kw = normalize(t.term);
      const words = kw.split(/\s+/);

      if (words.length < 2 || words.length > 4) continue;

      const intent = isHighIntent(kw);
      const hasClicks = t.clicks >= 3;
      const hasSpend = t.cost > 0;

      try {
        // -------------------------
        // ADD HIGH-INTENT KEYWORD
        // -------------------------
        if (intent && hasClicks && !addedKw.has(kw)) {
          if (!dryRun) {
            await customer.adGroupCriteria.create([{
              ad_group: `customers/${process.env.GOOGLE_ADS_CUSTOMER_ID}/adGroups/${t.adGroupId}`,
              status: "ENABLED",
              keyword: { text: `[${kw}]`, match_type: "EXACT" },
            }]);
          }

          addedKw.add(kw);

          results.keyword_add.push({
            keyword: kw,
            reason: "high_intent",
          });

          continue;
        }

        // -------------------------
        // NEGATIVE (SHARED LIST)
        // -------------------------
        if (!intent && (hasClicks || hasSpend) && !addedNeg.has(kw)) {
          if (!dryRun && SHARED_NEG_LIST) {
            await customer.sharedCriteria.create([{
              shared_set: `customers/${process.env.GOOGLE_ADS_CUSTOMER_ID}/sharedSets/${SHARED_NEG_LIST}`,
              keyword: { text: kw, match_type: "PHRASE" },
            }]);
          }

          addedNeg.add(kw);

          results.negative_add.push({
            keyword: kw,
            reason: "low_intent",
          });

          continue;
        }

        // -------------------------
        // PAUSE WASTE (REAL FIX)
        // -------------------------
        if (hasSpend && t.conversions === 0 && t.criterionId) {
          if (!dryRun) {
            await customer.adGroupCriteria.update([{
              resource_name: `customers/${process.env.GOOGLE_ADS_CUSTOMER_ID}/adGroupCriteria/${t.adGroupId}~${t.criterionId}`,
              status: "PAUSED",
            }]);
          }

          results.keyword_pause.push({
            keyword: kw,
            reason: "spend_no_conversion",
          });
        }

      } catch (err) {
        results.errors.push({
          keyword: kw,
          err: String(err),
        });
      }
    }

    // =========================
    // AD COPY (1 variation)
    // =========================
    try {
      const ads = await customer.query(`
        SELECT
          ad_group_ad.ad.id,
          ad_group_ad.ad_group,
          ad_group_ad.ad.responsive_search_ad.headlines
        FROM ad_group_ad
        WHERE metrics.impressions > 20
        LIMIT 1
      `);

      const ad = ads?.[0];

      if (ad) {
        const adId = ad.ad_group_ad?.ad?.id;
        const adGroupId = ad.ad_group_ad?.ad_group?.split("/").pop();

        if (adId && adGroupId) {
          const keyword = normalize(
            ad.ad_group_ad?.ad?.responsive_search_ad?.headlines?.[0]?.text ||
            "personal injury lawyer"
          );

          const ai = await openai.responses.create({
            model: "gpt-5",
            input: `${GOC_LEGAL_BRAND_CONTEXT}\nKEYWORD: ${keyword}`,
          });

          let parsed: any = null;

          try {
            parsed = JSON.parse(ai.output_text || "[]")[0];
          } catch {}

          if (parsed?.headlines && parsed?.descriptions) {
            if (!dryRun) {
              await customer.adGroupAds.create([{
                ad_group: `customers/${process.env.GOOGLE_ADS_CUSTOMER_ID}/adGroups/${adGroupId}`,
                status: "ENABLED",
                ad: {
                  responsive_search_ad: {
                    headlines: parsed.headlines.slice(0, 3).map((h: string) => ({ text: h })),
                    descriptions: parsed.descriptions.slice(0, 2).map((d: string) => ({ text: d })),
                  },
                  final_urls: ["https://www.goclegal.com"],
                },
              }]);

              await customer.adGroupAds.update([{
                resource_name: `customers/${process.env.GOOGLE_ADS_CUSTOMER_ID}/adGroupAds/${adGroupId}~${adId}`,
                status: "PAUSED",
              }]);
            }

            results.ad_update.push({
              adId,
              keyword,
            });
          }
        }
      }
    } catch (err) {
      results.errors.push({ type: "ad", err: String(err) });
    }

    return results;

  } catch (err) {
    return {
      ...results,
      errors: [{ type: "fatal", err: String(err) }],
    };
  }
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

// types
type AdDecision = {
  keyword: string;
  headlines: string[];
  descriptions: string[];
};
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