import { NextResponse } from "next/server";
import { verifyCronAuth } from "@/lib/oauth";
import { generateWeeklyAd } from "@/lib/weeklyAd";

export async function GET(req: Request) {
  const unauthorized = verifyCronAuth(req);
  if (unauthorized) return unauthorized;
  // 🔐 Verify cron secret
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await generateWeeklyAd()
}

export async function POST(req: Request) {
  const { searchParams } = new URL(req.url);
  const preview = searchParams.get("preview") === "true";
  const dryRun = searchParams.get("dryRun") === "true";

  await generateWeeklyAd({ preview, dryRun })
}