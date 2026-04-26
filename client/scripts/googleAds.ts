// script (single execution)
import { runCoreOptimization } from "../src/lib/googleAds/optimize";

async function main() {
  const dryRun = process.env.DRY_RUN === "true";

  const start = Date.now();

  try {
    const result = await runCoreOptimization({ dryRun });

    console.log(
      JSON.stringify(
        {
          ok: true,
          dryRun,
          durationMs: Date.now() - start,
          ...result,
        },
        null,
        2
      )
    );

    process.exit(0);
  } catch (err) {
    console.error("[GOOGLE ADS ERROR]", err);
    process.exit(1);
  }
}

main();