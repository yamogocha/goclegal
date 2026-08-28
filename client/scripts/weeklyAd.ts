import { getErrorMessage } from "@/lib/error";
import { generateWeeklyAd, processWeeklyBrollVideo } from "../src/lib/weeklyAd";

async function main() {
  const dryRun = process.env.DRY_RUN === "true";
  const weeklyAdId = process.env.WEEKLY_AD_ID;
  const heygenVideoId = process.env.HEYGEN_VIDEO_ID;
  const heygenVideoUrl = process.env.HEYGEN_VIDEO_URL;
  const start = Date.now();

  console.log("[WEEKLY AD] Starting job");
  console.log(JSON.stringify({ dryRun, weeklyAdId, heygenVideoId, startedAt: new Date().toISOString() }, null, 2));

  try {
    // GitHub repository_dispatch path: process the completed HeyGen video.
    if (weeklyAdId && heygenVideoId && heygenVideoUrl) {
      console.log(`[WEEKLY AD] Processing HeyGen video ${heygenVideoId} on GitHub runner.`);
      const result = await processWeeklyBrollVideo({ weeklyAdId, heygenVideoId, heygenVideoUrl });
      if (!result?.ok) throw new Error("Weekly B-roll processing failed.");
      console.log("::group::Weekly Ad Processing Result");
      console.log(JSON.stringify({ ok: true, durationMs: Date.now() - start, result }, null, 2));
      console.log("::endgroup::");
      console.log("[WEEKLY AD SUCCESS]");
      process.exit(0);
    }

    // Normal Monday cron path: create static ad + HeyGen video.
    const result = await generateWeeklyAd({ dryRun });
    if (!result) throw new Error("Weekly ad returned empty result.");
    if (!result.ok) throw new Error(result.error ?? "Weekly ad generation failed.");

    console.log("::group::Weekly Ad Result");
    console.log(JSON.stringify({ ok: true, durationMs: Date.now() - start, result }, null, 2));
    console.log("::endgroup::");
    console.log("[WEEKLY AD SUCCESS]");
    process.exit(0);
  } catch (err) {
    const error = getErrorMessage(err);
    console.error("[WEEKLY AD SCRIPT ERROR]", error);
    console.log("::group::Weekly Ad Fatal Error");
    console.log(JSON.stringify({ ok: false, error, durationMs: Date.now() - start }, null, 2));
    console.log("::endgroup::");
    process.exit(1);
  }
}

main();