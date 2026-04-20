// client/src/app/api/cron/weeklyGoogleAdsTune/route.ts
import { weeklyGoogleAdsTune } from "@/lib/budgetMonitor";
import { verifyCronAuth } from "@/lib/oauth";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const unauthorized = verifyCronAuth(req);
  if (unauthorized) return unauthorized;

  const { searchParams } = new URL(req.url);
  const dryRun = searchParams.get("dryRun") === "true";

  try {
    await weeklyGoogleAdsTune({ dryRun });

    return Response.json({ ok: true });
  } catch (err) {
    console.error("[WEEKLY ADS OPTIMIZER ERROR]", err);

    return Response.json(
      { ok: false, error: String(err) },
      { status: 500 }
    );
  }
}