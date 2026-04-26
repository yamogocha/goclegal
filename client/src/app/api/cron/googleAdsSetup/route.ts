// api/cron/googleAdsSetup/route.ts
import { NextRequest, NextResponse } from "next/server";
import {
  createSearchCampaign,
  setupConversionsAndCalls,
  setupCallExtension,
  runWithLogging,
  extractError,
} from "@/lib/googleAds/setup";
import { verifyCronAuth } from "@/lib/oauth";


// // production-safe route with guaranteed error visibility
export async function POST(req: NextRequest) {
  const logs: any = {
    step1_campaign: null,
    step2_conversions: null,
    step3_callExtension: null,
  };

  try {
    verifyCronAuth(req);

    // // safe parse (never throw)
    let body: any = {};
    try {
      const raw = await req.text();
      body = raw ? JSON.parse(raw) : {};
    } catch (e: any) {
      return NextResponse.json({
        ok: false,
        error: "invalid_json_body",
        details: [{ raw: String(e) }],
        logs,
      }, { status: 400 });
    }

    const {
      location = "Oakland CA",
      phoneNumber = "+15108460928",
      dryRun = false,
    } = body;

    // // 1) campaign
    const campaignRes = await createSearchCampaign({ location, dryRun });
    logs.step1_campaign = campaignRes;

    if (dryRun) {
      return NextResponse.json({
        ok: true,
        dryRun: true,
        logs,
      });
    }

    // // propagate real failure (THIS was missing)
    if (!campaignRes?.ok || !campaignRes?.result?.campaign) {
      return NextResponse.json({
        ok: false,
        error: campaignRes?.error || "campaign_failed",
        details: campaignRes?.details || [{ fallback: "no_details" }],
        logs,
      });
    }

    const campaignResourceName = campaignRes.result.campaign;

    // // enable campaign + full visibility for conversions and call extension

  // 2) FIX ROUTE ERROR VISIBILITY (replace step2 + step3 blocks)

  try {
    const convRes = await setupConversionsAndCalls({
      campaignResourceName,
    });
    logs.step2_conversions = convRes;
  } catch (e: any) {
    const err = extractError(e);
    logs.step2_conversions = {
      ok: false,
      error: err.error,
      details: err.details,
    };
  }

  try {
    const callRes = await setupCallExtension({
      campaignResourceName,
      phoneNumber,
    });
    logs.step3_callExtension = callRes;
  } catch (e: any) {
    const err = extractError(e);
    logs.step3_callExtension = {
      ok: false,
      error: err.error,
      details: err.details,
    };
  }

    return NextResponse.json({
      ok: true,
      campaignResourceName,
      logs,
    });

  } catch (err: any) {
    // // final fallback (never empty)
    let raw: any;
    try {
      raw = JSON.stringify(err, null, 2);
    } catch {
      raw = String(err);
    }

    return NextResponse.json({
      ok: false,
      error: err?.message || "route_crash",
      details: [{ raw }],
      logs,
    }, { status: 500 });
  }
}


export async function GET() {
  
  return runWithLogging("GOOGLE_ADS_SETUP", async () => {
    return await createSearchCampaign({ dryRun: false });
  });
}