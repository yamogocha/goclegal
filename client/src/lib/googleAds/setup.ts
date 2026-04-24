// strict generation only: enforce tighter headline length to avoid overflow at source
import { z } from "zod";
import { getOpenAI, GOC_LEGAL_BRAND_CONTEXT } from "@/lib/openai";
import { getCustomer } from "./index";

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

KEYWORDS:
- 6–8 per group
- <= 40 chars
- <= 6 words
- include oakland
- high intent only

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

export async function createSearchCampaign({
  location = "Oakland CA",
  lat = 37.7652,
  lng = -122.2416,
  radiusMiles = 15,
  dryRun = false,
} = {}) {
  const customer = getCustomer();
  const data = await generateSearchCampaign(location);

  if (dryRun) return { ok: true, preview: data };

  const budget = await customer.campaignBudgets.create([{
    name: `${data.campaign.name} Budget`,
    amount_micros: data.campaign.dailyBudget * 1e6,
    delivery_method: "STANDARD",
  }]);

  const campaign = await customer.campaigns.create([{
    name: data.campaign.name,
    advertising_channel_type: "SEARCH",
    status: "PAUSED",
    campaign_budget: budget.results?.[0]?.resource_name,
    manual_cpc: {},
  }]);

  const campaignRes = campaign.results?.[0]?.resource_name;
  if (!campaignRes) throw new Error("campaign failed");

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

  const results: any = { campaign: campaignRes, adGroups: [] };

  for (const ag of data.adGroups) {
    const adGroup = await customer.adGroups.create([{
      name: ag.name,
      campaign: campaignRes,
      type: "SEARCH_STANDARD",
      cpc_bid_micros: 2_000_000,
      status: "ENABLED",
    }]);

    const agRes = adGroup.results?.[0]?.resource_name;
    if (!agRes) continue;

    await customer.adGroupCriteria.create(
      ag.keywords.map((k) => ({
        ad_group: agRes,
        status: "ENABLED",
        keyword: { text: k, match_type: "PHRASE" },
      }))
    );

    await customer.adGroupAds.create([{
      ad_group: agRes,
      status: "PAUSED",
      ad: {
        final_urls: ["https://www.goclegal.com/auto-accidents"],
        responsive_search_ad: {
          headlines: ag.headlines.map((h) => ({ text: h })),
          descriptions: ag.descriptions.map((d) => ({ text: d })),
        },
      },
    }]);

    results.adGroups.push({
      name: ag.name,
      resource: agRes,
      keywords: ag.keywords.length,
    });
  }

  return { ok: true, result: results };
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