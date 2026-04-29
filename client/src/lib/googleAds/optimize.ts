import { getCustomer } from "./index";

// error extractor
function extractError(err: any) {
  try {
    if (!err) return "unknown";
    if (err instanceof Error) return err.message;
    if (err?.errors) return err.errors;
    return JSON.stringify(err);
  } catch {
    return "parse_failed";
  }
}

// normalize
const normalize = (s: string) =>
  s.toLowerCase().replace(/[^\w\s]/g, "").trim();

// keyword builder
function toKeyword(s: string) {
  return normalize(s)
    .split(/\s+/)
    .filter(w => w.length > 2 && !/^(how|what|why|the|and|for|with)$/.test(w))
    .slice(0, 5)
    .join(" ");
}

// intent
const isHighIntent = (s: string) =>
  /\b(lawyer|attorney)\b/.test(s);

// campaign maturity
const isMatureCampaign = (clicks: number, cost: number) =>
  clicks >= 25 || cost >= 150;

export async function runCoreOptimization({ dryRun = false } = {}) {
  const customer = getCustomer();

  const results = {
    keyword_add: [] as any[],
    keyword_skipped: [] as any[],
    negative_add: [] as any[],
    ad_update: [] as any[],
    skipped: [] as any[],
    errors: [] as any[],
  };

  try {
    // =========================
    // EXISTING KEYWORDS
    // =========================
    const existingRows = await customer.query(`
      SELECT
        ad_group.id,
        ad_group_criterion.keyword.text
      FROM keyword_view
    `);

    const existingSet = new Set<string>();

    for (const r of existingRows) {
      const text = normalize(r.ad_group_criterion?.keyword?.text || "");
      const adGroupId = String(r.ad_group?.id);
      if (text && adGroupId) {
        existingSet.add(`${adGroupId}_${text}`);
      }
    }

    // =========================
    // SEARCH TERMS
    // =========================
    const termRows = await customer.query(`
      SELECT
        search_term_view.search_term,
        ad_group.id,
        campaign.id,
        metrics.clicks,
        metrics.impressions,
        metrics.cost_micros
      FROM search_term_view
      WHERE segments.date DURING LAST_30_DAYS
    `);

    const SHARED_NEG_LIST = process.env.GOOGLE_ADS_SHARED_NEGATIVE_LIST_ID;

    // prioritize high-cost terms
    const rows = termRows
      .sort((a, b) => (b.metrics?.cost_micros ?? 0) - (a.metrics?.cost_micros ?? 0))
      .slice(0, 10);

    for (const r of rows) {
      const raw = r.search_term_view?.search_term || "";
      const kw = toKeyword(raw);

      const adGroupId = String(r.ad_group?.id);
      const campaignId = String(r.campaign?.id);

      const clicks = r.metrics?.clicks ?? 0;
      const impressions = r.metrics?.impressions ?? 0;
      const cost = (r.metrics?.cost_micros ?? 0) / 1e6;

      const mature = isMatureCampaign(clicks, cost);
      const ageBucket = mature ? "mature" : "learning";

      // basic validation
      if (!kw || kw.split(/\s+/).length < 2) {
        results.skipped.push({ k: raw, r: "invalid", ageBucket });
        continue;
      }

      // insufficient data
      if (clicks < 2 && cost < 15) {
        results.skipped.push({ k: raw, r: "low_data", ageBucket });
        continue;
      }

      // low impressions
      if (impressions < 10) {
        results.skipped.push({ k: raw, r: "low_impr", ageBucket });
        continue;
      }

      const key = `${adGroupId}_${kw}`;
      const intent = isHighIntent(kw);

      try {
        // =========================
        // ADD KEYWORD
        // =========================
        if (
          intent &&
          (
            (mature && clicks >= 3)
          )
        ) {
          if (existingSet.has(key)) {
            results.keyword_skipped.push({ k: kw, r: "exists", ageBucket });
            continue;
          }

          if (!dryRun) {
            await customer.adGroupCriteria.create([{
              ad_group: `customers/${process.env.GOOGLE_ADS_CUSTOMER_ID}/adGroups/${adGroupId}`,
              status: "ENABLED",
              keyword: { text: `[${kw}]`, match_type: "EXACT" },
            }]);
          }

          results.keyword_add.push({ k: kw, from: raw, ag: adGroupId });
          continue;
        }

        // =========================
        // NEGATIVE
        // =========================
        if (
          !intent &&
          (
            (mature && cost > 40 && clicks >= 3) ||
            (!mature && cost > 60)
          )
        ) {
          if (!dryRun && SHARED_NEG_LIST) {
            await customer.sharedCriteria.create([{
              shared_set: `customers/${process.env.GOOGLE_ADS_CUSTOMER_ID}/sharedSets/${SHARED_NEG_LIST}`,
              keyword: { text: kw, match_type: "PHRASE" },
            }]);
          }

          results.negative_add.push({ k: kw });
          continue;
        }

        results.skipped.push({ k: raw, r: "no_action", ageBucket });

      } catch (err) {
        results.errors.push({
          k: raw,
          ag: adGroupId,
          c: campaignId,
          err: extractError(err),
        });
      }
    }

    // =========================
    // AD UPDATE
    // =========================
    try {
      const ads = await customer.query(`
        SELECT
          ad_group_ad.ad.id,
          ad_group_ad.ad_group,
          ad_group_ad.ad.responsive_search_ad.headlines,
          metrics.impressions,
          metrics.clicks
        FROM ad_group_ad
        WHERE metrics.impressions > 50
        LIMIT 1
      `);

      const ad = ads?.[0];

      if (ad) {
        const adId = ad.ad_group_ad?.ad?.id;
        const adGroupId = ad.ad_group_ad?.ad_group?.split("/").pop();

        const impressions = ad.metrics?.impressions ?? 0;
        const clicks = ad.metrics?.clicks ?? 0;
        const ctr = impressions > 0 ? clicks / impressions : 0;

        if (ctr < 0.02) {
          const old =
            ad.ad_group_ad?.ad?.responsive_search_ad?.headlines?.map((h: any) => h.text) || [];

          const improved = [
            ...old.slice(0, 12),
            "Personal Injury Lawyer",
            "No Fee Unless You Win",
            "Free Consultation Today",
          ].slice(0, 15);

          if (!dryRun) {
            await customer.adGroupAds.create([{
              ad_group: `customers/${process.env.GOOGLE_ADS_CUSTOMER_ID}/adGroups/${adGroupId}`,
              status: "ENABLED",
              ad: {
                responsive_search_ad: {
                  headlines: improved.map(h => ({ text: h })),
                  descriptions: [
                    { text: "Speak with an attorney today." },
                    { text: "No upfront fees." }
                  ],
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
            ag: adGroupId,
            ctr,
          });
        } else {
          results.skipped.push({ type: "ad", r: "ok", ctr });
        }
      }

    } catch (err) {
      results.errors.push({ type: "ad", err: extractError(err) });
    }

    return results;

  } catch (err) {
    return {
      ...results,
      errors: [{ type: "fatal", err: extractError(err) }],
    };
  }
}