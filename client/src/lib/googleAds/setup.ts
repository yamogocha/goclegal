// generate minimal high-intent search campaign structure for PI with strict keyword constraints
import { z } from "zod";
import { getOpenAI, GOC_LEGAL_BRAND_CONTEXT } from "@/lib/openai";
import { getCustomer } from "@/lib/googleAds";

const openai = getOpenAI();

const CampaignSchema = z.object({
  campaign: z.object({
    name: z.string(),
    type: z.literal("SEARCH"),
    dailyBudget: z.number().max(25),
    location: z.string(),
  }),
  adGroups: z.array(
    z.object({
      name: z.string(),
      keywords: z
        .array(
          z.string()
            .min(3)
            .max(40) // prevent "too many words in keyword" issues
            .refine((k) => k.split(" ").length <= 6, "too many words")
        )
        .min(5)
        .max(15),
      headlines: z.array(z.string().min(5).max(90)).min(3).max(8),
      descriptions: z.array(z.string().min(20).max(90)).min(2).max(4),
    })
  ).min(1).max(3),
});

export async function generateSearchCampaign({
  location = "Alameda CA",
}: {
  location?: string;
}) {
  const res = await openai.responses.parse({
    model: "gpt-5",
    input: [
      {
        role: "system",
        content: `${GOC_LEGAL_BRAND_CONTEXT}
You generate HIGH-INTENT Google Search Ads for a personal injury law firm.

STRICT RULES:
- ONLY generate high-intent buyer keywords
- NO broad or research keywords
- MAX 6 words per keyword
- Keep keywords short, natural, and common search phrases
- Use phrase or exact intent (no symbols needed)
- Avoid fluff or long-tail sentences
- Focus on car accident and personal injury only

GOAL:
- Maximize conversions with small budget ($25/day)
- Prioritize intent over volume
- Keep everything minimal and tight`,
      },
      {
        role: "user",
        content: `Generate a minimal Google Search campaign for location: ${location}

Requirements:
- 1 campaign
- 2–3 ad groups max
- Each ad group tightly themed
- Keywords must be short (<=6 words)
- No long sentences as keywords
- Headlines must be direct and conversion-focused
- Descriptions must qualify users (serious cases only)

Return clean structured output.`,
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "campaign",
        schema: CampaignSchema,
      },
    },
  });

  return res.output_parsed;
}

// create search campaign with intent-matched landing pages minimal and safe
export async function createSearchCampaign(opts: {
    location?: string;
    lat?: number;
    lng?: number;
    radiusMiles?: number;
    dryRun?: boolean;
  } = {}) {
    const {
      location = "Alameda CA",
      lat = 37.7652,
      lng = -122.2416,
      radiusMiles = 15,
      dryRun = false,
    } = opts;
  
    const customer = getCustomer();
    const data = await generateSearchCampaign({ location });
  
    if (dryRun) return { ok: true, preview: data };
  
    // landing page mapping by intent
    const getFinalUrl = (name: string) => {
      const n = name.toLowerCase();
      if (n.includes("auto") || n.includes("car")) return "https://www.goclegal.com/auto-accidents";
      if (n.includes("slip")) return "https://www.goclegal.com/slip-and-fall-injuries";
      if (n.includes("truck")) return "https://www.goclegal.com/trucking-accidents";
      if (n.includes("bicycle") || n.includes("bike")) return "https://www.goclegal.com/bicycle-accidents";
      if (n.includes("construction")) return "https://www.goclegal.com/construction-site-accidents";
      if (n.includes("brain") || n.includes("tbi")) return "https://www.goclegal.com/traumatic-brain-injury";
      if (n.includes("death") || n.includes("wrongful")) return "https://www.goclegal.com/wrongful-death";
      return "https://www.goclegal.com/auto-accidents"; // default high-intent fallback
    };
  
    // 1) budget
    const budget = await customer.campaignBudgets.create({
      name: `${data.campaign.name} Budget`,
      amount_micros: data.campaign.dailyBudget * 1_000_000,
      delivery_method: "STANDARD",
    });
  
    // 2) campaign
    const campaign = await customer.campaigns.create({
      name: data.campaign.name,
      advertising_channel_type: "SEARCH",
      status: "PAUSED",
      campaign_budget: budget.resource_name,
      manual_cpc: {},
      network_settings: {
        target_google_search: true,
        target_search_network: true,
        target_content_network: false,
        target_partner_search_network: false,
      },
    });
  
    // 3) hyper-local targeting
    const geoRows = await customer.query(`
      SELECT geo_target_constant.resource_name
      FROM geo_target_constant
      WHERE geo_target_constant.name LIKE '%${location.split(" ")[0]}%'
      LIMIT 1
    `);
  
    const geo = geoRows?.[0]?.geo_target_constant?.resource_name;
  
    if (geo) {
      await customer.campaignCriteria.create({
        campaign: campaign.resource_name,
        location: { geo_target_constant: geo },
      });
    }
  
    await customer.campaignCriteria.create({
      campaign: campaign.resource_name,
      proximity: {
        geo_point: {
          latitude_in_micro_degrees: Math.round(lat * 1e6),
          longitude_in_micro_degrees: Math.round(lng * 1e6),
        },
        radius: radiusMiles,
        radius_units: "MILES",
      },
    });
  
    const results: any = {
      campaign: campaign.resource_name,
      adGroups: [],
    };
  
    // 4) ad groups + intent-matched ads
    for (const ag of data.adGroups) {
      const finalUrl = getFinalUrl(ag.name);
  
      const adGroup = await customer.adGroups.create({
        name: ag.name,
        campaign: campaign.resource_name,
        type: "SEARCH_STANDARD",
        cpc_bid_micros: 2_000_000,
        status: "ENABLED",
      });
  
      // 5) keywords
      await customer.adGroupCriteria.create(
        ag.keywords.map((kw) => ({
          ad_group: adGroup.resource_name,
          status: "ENABLED",
          keyword: {
            text: kw,
            match_type: "PHRASE",
          },
        }))
      );
  
      // 6) responsive search ad with matched landing page
      await customer.adGroupAds.create({
        ad_group: adGroup.resource_name,
        status: "PAUSED",
        ad: {
          final_urls: [finalUrl],
          responsive_search_ad: {
            headlines: ag.headlines.map((h) => ({ text: h })),
            descriptions: ag.descriptions.map((d) => ({ text: d })),
          },
        },
      });
  
      results.adGroups.push({
        name: ag.name,
        resource: adGroup.resource_name,
        url: finalUrl,
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
    const callConversion = await customer.conversionActions.create({
      name: "Calls from Ads",
      type: "CALL_FROM_ADS",
      category: "LEAD",
      status: "ENABLED",
      value_settings: { default_value: 1, always_use_default_value: true },
      call_conversion_action: {
        call_duration_seconds: 30, // only count real calls
      },
    });
  
    // 2) create website form conversion (secondary)
    const formConversion = await customer.conversionActions.create({
      name: "Form Submissions",
      type: "WEBPAGE",
      category: "LEAD",
      status: "ENABLED",
      value_settings: { default_value: 1, always_use_default_value: true },
    });
  
    // 3) enable call reporting at campaign level
    await customer.campaigns.update({
      resource_name: campaignResourceName,
      call_reporting_setting: {
        call_reporting_enabled: true,
        call_conversion_action: callConversion.resource_name,
      },
    });
  
    // 4) (optional but recommended) switch to maximize conversions
    await customer.campaigns.update({
      resource_name: campaignResourceName,
      maximize_conversions: {},
    });
  
    return {
      ok: true,
      result: {
        callConversion: callConversion.resource_name,
        formConversion: formConversion.resource_name,
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
    const callAsset = await customer.assets.create({
      call_asset: {
        phone_number: phoneNumber,
        country_code: countryCode,
        call_tracking_enabled: true,
      },
    });
  
    // 2) attach asset to campaign
    await customer.campaignAssets.create({
      campaign: campaignResourceName,
      asset: callAsset.resource_name,
      field_type: "CALL",
    });
  
    return {
      ok: true,
      result: {
        asset: callAsset.resource_name,
        campaign: campaignResourceName,
      },
    };
  }