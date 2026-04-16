import { resetAICallCount } from "@/lib/budgetMonitor";
import { optimizeAds, runSearchTermMining, runNegativeKeywordCleanup, manageGoogleAds } from "@/lib/googleAds";
import { verifyCronAuth } from "@/lib/oauth";


export const runtime = "nodejs";

export async function GET(req: Request) {
  const unauthorized = verifyCronAuth(req);
  if (unauthorized) return unauthorized;

  await manageGoogleAds()
}

export async function POST(req: Request) {
  const { searchParams } = new URL(req.url);
  const dryRun = searchParams.get("dryRun") === "true";

  resetAICallCount();

  try {
    const optimizeAdsResult =  await optimizeAds({ dryRun });
    const searchTermReuslt = await runSearchTermMining({ dryRun });
    const negativeKeywordResult = await runNegativeKeywordCleanup({ dryRun });


    return Response.json({
      ok: true,
      dryRun,
      optimizeAdsResult,
      searchTermReuslt,
      negativeKeywordResult,
    });
  } catch (err: unknown) {
    console.error("[ERROR FULL]", err);
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({
      ok: false,
      error: message
    }, { status: 500 });
  } 
}