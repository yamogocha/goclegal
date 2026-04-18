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

    return Response.json({
      ok: true,
      preview,
      dryRun,
      result,
    });
  } catch (err: unknown) {
    console.error("[WEEKLY AD ERROR]", err);

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