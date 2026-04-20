// client/src/app/api/cron/googleAds/route.ts

import { resetAICallCount } from "@/lib/budgetMonitor";
import {
  runGoogleAdsEngine,
  // runNegativeKeywordCleanup,
} from "@/lib/googleAds";
import { verifyCronAuth } from "@/lib/oauth";

export const runtime = "nodejs";

export async function POST(req: Request): Promise<Response> {
  // HARD STOP TEST
  return new Response("ROUTE HARD STOP", { status: 500 });

  const unauthorized = verifyCronAuth(req);
  if (unauthorized) return unauthorized;

  const { searchParams } = new URL(req.url);
  const dryRun = searchParams.get("dryRun") === "true";

  resetAICallCount();

  try {
    const runGoogleAdsResult = await runGoogleAdsEngine({ dryRun });

    return Response.json({
      ok: true,
      dryRun,
      runGoogleAdsResult,
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error
        ? err.message
        : typeof err === "object" && err !== null
        ? JSON.stringify(err, null, 2)
        : String(err);

    return Response.json(
      { ok: false, error: message },
      { status: 500 }
    );
  }
}