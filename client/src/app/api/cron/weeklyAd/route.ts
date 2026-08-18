// client/src/app/api/cron/weeklyAd/route.ts

import { getErrorMessage } from "@/lib/error";
import { verifyCronAuth } from "@/lib/oauth";
import { generateWeeklyAd } from "@/lib/weeklyAd";

import { NextResponse } from "next/server";
import { generateStoryboard, generateAssets, alignStoryboardToAvatar, storyboardToAlignedTimeline, renderBrollVideo, getVideoDuration } from "@/lib/videoAd";
import fs from "node:fs/promises";

// local test route
export async function GET() {
  try {
    const script = "0:00 Think you can’t bring a claim because you were partly to blame? In California, that’s a myth. I’m Greg O’Connell, founder of GOC Legal here in Oakland. Here’s the key takeaway: being partly at fault doesn’t automatically shut the door on your case. California looks at everyone’s share of responsibility. Your compensation can be reduced by your percentage of fault, but it isn’t wiped out. For example, if you’re found 30% at fault, you could still recover the other 70% of your losses—medical bills, lost income, and more. The facts matter, and small details can shift those percentages. If you’re unsure where you stand, let’s talk. Contact GOC Legal for a free consultation.";
    const avatarPath = "/Users/angelyang/Desktop/greg.mp4";
    const avatarDuration = await getVideoDuration(avatarPath);

    console.log("[BROLL TEST] 1. Generating storyboard...");
    const storyboard = await generateStoryboard(script, avatarDuration);
    console.log("[BROLL TEST] 2. Aligning storyboard to Greg audio...");
    const alignedStoryboard = await alignStoryboardToAvatar(storyboard, avatarPath);
    console.log("\n========== STORYBOARD ==========");
    console.table(alignedStoryboard.map(b => ({ id: b.id, start: Number((b.start ?? 0).toFixed(2)), duration: Number(b.duration.toFixed(2)), end: Number(((b.start ?? 0) + b.duration).toFixed(2)), narration: b.narration })));
    const assets = await generateAssets(alignedStoryboard);

    console.log("[BROLL TEST] 3. Building timeline...");
    const timeline = await storyboardToAlignedTimeline(assets);
    console.log("\n========== TIMELINE ==========");
    console.table(timeline.clips.map(c => ({ id: c.id, assetSlug: c.assetSlug, start: Number(c.start!.toFixed(2)), duration: Number(c.duration.toFixed(2)), end: Number((c.start! + c.duration).toFixed(2)) })));

    console.log("[BROLL TEST] 4. Rendering B-roll...");
    const video = await renderBrollVideo(timeline, avatarPath, true);
    console.log("\n========== BROLL VIDEO ==========\n", video);

    return new NextResponse(await fs.readFile(video.localPath), { headers: { "Content-Type": "video/mp4", "Content-Disposition": "inline; filename=weekly-broll-test.mp4" } });
  } catch (error) {
    console.error("[BROLL TEST ERROR]", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

export const runtime = "nodejs";
export async function POST(req: Request) {
  const unauthorized = verifyCronAuth(req);
  if (unauthorized) { return unauthorized }

  const { searchParams } = new URL(req.url);
  const dryRun = searchParams.get("dryRun") === "true";

  try {
    const result = await generateWeeklyAd({ dryRun });

    const failed = !result?.ok || result?.igError || result?.youtubeError || result?.gbpError;

    if (failed) {
      console.error("[WEEKLY AD ROUTE FAILED]", JSON.stringify(result, null, 2));
      return Response.json({ ok: false, result }, { status: 500 });
    }
    return Response.json({ ok: true, result }, { status: 200 });
  } catch (err) {
    const error = getErrorMessage(err);
    console.error("[WEEKLY AD ROUTE ERROR]", error);
    return Response.json({ ok: false, error }, { status: 500 });
  }
}