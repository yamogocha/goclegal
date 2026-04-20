// client/src/app/api/cron/googleAds/route.ts

import { resetAICallCount } from "@/lib/budgetMonitor";
import {
  runGoogleAdsEngine,
  // runNegativeKeywordCleanup,
} from "@/lib/googleAds";
import { verifyCronAuth } from "@/lib/oauth";

export const runtime = "nodejs";

export async function POST(req: Request) {
  console.log("GOOGLE ADS ROUTE VERSION: v2-clean-engine");
  const unauthorized = verifyCronAuth(req);
  if (unauthorized) return unauthorized;

  const { searchParams } = new URL(req.url);
  const dryRun = searchParams.get("dryRun") === "true";

  resetAICallCount();

  try {
    const runGoogleAdsResult = await runGoogleAdsEngine({ dryRun });
    // const negativeKeywordResult = await runNegativeKeywordCleanup({ dryRun });

    return Response.json({
      ok: true,
      dryRun,
      runGoogleAdsResult,
      // negativeKeywordResult,
    });
  } catch (err: unknown) {
    console.error("[GOOGLE ADS ERROR]", err);

    let message: string;

    if (err instanceof Error) {
      message = err.message;
    } else if (typeof err === "object" && err !== null) {
      message = JSON.stringify(err, null, 2);
    } else {
      message = String(err);
    }

    return Response.json(
      {
        ok: false,
        error: message,
      },
      { status: 500 }
    );
  }
}