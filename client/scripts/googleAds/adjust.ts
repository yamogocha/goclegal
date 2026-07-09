import { getErrorMessage } from "@/lib/error";
import {
  weeklyAdjustments,
} from "../../src/lib/googleAds/adjust";

async function main() {
  const dryRun =
    process.env.DRY_RUN === "true";

  const start = Date.now();

  console.log(
    "[GOOGLE ADS ADJUSTMENTS] Starting"
  );

  console.log(
    JSON.stringify(
      {
        dryRun,
        startedAt:
          new Date().toISOString(),
      },
      null,
      2
    )
  );

  try {
    const result =
      await weeklyAdjustments({
        dryRun,
      });

    const failed =
      !result.ok ||
      (result.errors?.length ?? 0) > 0;

    console.log(
      "::group::Google Ads Adjustment Result"
    );

    console.log(
      JSON.stringify(
        {
          ok: !failed,
          durationMs:
            Date.now() - start,
          result,
        },
        null,
        2
      )
    );

    console.log("::endgroup::");

    if (failed) {
      console.error(
        "[GOOGLE ADS ADJUSTMENTS FAILED]"
      );

      process.exit(1);
    }

    console.log(
      "[GOOGLE ADS ADJUSTMENTS SUCCESS]"
    );

    process.exit(0);

  } catch (err) {
    const error =
      getErrorMessage(err);

    console.error(
      "[GOOGLE ADS ADJUSTMENTS SCRIPT ERROR]"
    );

    console.error(error);

    console.log(
      "::group::Google Ads Adjustments Fatal Error"
    );

    console.log(
      JSON.stringify(
        {
          ok: false,
          error,
          durationMs:
            Date.now() - start,
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