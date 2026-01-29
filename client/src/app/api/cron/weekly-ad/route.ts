import { NextResponse } from "next/server";
import { generateWeeklyAd } from "../../ad/generate/route";

export async function GET(req: Request) {
  // 🔐 Verify cron secret
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = generateWeeklyAd()
    return NextResponse.json({ ok: true, ...result });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Cron failed" },
      { status: 500 }
    );
  }
}