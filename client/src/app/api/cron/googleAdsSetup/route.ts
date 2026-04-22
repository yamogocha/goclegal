// api/cron/googleAdsSetup/route.ts
// one-time google ads setup pipeline (campaign + conversions + call extension) minimal and observable
import { NextRequest, NextResponse } from "next/server";
import { createSearchCampaign, setupConversionsAndCalls, setupCallExtension } from "@/googleAds/setup";
import { verifyCronAuth } from "@/lib/oauth";

export async function POST(req: NextRequest) {
  try {
    verifyCronAuth(req);

    const { location, phoneNumber, dryRun } = await req.json();

    const logs: any = {
      step1_campaign: null,
      step2_conversions: null,
      step3_callExtension: null,
    };

    // 1) create campaign
    const campaignRes = await createSearchCampaign({ location, dryRun });
    logs.step1_campaign = campaignRes;

    if (!campaignRes?.result?.campaign) {
      return NextResponse.json({ ok: false, error: "Campaign creation failed", logs });
    }

    const campaignResourceName = campaignRes.result.campaign;

    // 2) conversions + call optimization
    const convRes = await setupConversionsAndCalls({
      campaignResourceName,
      dryRun,
    });
    logs.step2_conversions = convRes;

    // 3) call extension
    const callRes = await setupCallExtension({
      campaignResourceName,
      phoneNumber,
      dryRun,
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