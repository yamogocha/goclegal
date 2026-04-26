// strict generation only: enforce tighter headline length to avoid overflow at source
import { z, ZodError } from "zod";
import { getOpenAI, GOC_LEGAL_BRAND_CONTEXT } from "@/lib/openai";
import { getCustomer } from "./index";
import { NextResponse } from "next/server";

const openai = getOpenAI();

// // UPDATE schema (stronger RSA requirements)
const CampaignSchema = z.object({
  campaign: z.object({
    name: z.string(),
    type: z.literal("SEARCH"),
    dailyBudget: z.literal(25),
    location: z.string(),
  }),
  adGroups: z.array(
    z.object({
      name: z.string().min(5).max(100),
      keywords: z.array(z.string()).min(5).max(10).length(10),

      // // upgraded counts
      headlines: z.array(z.string().min(12).max(30)).length(15),
      descriptions: z.array(z.string().min(40).max(90)).length(4),
    })
  ).min(1).max(3),
});

const jsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["campaign", "adGroups"],
  properties: {
    campaign: {
      type: "object",
      additionalProperties: false,
      required: ["name", "type", "dailyBudget", "location"],
      properties: {
        name: { type: "string" },
        type: { type: "string", enum: ["SEARCH"] },
        dailyBudget: { type: "number", const: 25 },
        location: { type: "string" },
      },
    },
    adGroups: {
      type: "array",
      minItems: 1,
      maxItems: 3,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "keywords", "headlines", "descriptions"],
        properties: {
          name: { type: "string" },
          keywords: { type: "array", items: { type: "string" } },
          headlines: { type: "array", items: { type: "string" } },
          descriptions: { type: "array", items: { type: "string" } },
        },
      },
    },
  },
};

// map ad group → landing page (minimal + deterministic)
function resolveFinalUrl(name: string) {
  const n = name.toLowerCase();

  if (n.includes("slip")) return "https://www.goclegal.com/slip-and-fall-injuries";
  if (n.includes("truck")) return "https://www.goclegal.com/trucking-accidents";
  if (n.includes("bicycle")) return "https://www.goclegal.com/bicycle-accidents";
  if (n.includes("construction")) return "https://www.goclegal.com/construction-site-accidents";
  if (n.includes("brain")) return "https://www.goclegal.com/traumatic-brain-injury";
  if (n.includes("death")) return "https://www.goclegal.com/wrongful-death";

  return "https://www.goclegal.com/auto-accidents";
}


export async function generateSearchCampaign(location = "Oakland CA") {
  const res = await openai.responses.parse({
    model: "gpt-5",
    input: [
      {
        role: "system",
        content: `
${GOC_LEGAL_BRAND_CONTEXT}

RELEVANCE (CRITICAL):
- Headlines MUST reflect ad group name topic
- Avoid generic phrasing across groups

Generate Google Search Ads with strict rules.

HEADLINES (CRITICAL):
- HARD TARGET: 20–26 characters (not 30)
- NEVER exceed 28 characters (safety buffer)
- If near 28, shorten wording BEFORE returning
- Prefer 3–5 words max
- Generate EXACTLY 15 headlines per ad group
- First 8 MUST follow existing strict rules
- Remaining 7 can be more flexible but MUST:
  - include ad group topic keyword
  - improve variation (CTA, location, urgency)

- must include one of:
  lawyer, attorney, injury, accident, claim, case

ROLES:
1. Authority
2. Outcome
3. Process
4. Risk (max 1)

- no filler words
- no commas
- natural phrasing only

KEYWORDS (STRICT + TIED TO AD GROUP):

Generate 10 keywords per ad group.

CORE RULE:
- Keywords MUST directly reflect the ad group name
- Extract the main topic from the ad group name and use it in keywords

EXAMPLES:
- "Slip and Fall" → must include: slip OR fall OR "slip & fall"
- "Auto Accidents" → must include: auto, car, accident
- "Lowball Insurance Offers" → must include: insurance

HARD REQUIREMENTS:
- each keyword MUST include:
  1. "oakland"
  2. one intent word: lawyer or attorney
  3. at least one word from the ad group name topic

- <= 6 words
- <= 40 characters
- lowercase only

STRICT SEPARATION:
- keywords across ad groups MUST be different
- DO NOT reuse the same keyword in multiple groups

POLICY:
- avoid "injury claim"
- avoid "accident injury"
- no health condition targeting

SELF-CHECK:
For each keyword:
1. matches ad group topic → else REWRITE
2. contains "oakland" → else REWRITE
3. contains lawyer/attorney → else REWRITE
4. not used in other groups → else REWRITE

If ANY rule fails → regenerate ENTIRE keyword set.

DESCRIPTIONS:

- Generate EXACTLY 4 descriptions per ad group
- First 3 follow existing strict rules
- 4th adds variation (CTA or urgency)

HARD LENGTH RULE (CRITICAL):
- TARGET 55–75 characters
- NEVER go below 45 characters
- If under 45, expand before returning

ROLE ASSIGNMENT:
1. Authority
2. Outcome
3. Process OR Risk

STRUCTURE:
- full sentences
- must end with punctuation
- natural phrasing

CONSTRAINTS:
- max ONE numeric proof per campaign
- no filler phrases
- no truncation

IMPORTANT:
- prioritize meeting minimum length over brevity
`,
      },
      {
        role: "user",
        content: `Create campaign for ${location}`,
      },
    ],
    text: {
      format: { type: "json_schema", name: "campaign", schema: jsonSchema },
    },
  });

  if (!res.output_parsed) {
    throw new Error("generation failed");
  }

  return CampaignSchema.parse(res.output_parsed);
}

// handle duplicate budget by reuse or create
async function getOrCreateBudget(customer: any, name: string, amountMicros: number) {
  try {
    const res = await customer.campaignBudgets.create([{
      name,
      amount_micros: amountMicros,
      delivery_method: "STANDARD",
    }]);

    return res.results?.[0]?.resource_name;
  } catch (e: any) {
    const msg = JSON.stringify(e);

    // duplicate -> fetch existing
    if (msg.includes("DUPLICATE_NAME")) {
      const query = `
        SELECT campaign_budget.resource_name
        FROM campaign_budget
        WHERE campaign_budget.name = '${name}'
        LIMIT 1
      `;

      const found = await customer.query(query);
      return found?.[0]?.campaign_budget?.resource_name;
    }

    throw e;
  }
}

// normalize + preserve real Google Ads errors + consistent response

type CreateCampaignOpts = {
  location?: string;
  lat?: number;
  lng?: number;
  radiusMiles?: number;
  dryRun?: boolean;
};

// harden error extraction + guarantee visibility

export function extractError(e: any) {
  // google ads structured
  if (e?.errors && Array.isArray(e.errors)) {
    return {
      error: "google_ads_error",
      details: e.errors.map((x: any) => ({
        message: x.message,
        code: Object.keys(x.error_code || {})[0],
        trigger: x.trigger?.string_value,
      })),
    };
  }

  // standard Error
  if (e instanceof Error) {
    return {
      error: e.message || "error",
      details: [{ stack: e.stack }],
    };
  }

  // string error
  if (typeof e === "string") {
    return {
      error: e,
      details: [{ raw: e }],
    };
  }

  // unknown object
  try {
    return {
      error: "unknown_error",
      details: [{ raw: JSON.stringify(e, null, 2) }],
    };
  } catch {
    return {
      error: "unknown_error",
      details: [{ raw: String(e) }],
    };
  }
}

export async function createSearchCampaign(opts: CreateCampaignOpts = {}) {
  const {
    location = "Oakland CA",
    lat = 37.7652,
    lng = -122.2416,
    radiusMiles = 15,
    dryRun = false,
  } = opts;

  const customer = getCustomer();
  const logs: any[] = [];
  const details: any[] = [];

  try {
    const data = await generateSearchCampaign(location);

    if (dryRun) {
      return {
        ok: true,
        error: null,
        details: [],
        logs,
        result: null,
        preview: data,
      };
    }

    const budgetRes = await getOrCreateBudget(
      customer,
      `${data.campaign.name} Budget`,
      data.campaign.dailyBudget * 1e6
    );

    const campaign = await customer.campaigns.create([{
      name: `${data.campaign.name} ${Date.now().toString().slice(-4)}`,
      advertising_channel_type: "SEARCH",
      status: "ENABLED",
      campaign_budget: budgetRes,
      manual_cpc: {},
      contains_eu_political_advertising: "DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING",
    }]);

    const campaignRes = campaign.results?.[0]?.resource_name;
    if (!campaignRes) throw new Error("campaign failed");

    logs.push({ step: "campaign_created", campaignRes });

    await customer.campaignCriteria.create([{
      campaign: campaignRes,
      proximity: {
        geo_point: {
          latitude_in_micro_degrees: Math.round(lat * 1e6),
          longitude_in_micro_degrees: Math.round(lng * 1e6),
        },
        radius: radiusMiles,
        radius_units: "MILES",
      },
    }]);

    // // parallel ad groups, sequential operations inside each (fix database_error)
    await Promise.all(
      data.adGroups.map(async (ag) => {
        try {
          const adGroup = await customer.adGroups.create([{
            name: `${ag.name} ${Date.now().toString().slice(-3)}`,
            campaign: campaignRes,
            type: "SEARCH_STANDARD",
            cpc_bid_micros: 2_000_000,
            status: "ENABLED",
          }]);

          const agRes = adGroup.results?.[0]?.resource_name;
          if (!agRes) throw new Error("adgroup failed");

          // // SEQUENTIAL (critical fix)
          try {
            await customer.adGroupCriteria.create(
              ag.keywords.map(k => ({
                ad_group: agRes,
                status: "ENABLED",
                keyword: { text: k, match_type: "PHRASE" },
              }))
            );
          } catch (e: any) {
            details.push({ step: "keywords", ag: ag.name, error: e.message });
          }

          // // improved RSA: enabled + more assets + correct URL
          await customer.adGroupAds.create([{
            ad_group: agRes,
            status: "ENABLED", // ✅ FIX paused ads
            ad: {
              final_urls: [resolveFinalUrl(ag.name)], // ✅ FIX landing page
              responsive_search_ad: {
                headlines: ag.headlines.slice(0, 7).map(h => ({ text: h })), // ✅ 7 headlines
                descriptions: ag.descriptions.slice(0, 4).map(d => ({ text: d })), // ✅ 4 descriptions
              },
            },
          }]).then(() => {
            logs.push({
              step: "rsa_created",
              adGroup: ag.name,
              url: resolveFinalUrl(ag.name),
              headlines: ag.headlines.length,
              descriptions: ag.descriptions.length,
            });
          }).catch(e => {
            const err = extractError(e);
            details.push({
              step: "ads",
              ag: ag.name,
              error: err.error,
              details: err.details,
            });
          });

        } catch (e: any) {
          details.push({ step: "adgroup", ag: ag.name, error: e.message });
        }
      })
    );

    const ok = details.length === 0;

    return {
      ok,
      error: ok ? null : "partial_failure",
      details: ok ? [] : details,
      logs,
      result: { campaign: campaignRes },
    };

  } catch (e: any) {
    const err = extractError(e);

    return {
      ok: false,
      error: err.error,
      details: err.details.length ? err.details : [{ fallback: "no_details_available" }],
      logs,
      result: null,
    };
  }
}

// // idempotent conversion + phone normalization + full visibility

// reuse or create conversion by name
async function getOrCreateConversion(customer: any, name: string, payload: any) {
  try {
    const res = await customer.conversionActions.create([{ name, ...payload }]);
    return res.results?.[0]?.resource_name;
  } catch (e: any) {
    const msg = JSON.stringify(e);

    // duplicate -> fetch existing
    if (msg.includes("DUPLICATE") || msg.includes("already exists")) {
      const query = `
        SELECT conversion_action.resource_name
        FROM conversion_action
        WHERE conversion_action.name = '${name}'
        LIMIT 1
      `;
      const found = await customer.query(query);
      return found?.[0]?.conversion_action?.resource_name;
    }

    throw e;
  }
}

// // create conversion tracking + attach safely
export async function setupConversionsAndCalls(opts: {
  campaignResourceName: string;
  dryRun?: boolean;
}) {
  const { campaignResourceName, dryRun = false } = opts;
  const customer = getCustomer();

  if (dryRun) {
    return {
      ok: true,
      preview: {
        conversions: ["CALL", "FORM"],
        callReporting: true,
      },
    };
  }

  try {
    const callConversion = await getOrCreateConversion(customer, "Calls from Ads", {
      type: "AD_CALL",
      category: "DEFAULT",
      status: "ENABLED",
      value_settings: { default_value: 1, always_use_default_value: true },
    });

    const formConversion = await getOrCreateConversion(customer, "Form Submissions", {
      type: "WEBPAGE",
      category: "DEFAULT",
      status: "ENABLED",
      value_settings: { default_value: 1, always_use_default_value: true },
    });

    if (!callConversion || !formConversion) {
      throw new Error("conversion_setup_failed");
    }

    await customer.campaigns.update([
      {
        resource_name: campaignResourceName,
        call_reporting_setting: {
          call_reporting_enabled: true,
          call_conversion_action: callConversion,
        },
      },
    ] as any);

    await customer.campaigns.update([
      {
        resource_name: campaignResourceName,
        maximize_conversions: {},
      },
    ]);

    return {
      ok: true,
      result: {
        callConversion,
        formConversion,
        campaign: campaignResourceName,
      },
    };

  } catch (e: any) {
    const err = extractError(e);
    return {
      ok: false,
      error: err.error,
      details: err.details,
    };
  }
}

// // strict phone validation + clear error + no mutation
export async function setupCallExtension(opts: {
  campaignResourceName: string;
  phoneNumber: string;
  countryCode?: string;
  dryRun?: boolean;
}) {
  const {
    campaignResourceName,
    phoneNumber,
    countryCode = "US",
    dryRun = false,
  } = opts;

  const customer = getCustomer();

  // // strict E.164 validation (production safe)
  const isValidPhone = /^\+?[1-9]\d{9,14}$/.test(phoneNumber);

  if (!isValidPhone) {
    return {
      ok: false,
      error: "invalid_phone_number",
      details: [{
        message: "Phone must be valid E.164 format (e.g. +15101234567)",
        input: phoneNumber,
      }],
    };
  }

  if (dryRun) {
    return {
      ok: true,
      preview: {
        phoneNumber,
        countryCode,
        attachedTo: campaignResourceName,
      },
    };
  }

  try {
    const callAsset = await customer.assets.create([{
      call_asset: {
        phone_number: phoneNumber, // // no mutation
        country_code: countryCode,
      },
    }]);

    const asset = callAsset.results?.[0]?.resource_name;
    if (!asset) throw new Error("call_asset_failed");

    await customer.campaignAssets.create([{
      campaign: campaignResourceName,
      asset,
      field_type: "CALL",
    }]);

    return {
      ok: true,
      result: {
        asset,
        campaign: campaignResourceName,
      },
    };

  } catch (e: any) {
    const err = extractError(e);
    return {
      ok: false,
      error: err.error,
      details: err.details,
    };
  }
}


const isDev = process.env.VERCEL_ENV !== "production";

function formatError(err: unknown) {
  if (err instanceof ZodError) {
    return {
      type: "ZOD",
      issues: err.issues.map(i => ({
        path: i.path.join("."),
        message: i.message,
      })),
    };
  }

  if (err instanceof Error) {
    return {
      type: "GENERIC",
      message: err.message,
      stack: isDev ? err.stack : undefined,
    };
  }

  return {
    type: "UNKNOWN",
    error: JSON.stringify(err, null, 2), // 👈 FIXED
  };
}

export async function runWithLogging(label: string, fn: () => Promise<any>) {
  const start = Date.now();

  try {
    const result = await fn();

    const payload = {
      tag: label,
      ok: true,
      duration: Date.now() - start,
      result,
    };

    console.log(JSON.stringify(payload));

    return NextResponse.json(payload); // ✅ ALWAYS return Response
  } catch (err) {
    const formatted = formatError(err);

    const payload = {
      tag: label,
      ok: false,
      duration: Date.now() - start,
      error: formatted,
    };

    console.error(JSON.stringify(payload, null, isDev ? 2 : 0));

    return NextResponse.json(payload, { status: 500 }); // ✅ FIX
  }
}