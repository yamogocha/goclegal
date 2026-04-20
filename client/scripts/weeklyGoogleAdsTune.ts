// scripts/weeklyGoogleAdsTune.ts
import { weeklyGoogleAdsTune } from "../src/lib/budgetMonitor";

async function main() {
  const dryRun = process.env.DRY_RUN === "true";

  console.log("[WEEKLY ADS OPTIMIZER] Starting job");
  console.log("[WEEKLY ADS OPTIMIZER] dryRun:", dryRun);

  const start = Date.now();

  try {
    await weeklyGoogleAdsTune({ dryRun });

    console.log("[WEEKLY ADS OPTIMIZER] Success");

    console.log("::group::Weekly Ads Optimizer Result");
    console.log(
      JSON.stringify(
        {
          ok: true,
          dryRun,
          durationMs: Date.now() - start
        },
        null,
        2
      )
    );
    console.log("::endgroup::");

    process.exit(0);
  } catch (err) {
    console.error("[WEEKLY ADS OPTIMIZER ERROR]", err);
    process.exit(1);
  }
}

main();