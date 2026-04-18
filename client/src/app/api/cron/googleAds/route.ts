// client/src/app/api/cron/googleAds/route.ts

import { resetAICallCount } from "@/lib/budgetMonitor";
import {
  optimizeAds,
  runSearchTermMining,
  runNegativeKeywordCleanup,
} from "@/lib/googleAds";
import { verifyCronAuth } from "@/lib/oauth";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const unauthorized = verifyCronAuth(req);
  if (unauthorized) return unauthorized;

  const { searchParams } = new URL(req.url);
  const dryRun = searchParams.get("dryRun") === "true";

  resetAICallCount();

  try {
    const optimizeAdsResult = await optimizeAds({ dryRun });
    const searchTermResult = await runSearchTermMining({ dryRun });
    const negativeKeywordResult = await runNegativeKeywordCleanup({ dryRun });

    return Response.json({
      ok: true,
      dryRun,
      optimizeAdsResult,
      searchTermResult,
      negativeKeywordResult,
    });
  } catch (err: unknown) {
    console.error("[GOOGLE ADS ERROR]", err);

    const message = err instanceof Error ? err.message : String(err);

    return Response.json(
      {
        ok: false,
        error: message,
      },
      { status: 500 }
    );
  }
}