// client/src/app/api/cron/weeklyGoogleAdsTune/route.ts
// adjusts ad schedule, device bids
import { weeklyGoogleAdsTune } from "@/lib/googleAds/adjustment";
import { runAdCopyOptimization } from "@/lib/googleAds/optimize";
import { verifyCronAuth } from "@/lib/oauth";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const unauthorized = verifyCronAuth(req);
  if (unauthorized) return unauthorized;

  const { searchParams } = new URL(req.url);
  const dryRun = searchParams.get("dryRun") === "true";

  try {
    await weeklyGoogleAdsTune({ dryRun });
    const adCopyOptimization = await runAdCopyOptimization({ dryRun });

    return Response.json({ ok: true, adCopyOptimization });
  } catch (err) {
    console.error("[WEEKLY ADS OPTIMIZER ERROR]", err);

    return Response.json(
      { ok: false, error: String(err) },
      { status: 500 }
    );
  }
}