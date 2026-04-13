import { resetAICallCount } from "@/lib/budgetMonitor";
import { optimizeAds, runSearchTermMining, runNegativeKeywordCleanup } from "@/lib/googleAds";


export const runtime = "nodejs";

export async function GET() {

  try {
    resetAICallCount(); // 🔥 reset at start
    await optimizeAds(); // fix bad ads
    await runSearchTermMining();      // Add winners
    await runNegativeKeywordCleanup(); // Remove waste

    return Response.json({ ok: true });
  } catch (err: unknown) {
    console.error(err);
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: message }, { status: 500 });
  }
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