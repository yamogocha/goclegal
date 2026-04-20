// client/src/app/api/cron/googleAds/route.ts
import { resetAICallCount } from "@/lib/budgetMonitor";
import { runKeywordExpansion } from "@/lib/googleAds";
import { verifyCronAuth } from "@/lib/oauth";

export const runtime = "nodejs";

export async function POST(req: Request): Promise<Response> {
  const unauthorized = verifyCronAuth(req);
  if (unauthorized) return unauthorized;

  const { searchParams } = new URL(req.url);
  const dryRun = searchParams.get("dryRun") === "true";

  try {
    resetAICallCount();

    const result = await runKeywordExpansion({ dryRun });

    return Response.json({ ok: true, result });
  } catch (err) {
    console.error("[GOOGLE ADS ERROR]", err);

    return Response.json(
      { ok: false, error: String(err) },
      { status: 500 }
    );
  }
}