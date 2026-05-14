import { getErrorMessage } from "@/lib";
import {
  runCoreOptimization,
} from "../../src/lib/googleAds/optimize";

async function main() {
  const dryRun =
    process.env.DRY_RUN === "true";

  const start = Date.now();

  console.log(
    "[GOOGLE ADS OPTIMIZE] Starting"
  );

  try {
    const result =
      await runCoreOptimization({
        dryRun,
      });

    const failed =
      !result.ok ||
      (result.errors?.length ?? 0) > 0;

    console.log(
      "::group::Google Ads Optimization Result"
    );

    console.log(
      JSON.stringify(
        {
          ok: !failed,
          dryRun,
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
        "[GOOGLE ADS OPTIMIZE FAILED]"
      );

      process.exit(1);
    }

    console.log(
      "[GOOGLE ADS OPTIMIZE SUCCESS]"
    );

    process.exit(0);
  } catch (err) {
    const error = getErrorMessage(err);

    console.error(
      "[GOOGLE ADS OPTIMIZE SCRIPT ERROR]"
    );

    console.error(error);

    console.log(
      "::group::Google Ads Optimization Fatal Error"
    );

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