// scripts/budget.ts
import { controlBudget } from "../src/lib/budgetMonitor";

async function main() {
  const dryRun = process.env.DRY_RUN === "true";

  console.log("[BUDGET] Starting job");
  console.log("[BUDGET] dryRun:", dryRun);

  const start = Date.now();

  try {
    const result = await controlBudget({ dryRun });

    console.log("[BUDGET] Success");
    console.log(
      JSON.stringify(
        {
          ok: true,
          dryRun,
          durationMs: Date.now() - start,
          result,
        },
        null,
        2
      )
    );

    process.exit(0);
  } catch (err) {
    console.error("[BUDGET ERROR]", err);

    process.exit(1);
  }
}

main();