// api/cron/googleAdsSetup/route.ts
import { NextRequest, NextResponse } from "next/server";
import {
  createSearchCampaign,
  setupConversionsAndCalls,
  setupCallExtension,
  runWithLogging,
  generateSearchCampaign,
} from "@/lib/googleAds/setup";
import { verifyCronAuth } from "@/lib/oauth";


// // phase-based execution to avoid timeout
export async function POST(req: NextRequest) {
  const logs: any = {
    step1_generate: null,
    step2_execute: null,
    step3_conversions: null,
    step4_callExtension: null,
  };

  try {
    verifyCronAuth(req);

    const body = await req.json().catch(() => ({}));

    const {
      location = "Oakland CA",
      phoneNumber = "+15108460928",
      mode = "generate", // // NEW
      data = null,       // // NEW
    } = body;

    // // STEP 1: GENERATE ONLY (fast enough)
    if (mode === "generate") {
      const generated = await generateSearchCampaign(location);

      logs.step1_generate = {
        ok: true,
        adGroups: generated.adGroups.length,
      };

      return NextResponse.json({
        ok: true,
        mode: "generate",
        data: generated, // // return to script
        logs,
      });
    }

    // // STEP 2: EXECUTE ONLY (NO AI)
    if (mode === "execute") {
      if (!data) {
        return NextResponse.json({
          ok: false,
          error: "missing_data",
          logs,
        });
      }

      const campaignRes = await createSearchCampaign({
        location,
        data, // // skip AI
      });

      logs.step2_execute = campaignRes;

      if (!campaignRes?.ok || !campaignRes?.result?.campaign) {
        return NextResponse.json({
          ok: false,
          error: campaignRes?.error || "campaign_failed",
          details: campaignRes?.details,
          logs,
        });
      }

      const campaignResourceName = campaignRes.result.campaign;

      // conversions
      const convRes = await setupConversionsAndCalls({ campaignResourceName });
      logs.step3_conversions = convRes;

      // call extension
      const callRes = await setupCallExtension({
        campaignResourceName,
        phoneNumber,
      });
      logs.step4_callExtension = callRes;

      return NextResponse.json({
        ok: true,
        campaignResourceName,
        logs,
      });
    }

    return NextResponse.json({ ok: false, error: "invalid_mode" });

  } catch (err: any) {
    return NextResponse.json({
      ok: false,
      error: err?.message || "route_crash",
      logs,
    }, { status: 500 });
  }
}

export async function GET() {
  
  return runWithLogging("GOOGLE_ADS_SETUP", async () => {
    return await createSearchCampaign({ dryRun: false });
  });
}