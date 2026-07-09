import { getCustomer } from "./index";
import { getErrorMessage, notifySlackError, notifySlackResult } from "@/lib";


// Add search term to shared negative list
const addNegative = async (
  text: string,
  customer: any,
  sharedList?: string,
  dryRun = false
) =>
  dryRun || !sharedList || !text
    ? undefined
    : customer.sharedCriteria.create([{
      shared_set: `customers/${process.env.GOOGLE_ADS_CUSTOMER_ID}/sharedSets/${sharedList}`,
      keyword: { text, match_type: "PHRASE" },
    }]);
// Searches indicating research/shopping behavior rather than hiring intent
const RESEARCH_PATTERNS = [
  /\bphone number\b/, /\breviews\b/, /\bcommercial\b/,
  /\bavvo\b/, /\bbar association\b/, /\breferral service\b/,
];
// High-value personal injury searches worth expanding into keywords
const POSITIVE_PI_PATTERNS = [
  /personal injury/, /injury lawyer/, /car accident/,
  /truck accident/, /slip and fall/, /wrongful death/,
  /workers compensation/, /accident attorney/,
];
// Searches we never want to pay for as a PI firm
const NEGATIVE_PATTERNS = [
  /\bfree\b/, /\bpro bono\b/, /\blegal aid\b/,
  /\bcant afford\b/, /\bcan't afford\b/, /\bsmall claims?\b/,
  /\bcivil\b/, /\breferral\b/, /\bavvo\b/,
  /\bfind a lawyer\b/, /\battorney at law\b/,
];
// Normalize search terms before classification and matching
const normalize = (s: string) =>
  s.toLowerCase().replace(/[^\w\s]/g, "").trim();
// Check whether a term matches any pattern in a category
const matches = (patterns: RegExp[], s: string) =>
  patterns.some(p => p.test(normalize(s)));

const isResearchSearch = (s: string) => matches(RESEARCH_PATTERNS, s);
const isPositivePI = (s: string) => matches(POSITIVE_PI_PATTERNS, s);
const isIrrelevantForPI = (s: string) => matches(NEGATIVE_PATTERNS, s);
// Extract a clean keyword candidate from a search term
const toKeyword = (s: string) =>
  normalize(s)
    .split(/\s+/)
    .filter(w => w.length > 2 && !/^(how|what|why|the|and|for|with)$/.test(w))
    .slice(0, 5)
    .join(" ");

const isHighIntent = (s: string) => /\b(lawyer|attorney|injury|accident|settlement|compensation)\b/i.test(s);
// Bucket searches into business actions used by optimization rules
function classifyIntent(term: string) {
  const s = normalize(term);

  if (/\bfree\b|\bpro bono\b|\blegal aid\b|\bcan't afford\b|\bcant afford\b/.test(s)) return "free";
  if (/\bsmall claims?\b/.test(s)) return "small_claims";
  if (/\bcivil\b/.test(s)) return "civil";
  if (/\bpersonal injury\b|\bcar accident\b|\btruck accident\b|\bslip and fall\b|\bwrongful death\b|\bworkers compensation\b|\bnegligence\b/.test(s)) return "pi";

  return "unknown";
}
// Treat campaigns with enough spend or clicks as statistically meaningful
const isMatureCampaign = (clicks: number, cost: number) =>
  clicks >= 25 || cost >= 150;
// Main optimization pass: harvest winners, block waste, improve weak ads
export async function runCoreOptimization({ dryRun = false } = {}) {
  const customer = getCustomer();

  const results = {
    ok: true,
    keyword_add: [] as any[],
    keyword_skipped: [] as any[],
    negative_add: [] as any[],
    ad_update: [] as any[],
    skipped: [] as any[],
    errors: [] as any[],
  };

  try {
    // Build a lookup so we never add duplicate keywords
    const existingRows = await customer.query(`
      SELECT ad_group.id, ad_group_criterion.keyword.text
      FROM keyword_view
    `);
    // Key format: adGroupId_keyword
    const existingSet = new Set<string>();
    for (const r of existingRows) {
      const text = normalize(r.ad_group_criterion?.keyword?.text || "");
      const adGroupId = String(r.ad_group?.id);
      if (text && adGroupId) existingSet.add(`${adGroupId}_${text}`);
    }

    // Existing negatives to avoid duplicate shared criteria errors
    const SHARED_NEG_LIST = process.env.GOOGLE_ADS_SHARED_NEGATIVE_LIST_ID;
    const existingNegativeSet = new Set<string>();
    if (SHARED_NEG_LIST) {
      const negativeRows = await customer.query(`
        SELECT
        shared_criterion.keyword.text
        FROM shared_criterion
        WHERE shared_set.id = ${SHARED_NEG_LIST}
  `);

      for (const row of negativeRows) {
        const text = normalize(row.shared_criterion?.keyword?.text || "");
        if (text) { existingNegativeSet.add(text) }
      }
    }
    // Pull the last 30 days of search terms for optimization decisions
    const termRows = await customer.query(`
      SELECT
        search_term_view.search_term,
        ad_group.id,
        campaign.id,
        metrics.clicks,
        metrics.impressions,
        metrics.cost_micros,
        metrics.conversions
        FROM search_term_view
        WHERE segments.date DURING LAST_30_DAYS
    `);


    // Review highest spend searches first
    const rows = termRows.sort((a, b) => (b.metrics?.cost_micros ?? 0) - (a.metrics?.cost_micros ?? 0));
    // Record why a search term was ignored
    const skip = (k: string, r: string, ageBucket: string) =>
      results.skipped.push({ k, r, ageBucket });
    // Add a search term to the shared negative list and log it
    const addNeg = async (k: string, reason: string) => {
      const key = normalize(k);
      if (!key) return;
      if (existingNegativeSet.has(key)) return;
      await addNegative(k, customer, SHARED_NEG_LIST, dryRun);
      existingNegativeSet.add(key);
      results.negative_add.push({ k, reason });
    };
    // Evaluate each search term for keyword expansion or exclusion
    for (const r of rows) {
      const raw = r.search_term_view?.search_term || "";
      const normalized = normalize(raw);
      const category = classifyIntent(normalized);
      const positivePI = isPositivePI(normalized);
      const clicks = r.metrics?.clicks ?? 0;
      const impressions = r.metrics?.impressions ?? 0;
      const cost = (r.metrics?.cost_micros ?? 0) / 1e6;
      const conversions = r.metrics?.conversions ?? 0;

      // Auto-block junk PI searches wasting money
      if (!positivePI && conversions === 0 && cost >= 15 && (category === "free" || category === "small_claims" || category === "civil" || isResearchSearch(raw))) {
        await addNeg(raw, "wasted_spend"); continue
      }

      // Block research-oriented searches unlikely to convert
      if (isResearchSearch(raw)) { await addNeg(raw, "research"); continue; }
      // Exclude non-target legal services
      if (["free", "small_claims", "civil"].includes(category)) { await addNeg(raw, category); continue; }

      if (isIrrelevantForPI(raw)) {
        await addNeg(raw, "irrelevant_pi");
        continue;
      }

      const kw = toKeyword(raw),
        adGroupId = String(r.ad_group?.id),
        campaignId = String(r.campaign?.id),
        mature = isMatureCampaign(clicks, cost),
        ageBucket = mature ? "mature" : "learning"
        ;

      // Skip weak or statistically insignificant terms
      if (!kw || kw.split(/\s+/).length < 2) { skip(raw, "invalid", ageBucket); continue; }
      if (!positivePI && clicks < 2 && cost < 15) { skip(raw, "low_data", ageBucket); continue; }
      if (impressions < 10) { skip(raw, "low_impr", ageBucket); continue; }

      const key = `${adGroupId}_${kw}`;
      const intent = isHighIntent(kw);

      try {
        // Promote proven high-intent searches into exact match keywords
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
        // Stop spending on expensive searches outside our PI focus
        if (!positivePI && !intent && (cost >= 15 || (mature && cost > 40 && clicks >= 3))) {
          if (!dryRun && SHARED_NEG_LIST) await customer.sharedCriteria.create([{
            shared_set: `customers/${process.env.GOOGLE_ADS_CUSTOMER_ID}/sharedSets/${SHARED_NEG_LIST}`,
            keyword: { text: kw, match_type: "PHRASE" },
          }]);

          results.negative_add.push({ k: kw });
          continue;
        }

        results.skipped.push({ k: raw, r: "no_action", ageBucket });

      } catch (err) {
        results.ok = false;
        const error = getErrorMessage(err);

        results.errors.push({
          type: "keyword",
          k: raw,
          kw,
          ag: adGroupId,
          c: campaignId,
          err: error,
        });

        await notifySlackError("Google Ads Keyword Optimization Failed", err, {
          raw,
          keyword: kw,
          adGroupId,
          campaignId,
        });
      }
    }

    // Create fresh RSA variants when CTR is weak
    try {
      const ads = await customer.query(`
    SELECT
      ad_group_ad.ad.id,
      ad_group_ad.ad_group,
      ad_group_ad.status,
      ad_group_ad.ad.type,
      ad_group_ad.ad.responsive_search_ad.headlines,
      metrics.impressions,
      metrics.clicks
    FROM ad_group_ad
    WHERE metrics.impressions > 50
  `);
      // Group ads by ad group so performance is compared locally
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
        // Leave healthy ads untouched
        if (ctr >= 0.02) {
          results.skipped.push({ type: "ad", r: "healthy_ctr", ctr, adGroupId });
          continue;
        }

        if (activeCount >= 3) {
          results.skipped.push({ type: "ad", r: "rsa_limit_reached", adGroupId, activeCount });
          continue;
        }

        const old = ad.ad_group_ad?.ad?.responsive_search_ad?.headlines?.map((h: any) => h.text) || [];
        // Inject proven PI headlines into a new RSA variation
        const improved = [
          ...old.slice(0, 12),
          "Personal Injury Lawyer",
          "No Fee Unless You Win",
          "Free Consultation Today",
        ].slice(0, 15);

        if (!dryRun) {
          // Pause the underperforming version after replacement is created
          await customer.adGroupAds.create([{
            ad_group: `customers/${process.env.GOOGLE_ADS_CUSTOMER_ID}/adGroups/${adGroupId}`,
            status: "ENABLED",
            ad: {
              responsive_search_ad: {
                headlines: improved.map(text => ({ text })),
                descriptions: [
                  { text: "Speak with an attorney today." },
                  { text: "No upfront fees." },
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

        results.ad_update.push({ adId, ag: adGroupId, ctr });
      }

    } catch (err) {
      results.ok = false;

      const error = getErrorMessage(err);

      results.errors.push({ type: "ad", err: error });

      await notifySlackError(
        "Google Ads Ad Optimization Failed",
        err
      );
    }
    // Overall run succeeds only if no optimization errors occurred
    results.ok =
      results.errors.length === 0;
    // Send optimization summary to Slack
    await notifySlackResult(
      "Google Ads Ad Optimization Result",
      results
    );

    return results;

  } catch (err) {
    await notifySlackError(
      "Google Ads Fatal Optimization Failure",
      err
    );

    throw err;
  }
}