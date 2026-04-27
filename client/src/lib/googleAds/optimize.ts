
import { GOC_LEGAL_BRAND_CONTEXT, getOpenAI } from "@/lib/openai";
import { getCustomer } from "./index";

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