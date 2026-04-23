// strict generation only: no patching, no cleaning, enforce structure + syntax at source
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

Generate Google Search Ads with strict rules:

KEYWORDS:

Generate EXACTLY 6–8 keywords per ad group.

ROLE DISTRIBUTION:
- Core (2–3): direct hire intent; must include "lawyer" or "attorney"
- Variant (2–3): close variations of core terms; still high intent
- Situation (2): specific accident or legal scenarios; must still imply hiring intent

STRUCTURE RULES:
- lowercase only
- include location "oakland"
- <= 40 characters per keyword
- 3–5 words preferred
- concise phrasing (avoid long or stacked terms)

INTENT RULES:
- high intent only: include at least one of "lawyer", "attorney", "injury", "accident", or "claim"
- no informational queries

RELEVANCE RULES:
- must match the ad group topic exactly
- do not include general personal injury terms in specific groups

DEDUPLICATION RULES:
- no duplicates or near-duplicates
- each keyword must introduce distinct search intent (not simple rewording)

FORMATTING RULES:
- no match types (no [], "", +)
- no special symbols

HEADLINES:

Generate EXACTLY 4 headlines per ad group.

ROLE ASSIGNMENT:
Each headline MUST serve one unique role:
1. Authority — credibility (e.g., Former DA, years)
2. Outcome — results or case strength
3. Process — how the case is handled
4. Risk — urgency with consequence (MAX 1)

STRUCTURE RULES:
- 12–30 characters per headline
- target 22–28 characters
- Title Case
- natural, complete phrases (no truncation, no awkward wording)
- avoid comma fragments (e.g., "Proof Lost, Call Attorney")
- keep phrasing concise; remove unnecessary words
- if a headline exceeds 30 characters, rewrite it shorter before returning

INTENT RULES:
- each headline must include at least one of:
  lawyer, attorney, injury, accident, claim, or case

ROLE-SPECIFIC RULES:

AUTHORITY:
- must signal credibility (e.g., Former DA, 20+ Years)
- keep phrasing short and compressed (avoid long titles)

OUTCOME:
- must clearly express results or case strength
- use natural phrasing (no shorthand like "lawyer results")

PROCESS:
- must describe how the case is handled (access, strategy, or evidence)
- avoid repeating the same phrasing across groups

RISK:
- must include urgency AND consequence (e.g., deadlines, evidence loss)
- only ONE risk headline per group

DEDUPLICATION:
- no repeated roles within a group
- no repeated phrasing within a group

AVOID:
- generic filler words like "help"DESCRIPTIONS:

Generate EXACTLY 3 descriptions per ad group.

ROLE ASSIGNMENT:
Each description MUST serve one unique role:
1. Authority — credibility
2. Outcome — case strength or results (no guarantees)
3. Process OR Risk — handling approach OR urgency (not both)

STRUCTURE RULES:
- 40–90 characters per description
- complete sentences ending with punctuation
- natural, fluent English (no truncation or broken grammar)

ROLE-SPECIFIC RULES:

AUTHORITY:
- clearly convey credibility (e.g., former DA, experience, boutique firm)

OUTCOME:
- describe results or case strength without guarantees
- use clear, neutral phrasing (no hype)

PROCESS:
- explain how the case is handled (evidence, strategy, or access)

RISK:
- include urgency with consequence (deadline, evidence loss)

PROOF CONSTRAINT:
- max ONE numeric proof statement per campaign

DEDUPLICATION:
- each description must express a different idea
- no repeated concepts or rewording

GENERAL:
- no brand mixing unless intentional
- tone: professional, credible, calm
- avoid generic filler phrases (e.g., "call now", "get help today")
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