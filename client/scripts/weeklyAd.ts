// scripts/weeklyAd.ts
import { getErrorMessage } from "@/lib/error";
import { generateWeeklyAd, getHeyGenVideo, processWeeklyAdVideo, waitForHeyGenVideo } from "../src/lib/weeklyAd";

async function main() {
  const dryRun = process.env.DRY_RUN === "true";
  const start = Date.now();
  console.log("[WEEKLY AD] Starting job");
  console.log(JSON.stringify({ dryRun, startedAt: new Date().toISOString() }, null, 2));

  try {
    const result = await generateWeeklyAd({ dryRun });
    if (!result) throw new Error("Weekly ad returned empty result.");

    if (!result.ok) throw new Error(result.error ?? "Weekly ad generation failed.");
    if (dryRun) {
      console.log("[WEEKLY AD] Dry run complete.");
      console.log(JSON.stringify({ ok: true, result }, null, 2));
      process.exit(0);
    }

    // GitHub Actions owns the long-running B-roll/publishing process.
    if (result.weeklyAdId && result.heygenVideoId) {
      const heygenVideoId = result.heygenVideoId;
      const heygenStatus = await getHeyGenVideo(heygenVideoId);
      let heygenVideoUrl = heygenStatus?.data?.video_url;

      if (!heygenVideoUrl) {
        heygenVideoUrl = await waitForHeyGenVideo(heygenVideoId);
      }

      console.log(`[WEEKLY AD] Processing HeyGen video ${heygenVideoId} on GitHub runner.`);
      const processed = await processWeeklyAdVideo({
        weeklyAdId: result.weeklyAdId,
        heygenVideoId,
        heygenVideoUrl,
      });

      if (!processed?.ok) throw new Error("Weekly ad video processing failed.");

      console.log("::group::Weekly Ad Result");
      console.log(JSON.stringify({ ok: true, durationMs: Date.now() - start, result: processed }, null, 2));
      console.log("::endgroup::");
      console.log("[WEEKLY AD SUCCESS]");
      process.exit(0);
    }

    throw new Error("Weekly ad did not return weeklyAdId and heygenVideoId.");
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