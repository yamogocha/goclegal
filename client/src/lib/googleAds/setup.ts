// strict generation only: enforce tighter headline length to avoid overflow at source
import { z, ZodError } from "zod";
import { getOpenAI, GOC_LEGAL_BRAND_CONTEXT } from "@/lib/openai";
import { getCustomer } from "./index";
import { NextResponse } from "next/server";

const openai = getOpenAI();

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
      keywords: z
        .array(
          z
            .string()
            .min(3)
            .max(40)
            .refine(k => !/[\[\]"+]/.test(k), "no match types")
            .refine(k => k.split(" ").length <= 6, "max 6 words")
            .refine(k => /(lawyer|attorney|injury|accident|claim)/i.test(k), "high intent")
        )
        .min(5)
        .max(10),
      headlines: z
        .array(
          z
            .string()
            .min(12)
            .max(30)
            .refine(h => /(lawyer|attorney|injury|accident|claim|case)/i.test(h), "must be relevant")
        )
        .min(3)
        .max(5),
      descriptions: z
        .array(
          z
            .string()
            .min(40)
            .max(90)
            .refine(d => /[.!?]$/.test(d), "must end with punctuation")
        )
        .min(2)
        .max(3),
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

export async function generateSearchCampaign(location = "Oakland CA") {
  const res = await openai.responses.parse({
    model: "gpt-5",
    input: [
      {
        role: "system",
        content: `
${GOC_LEGAL_BRAND_CONTEXT}

Generate Google Search Ads with strict rules.

HEADLINES (CRITICAL):
- EXACTLY 4 per ad group
- HARD TARGET: 20–26 characters (not 30)
- NEVER exceed 28 characters (safety buffer)
- If near 28, shorten wording BEFORE returning
- Prefer 3–5 words max

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

KEYWORDS (STRICT + POLICY SAFE):

Generate 6–8 keywords per ad group.

ALLOWED INTENT (REQUIRED):
- must include one of:
  lawyer, attorney

SAFE PHRASES:
- accident lawyer
- personal injury attorney
- injury lawyer

POLICY RULES (CRITICAL):
- DO NOT combine "injury" with "accident"
- DO NOT combine "injury" with specific events
- DO NOT use phrases like:
  injury claim, accident injury, fall injury
- DO NOT imply a person’s condition

SAFE STRUCTURE:
- use EITHER:
  [location] + accident lawyer
  OR
  [location] + personal injury attorney
  OR
  [location] + injury lawyer

FORMAT:
- include "oakland"
- <= 6 words
- <= 40 characters
- lowercase only

SELF-CHECK (REQUIRED):
Reject and rewrite if:
- contains "accident injury"
- contains "injury claim"
- contains event + injury combo
- exceeds 40 characters

If ANY keyword fails, rewrite it before returning.

DESCRIPTIONS:

Generate EXACTLY 3 descriptions per ad group.

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


// prevent Vercel timeout + always return JSON

const MAX_DURATION_MS = 8000; // keep safely under Vercel limit (~10s hobby)

function createTimer() {
  const start = Date.now();
  return () => Date.now() - start > MAX_DURATION_MS;
}

export async function createSearchCampaign(opts: CreateCampaignOpts = {}) {
  const {
    location = "Oakland CA",
    lat = 37.7652,
    lng = -122.2416,
    radiusMiles = 15,
    dryRun = false,
  } = opts;

  const isTimedOut = createTimer();

  const customer = getCustomer();
  const logs: any[] = [];
  let details: any[] = [];

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

    if (isTimedOut()) throw new Error("timeout_before_campaign");

    const budgetRes = await getOrCreateBudget(
      customer,
      `${data.campaign.name} Budget`,
      data.campaign.dailyBudget * 1e6
    );

    const campaign = await customer.campaigns.create([{
      name: `${data.campaign.name} ${Date.now().toString().slice(-4)}`,
      advertising_channel_type: "SEARCH",
      status: "PAUSED",
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

    for (const ag of data.adGroups) {
      if (isTimedOut()) {
        return {
          ok: false,
          error: "timeout_partial",
          details,
          logs,
          result: { campaign: campaignRes },
        };
      }

      try {
        const adGroup = await customer.adGroups.create([{
          name: `${ag.name} ${Date.now().toString().slice(-3)}`,
          campaign: campaignRes,
          type: "SEARCH_STANDARD",
          cpc_bid_micros: 2_000_000,
          status: "PAUSED",
        }]);

        const agRes = adGroup.results?.[0]?.resource_name;
        if (!agRes) throw new Error("adgroup failed");

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

        try {
          await customer.adGroupAds.create([{
            ad_group: agRes,
            status: "PAUSED",
            ad: {
              final_urls: ["https://www.goclegal.com/auto-accidents"],
              responsive_search_ad: {
                headlines: ag.headlines.map(h => ({ text: h })),
                descriptions: ag.descriptions.map(d => ({ text: d })),
              },
            },
          }]);
        } catch (e: any) {
          details.push({ step: "ads", ag: ag.name, error: e.message });
        }

      } catch (e: any) {
        details.push({ step: "adgroup", ag: ag.name, error: e.message });
      }
    }

    const ok = details.length === 0;

    return {
      ok,
      error: ok ? null : "partial_failure",
      details,
      logs,
      result: { campaign: campaignRes },
    };

  } catch (e: any) {
    return {
      ok: false,
      error: e?.message || "fatal_error",
      details,
      logs,
      result: null,
    };
  }
}

// create conversion tracking + call optimization and attach to campaign minimal and scalable
export async function setupConversionsAndCalls(opts: {
    campaignResourceName: string;
    dryRun?: boolean;
  } ) {
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
  
    // 1) create call conversion (primary)
    const callConversion = await customer.conversionActions.create([
      {
        name: "Calls from Ads",
        type: "AD_CALL",
        category: "DEFAULT",
        status: "ENABLED",
        value_settings: { default_value: 1, always_use_default_value: true },
      },
    ]);
    const callConversionResourceName = callConversion.results?.[0]?.resource_name;
    if (!callConversionResourceName) throw new Error("Failed to create call conversion");
  
    // 2) create website form conversion (secondary)
    const formConversion = await customer.conversionActions.create([
      {
        name: "Form Submissions",
        type: "WEBPAGE",
        category: "DEFAULT",
        status: "ENABLED",
        value_settings: { default_value: 1, always_use_default_value: true },
      },
    ]);
    const formConversionResourceName = formConversion.results?.[0]?.resource_name;
    if (!formConversionResourceName) throw new Error("Failed to create form conversion");
  
    // 3) enable call reporting at campaign level
    await customer.campaigns.update([
      {
        resource_name: campaignResourceName,
        call_reporting_setting: {
          call_reporting_enabled: true,
          call_conversion_action: callConversionResourceName,
        },
      },
    ] as any);
  
    // 4) (optional but recommended) switch to maximize conversions
    await customer.campaigns.update([
      {
        resource_name: campaignResourceName,
        maximize_conversions: {},
      },
    ]);
  
    return {
      ok: true,
      result: {
        callConversion: callConversionResourceName,
        formConversion: formConversionResourceName,
        campaign: campaignResourceName,
      },
    };
  }

// create call extension (asset) and attach to campaign minimal and scalable
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
  
    // 1) create call asset
    const callAsset = await customer.assets.create([
      {
        call_asset: {
          phone_number: phoneNumber,
          country_code: countryCode,
        },
      },
    ]);
    const callAssetResourceName = callAsset.results?.[0]?.resource_name;
    if (!callAssetResourceName) throw new Error("Failed to create call asset");
  
    // 2) attach asset to campaign
    await customer.campaignAssets.create([
      {
        campaign: campaignResourceName,
        asset: callAssetResourceName,
        field_type: "CALL",
      },
    ]);
  
    return {
      ok: true,
      result: {
        asset: callAssetResourceName,
        campaign: campaignResourceName,
      },
    };
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