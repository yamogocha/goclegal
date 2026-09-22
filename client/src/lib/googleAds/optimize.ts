import { getCustomer } from "./index";
import { getErrorMessage, notifySlackError, notifySlackResult } from "@/lib/error";

const addNegative = async (text: string, customer: any, sharedList?: string, dryRun = false) =>
  dryRun || !sharedList || !text ? undefined : customer.sharedCriteria.create([{
    shared_set: `customers/${process.env.GOOGLE_ADS_CUSTOMER_ID}/sharedSets/${sharedList}`,
    keyword: { text, match_type: "PHRASE" },
  }]);

// ONLY auto-injury searches are allowed to remain eligible for keyword learning.
const AUTO_INJURY_PATTERNS = [
  /\bcar accident\b/, /\bcar wreck\b/, /\bcar crash\b/, /\bauto accident\b/, /\bauto wreck\b/, /\bauto crash\b/,
  /\bautomobile accident\b/, /\bautomobile wreck\b/, /\bautomobile crash\b/, /\bvehicle accident\b/, /\bvehicle wreck\b/,
  /\bvehicle crash\b/, /\bmotor vehicle accident\b/, /\bmotor vehicle wreck\b/, /\bmotor vehicle crash\b/,
  /\bcollision\b/, /\btraffic accident\b/, /\btraffic collision\b/,
];

// Normalize search terms before classification.
const normalize = (s: string) => s.toLowerCase().replace(/[^\w\s]/g, "").trim();
const isAutoInjury = (s: string) => AUTO_INJURY_PATTERNS.some(p => p.test(normalize(s)));

// Extract a clean keyword candidate from an approved auto-injury search.
const toKeyword = (s: string) => normalize(s).split(/\s+/).filter(w => w.length > 2 && !/^(how|what|why|the|and|for|with)$/.test(w)).slice(0, 5).join(" ");
const isHighIntent = (s: string) => /\b(lawyer|attorney|injury|accident|wreck|crash|collision|settlement|compensation)\b/i.test(s);
const isMatureCampaign = (clicks: number, cost: number) => clicks >= 25 || cost >= 150;

export async function runCoreOptimization({ dryRun = false } = {}) {
  const customer = getCustomer();
  const results = { ok: true, keyword_add: [] as any[], keyword_skipped: [] as any[], negative_add: [] as any[], ad_update: [] as any[], skipped: [] as any[], errors: [] as any[] };

  try {
    // Build existing keyword lookup.
    const existingRows = await customer.query(`
      SELECT ad_group.id, ad_group_criterion.keyword.text
      FROM keyword_view
    `);
    const existingSet = new Set<string>();
    for (const r of existingRows) {
      const text = normalize(r.ad_group_criterion?.keyword?.text || "");
      const adGroupId = String(r.ad_group?.id);
      if (text && adGroupId) existingSet.add(`${adGroupId}_${text}`);
    }

    // Build existing shared negative lookup.
    const SHARED_NEG_LIST = process.env.GOOGLE_ADS_SHARED_NEGATIVE_LIST_ID;
    const existingNegativeSet = new Set<string>();
    if (SHARED_NEG_LIST) {
      const negativeRows = await customer.query(`
        SELECT shared_criterion.keyword.text
        FROM shared_criterion
        WHERE shared_set.id = ${SHARED_NEG_LIST}
      `);
      for (const row of negativeRows) {
        const text = normalize(row.shared_criterion?.keyword?.text || "");
        if (text) existingNegativeSet.add(text);
      }
    }

    // Pull all search terms; every non-auto-injury term is excluded immediately.
    const termRows = await customer.query(`
      SELECT search_term_view.search_term, ad_group.id, campaign.id, metrics.clicks, metrics.impressions, metrics.cost_micros, metrics.conversions
      FROM search_term_view
      WHERE segments.date DURING LAST_30_DAYS
    `);

    const rows = termRows.sort((a: any, b: any) => (b.metrics?.cost_micros ?? 0) - (a.metrics?.cost_micros ?? 0));
    const addNeg = async (term: string, reason: string) => {
      const key = normalize(term);
      if (!key || existingNegativeSet.has(key)) return;
      await addNegative(term, customer, SHARED_NEG_LIST, dryRun);
      existingNegativeSet.add(key);
      results.negative_add.push({ k: term, reason });
    };

    // Classify every search term before any learning decision.
    for (const r of rows) {
      const raw = r.search_term_view?.search_term || "";
      const normalized = normalize(raw);
      const clicks = r.metrics?.clicks ?? 0;
      const impressions = r.metrics?.impressions ?? 0;
      const cost = (r.metrics?.cost_micros ?? 0) / 1e6;
      const conversions = r.metrics?.conversions ?? 0;

      // Anything that is not explicitly auto-injury is always negative.
      if (!isAutoInjury(normalized)) {
        await addNeg(raw, "not_auto_injury");
        continue;
      }

      const kw = toKeyword(raw);
      const adGroupId = String(r.ad_group?.id);
      const campaignId = String(r.campaign?.id);
      const mature = isMatureCampaign(clicks, cost);
      const ageBucket = mature ? "mature" : "learning";

      // Approved auto-injury searches can remain in learning when data is insufficient.
      if (!kw || kw.split(/\s+/).length < 2) {
        results.skipped.push({ k: raw, r: "invalid_auto_injury", ageBucket });
        continue;
      }

      if (impressions < 10) {
        results.skipped.push({ k: raw, r: "low_impr", ageBucket });
        continue;
      }

      if (clicks < 2 && cost < 15) {
        results.skipped.push({ k: raw, r: "low_data", ageBucket });
        continue;
      }

      const key = `${adGroupId}_${kw}`;
      const intent = isHighIntent(kw);

      try {
        // Promote proven auto-injury searches into exact-match keywords.
        if (intent && mature && clicks >= 3) {
          if (existingSet.has(key)) {
            results.keyword_skipped.push({ k: kw, r: "exists", ageBucket });
            continue;
          }

          if (!dryRun) await customer.adGroupCriteria.create([{
            ad_group: `customers/${process.env.GOOGLE_ADS_CUSTOMER_ID}/adGroups/${adGroupId}`,
            status: "ENABLED",
            keyword: { text: `[${kw}]`, match_type: "EXACT" },
          }]);

          results.keyword_add.push({ k: kw, from: raw, ag: adGroupId });
          continue;
        }

        results.skipped.push({ k: raw, r: "auto_injury_learning", ageBucket });
      } catch (err) {
        results.ok = false;
        const error = getErrorMessage(err);
        results.errors.push({ type: "keyword", k: raw, kw, ag: adGroupId, c: campaignId, err: error });
        await notifySlackError("Google Ads Keyword Optimization Failed", err, { raw, keyword: kw, adGroupId, campaignId });
      }
    }

    // Create fresh RSA variants when CTR is weak.
    try {
      const ads = await customer.query(`
        SELECT ad_group_ad.ad.id, ad_group_ad.ad_group, ad_group_ad.status, ad_group_ad.ad.type, ad_group_ad.ad.responsive_search_ad.headlines, metrics.impressions, metrics.clicks
        FROM ad_group_ad
        WHERE metrics.impressions > 50
      `);

      const grouped = new Map<string, any[]>();
      for (const ad of ads) {
        const id = ad.ad_group_ad?.ad_group?.split("/").pop();
        if (!id) continue;
        (grouped.get(id) ?? grouped.set(id, []).get(id)!).push(ad);
      }

      for (const [adGroupId, adGroupAds] of grouped) {
        const rsaAds = adGroupAds.filter(a => a.ad_group_ad?.ad?.type === "RESPONSIVE_SEARCH_AD");
        const activeCount = rsaAds.filter(a => a.ad_group_ad?.status === "ENABLED").length;
        const ad = rsaAds[0];
        if (!ad) continue;

        const adId = ad.ad_group_ad?.ad?.id;
        const impressions = ad.metrics?.impressions ?? 0;
        const clicks = ad.metrics?.clicks ?? 0;
        const ctr = impressions ? clicks / impressions : 0;

        if (ctr >= 0.02) {
          results.skipped.push({ type: "ad", r: "healthy_ctr", ctr, adGroupId });
          continue;
        }

        if (activeCount >= 3) {
          results.skipped.push({ type: "ad", r: "rsa_limit_reached", adGroupId, activeCount });
          continue;
        }

        const old = ad.ad_group_ad?.ad?.responsive_search_ad?.headlines?.map((h: any) => h.text) || [];
        const improved = [...old.slice(0, 12), "Personal Injury Lawyer", "No Fee Unless You Win", "Free Consultation Today"].slice(0, 15);

        if (!dryRun) {
          await customer.adGroupAds.create([{
            ad_group: `customers/${process.env.GOOGLE_ADS_CUSTOMER_ID}/adGroups/${adGroupId}`,
            status: "ENABLED",
            ad: {
              responsive_search_ad: { headlines: improved.map(text => ({ text })), descriptions: [{ text: "Speak with an attorney today." }, { text: "No upfront fees." }] },
              final_urls: ["https://www.goclegal.com"],
            },
          }]);

          await customer.adGroupAds.update([{
            resource_name: `customers/${process.env.GOOGLE_ADS_CUSTOMER_ID}/adGroupAds/${adGroupId}~${adId}`,
            status: "PAUSED",
          }]);
        }

        results.ad_update.push({ adId, ag: adGroupId, ctr });
      }
    } catch (err) {
      results.ok = false;
      const error = getErrorMessage(err);
      results.errors.push({ type: "ad", err: error });
      await notifySlackError("Google Ads Ad Optimization Failed", err);
    }

    results.ok = results.errors.length === 0;
    await notifySlackResult("Google Ads Ad Optimization Result", results);
    return results;
  } catch (err) {
    await notifySlackError("Google Ads Fatal Optimization Failure", err);
    throw err;
  }
}