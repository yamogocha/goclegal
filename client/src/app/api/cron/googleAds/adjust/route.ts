// no change needed except naming consistency
import { weeklyAdjustments } from "@/lib/googleAds/adjust";
import { verifyCronAuth } from "@/lib/oauth";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const unauthorized = verifyCronAuth(req);
  if (unauthorized) return unauthorized;

  const { searchParams } = new URL(req.url);
  const dryRun = searchParams.get("dryRun") === "true";

  const result = await weeklyAdjustments({ dryRun });

  if (!result.ok) {
    console.error("[WEEKLY ADS ERROR FULL]", JSON.stringify(result, null, 2));
    return Response.json(result, { status: 500 });
  }

  return Response.json(result);
}