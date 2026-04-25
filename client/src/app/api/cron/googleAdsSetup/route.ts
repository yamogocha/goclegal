// api/cron/googleAdsSetup/route.ts
import { NextRequest, NextResponse } from "next/server";
import {
  createSearchCampaign,
  setupConversionsAndCalls,
  setupCallExtension,
  runWithLogging,
} from "@/lib/googleAds/setup";
import { verifyCronAuth } from "@/lib/oauth";

export async function POST(req: NextRequest) {
  try {
    verifyCronAuth(req);

    const raw = await req.text();
    const body = raw ? JSON.parse(raw) : {};

    const {
      location = "Oakland CA",
      phoneNumber = "5108460928",
      dryRun = false,
    } = body;

    const logs: any = {
      step1_campaign: null,
      step2_conversions: null,
      step3_callExtension: null,
    };

    // 1) campaign (generate or create)
    const campaignRes = await createSearchCampaign({ location, dryRun });
    logs.step1_campaign = campaignRes;

    // correct dryRun handling (this is what was broken)
    if (dryRun) {
      return NextResponse.json({
        ok: true,
        dryRun: true,
        logs,
      });
    }

    // real run requires result
    const campaignResourceName = campaignRes?.result?.campaign;
    if (!campaignResourceName) {
      return NextResponse.json({
        ok: false,
        error: "Campaign creation failed",
        logs,
      });
    }

    // 2) conversions
    const convRes = await setupConversionsAndCalls({
      campaignResourceName,
    });
    logs.step2_conversions = convRes;

    // 3) call extension
    const callRes = await setupCallExtension({
      campaignResourceName,
      phoneNumber,
    });
    logs.step3_callExtension = callRes;

    return NextResponse.json({
      ok: true,
      campaignResourceName,
      logs,
    });

  } catch (err: any) {
    return NextResponse.json({
      ok: false,
      error: err.message,
      stack: err.stack,
    });
  }
}


export async function GET() {
  
  return runWithLogging("GOOGLE_ADS_SETUP", async () => {
    return await createSearchCampaign({ dryRun: false });
  });
}