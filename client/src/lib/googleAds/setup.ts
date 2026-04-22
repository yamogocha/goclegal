// minimal campaign generation + creation with strict OpenAI schema and safe typing
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { getOpenAI, GOC_LEGAL_BRAND_CONTEXT } from "@/lib/openai";
import { getCustomer } from "./index";

const openai = getOpenAI();

const CampaignSchema = z.object({
  campaign: z.object({
    name: z.string(),
    type: z.literal("SEARCH"),
    dailyBudget: z.number().max(25),
    location: z.string(),
  }).strict(),
  adGroups: z.array(
    z.object({
      name: z.string(),
      keywords: z.array(
        z.string().min(3).max(40).refine(k => k.split(" ").length <= 6)
      ).min(5).max(12),
      headlines: z.array(z.string().min(5).max(90)).min(3).max(6),
      descriptions: z.array(z.string().min(20).max(90)).min(2).max(3),
    }).strict()
  ).min(1).max(3),
}).strict();

// fix: ensure correct schema shape without TS conflict
const campaignJsonSchema = zodToJsonSchema(
  CampaignSchema as unknown as any,
  "campaign"
);

export async function generateSearchCampaign(location = "Oakland CA") {
  const res = await openai.responses.parse({
    model: "gpt-5",
    input: [
      {
        role: "system",
        content: `${GOC_LEGAL_BRAND_CONTEXT}
Generate high-intent Google Search Ads.

Rules:
- buyer intent only
- <=6 words per keyword
- short phrases only
- no fluff
- focus car accident + injury
- optimize for $25/day`,
      },
      {
        role: "user",
        content: `Create minimal campaign for ${location} with 1 campaign and 2-3 tight ad groups.`,
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "campaign",
        schema: campaignJsonSchema,
      },
    },
  });

  const parsed = res.output_parsed;
  if (!parsed) throw new Error("no parsed output");

  return parsed; // fully typed as CampaignData
}

export async function createSearchCampaign({
  location = "Alameda CA",
  lat = 37.7652,
  lng = -122.2416,
  radiusMiles = 15,
  dryRun = false,
} = {}) {
  const customer = getCustomer();
  const data = await generateSearchCampaign(location);
  if (!data) throw new Error("no data");
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
      ag.keywords.map(k => ({
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
          headlines: ag.headlines.map(h => ({ text: h })),
          descriptions: ag.descriptions.map(d => ({ text: d })),
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