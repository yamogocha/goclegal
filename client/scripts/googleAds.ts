// scripts/googleAds.ts
import { runKeywordExpansion, runNegativeKeywordStrategy, runBudgetAllocation } from "../src/lib/googleAds";

async function main() {
  console.log("ENV KEY EXISTS:", !!process.env.OPENAI_API_KEY);
  const dryRun = process.env.DRY_RUN === "true";

  console.log("[GOOGLE ADS] Starting job");
  console.log("[GOOGLE ADS] dryRun:", dryRun);

  const start = Date.now();

  try {
    const keywordExpansion = await runKeywordExpansion({ dryRun });
    const negativeKeyword = await runNegativeKeywordStrategy({ dryRun });
    const budgetAllocation = await runBudgetAllocation();

    console.log("[GOOGLE ADS] Success");

    console.log("::group::Google Ads Result");
    console.log(
      JSON.stringify(
        {
          ok: true,
          dryRun,
          durationMs: Date.now() - start,
          keywordExpansion,
          negativeKeyword,
          budgetAllocation,
        },
        null,
        2
      )
    );
    console.log("::endgroup::");

    process.exit(0);
  } catch (err) {
    console.error("[GOOGLE ADS ERROR]", err);
    process.exit(1);
  }
}

main();