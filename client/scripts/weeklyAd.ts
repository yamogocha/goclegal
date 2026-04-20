// scripts/weeklyAd.ts
import { generateWeeklyAd } from "../src/lib/weeklyAd";

async function main() {
  const preview = process.env.PREVIEW === "true";
  const dryRun = process.env.DRY_RUN === "true";

  console.log("[WEEKLY AD] Starting job");
  console.log("[WEEKLY AD] preview:", preview);
  console.log("[WEEKLY AD] dryRun:", dryRun);

  const start = Date.now();

  try {
    const result = await generateWeeklyAd({ preview, dryRun });

    if (!result) {
      throw new Error("Empty weekly ad result");
    }

    console.log("[WEEKLY AD] Success");

    console.log("::group::Weekly Ad Result");
    console.log(
      JSON.stringify(
        {
          ok: true,
          preview,
          dryRun,
          durationMs: Date.now() - start,
          result,
        },
        null,
        2
      )
    );
    console.log("::endgroup::");

    process.exit(0);
  } catch (err) {
    console.error("[WEEKLY AD ERROR]", err);
    process.exit(1);
  }
}

main();