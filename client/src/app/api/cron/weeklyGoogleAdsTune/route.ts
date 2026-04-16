import { weeklyAdsOptimizer } from "@/lib/budgetMonitor";
import { verifyCronAuth } from "@/lib/oauth";


export async function GET(req: Request) {
  const unauthorized = verifyCronAuth(req);
  if (unauthorized) return unauthorized;

  await weeklyAdsOptimizer();
  return Response.json({ ok: true });
}

export async function POST(req: Request) {
  const { searchParams } = new URL(req.url);
  const dryRun = searchParams.get("dryRun") === "true";

  try {
    await weeklyAdsOptimizer({ dryRun });

    return Response.json({
      ok: true,
      dryRun
    });
  } catch (err: unknown) {
    console.error("[BUDGET ERROR]", err);
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