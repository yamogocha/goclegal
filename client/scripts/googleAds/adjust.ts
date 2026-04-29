import { weeklyAdjustments } from "../../src/lib/googleAds/adjust";

async function main() {
  const dryRun = process.env.DRY_RUN === "true";

  console.log("[WEEKLY ADS OPTIMIZER] start", { dryRun });

  const result = await weeklyAdjustments({ dryRun });

  if (!result.ok) {
    console.error("[WEEKLY ADS OPTIMIZER ERROR]", result);
    process.exit(1);
  }

  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
}

main();