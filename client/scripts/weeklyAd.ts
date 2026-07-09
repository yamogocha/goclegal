// scripts/weeklyAd.ts
import { getErrorMessage } from "@/lib";
import {
  generateWeeklyAd,
} from "../src/lib/weeklyAd";

async function main() {
  const preview =
    process.env.PREVIEW === "true";

  const dryRun =
    process.env.DRY_RUN === "true";

  const start = Date.now();

  console.log("[WEEKLY AD] Starting job");

  console.log(
    JSON.stringify(
      {
        preview,
        dryRun,
        startedAt: new Date().toISOString(),
      },
      null,
      2
    )
  );

  try {
    const result = await generateWeeklyAd({
      preview,
      dryRun,
    });

    if (!result) {
      throw new Error(
        "Weekly ad returned empty result."
      );
    }

    const failed =
      !result.ok ||
      result.igError ||
      result.youtubeError ||
      result.gbpError;

    console.log("::group::Weekly Ad Result");

    console.log(
      JSON.stringify(
        {
          ok: !failed,
          durationMs: Date.now() - start,
          result,
        },
        null,
        2
      )
    );

    console.log("::endgroup::");

    if (failed) {
      console.error(
        "[WEEKLY AD FAILED]",
        JSON.stringify(result, null, 2)
      );

      process.exit(1);
    }

    console.log("[WEEKLY AD SUCCESS]");

    process.exit(0);
  } catch (err) {
    const error = getErrorMessage(err);

    console.error("[WEEKLY AD SCRIPT ERROR]");

    console.error(error);

    console.log("::group::Weekly Ad Fatal Error");

    console.log(
      JSON.stringify(
        {
          ok: false,
          error,
          durationMs: Date.now() - start,
        },
        null,
        2
      )
    );

    console.log("::endgroup::");

    process.exit(1);
  }
}

main();