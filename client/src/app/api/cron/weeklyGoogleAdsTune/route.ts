// client/src/app/api/cron/weeklyAdsOptimizer/route.ts

import { weeklyAdsOptimizer } from "@/lib/budgetMonitor";
import { verifyCronAuth } from "@/lib/oauth";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const unauthorized = verifyCronAuth(req);
  if (unauthorized) return unauthorized;

  const { searchParams } = new URL(req.url);
  const dryRun = searchParams.get("dryRun") === "true";

  try {
    const result = await weeklyAdsOptimizer({ dryRun });

    return Response.json({
      ok: true,
      dryRun,
      result,
    });
  } catch (err: unknown) {
    console.error("[WEEKLY ADS OPTIMIZER ERROR]", err);

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