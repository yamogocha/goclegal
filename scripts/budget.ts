import { controlBudget } from "../client/src/lib/budgetMonitor";

controlBudget()
  .then(() => {
    console.log("✅ Budget job completed");
    process.exit(0);
  })
  .catch((err) => {
    console.error("❌ Budget job failed", err);
    process.exit(1);
  });