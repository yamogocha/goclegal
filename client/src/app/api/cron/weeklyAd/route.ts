// client/src/app/api/cron/weeklyAd/route.ts

import { verifyCronAuth } from "@/lib/oauth";
import { generateWeeklyAd } from "@/lib/weeklyAd";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const unauthorized = verifyCronAuth(req);
  if (unauthorized) return unauthorized;

  const { searchParams } = new URL(req.url);
  const preview = searchParams.get("preview") === "true";
  const dryRun = searchParams.get("dryRun") === "true";

  try {
    const result = await generateWeeklyAd({ preview, dryRun });

    return Response.json({ ok: true, result });
  } catch (err) {
    console.error("[WEEKLY AD ERROR]", err);

    return Response.json(
      { ok: false, error: String(err) },
      { status: 500 }
    );
  }
}