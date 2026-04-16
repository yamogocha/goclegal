import { weeklyAdsOptimizer } from "../client/src/lib/budgetMonitor";

weeklyAdsOptimizer()
  .then(() => {
    console.log("✅ Google Ads Optimizer completed");
    process.exit(0);
  })
  .catch((err) => {
    console.error("❌ Google Ads Optimizer failed", err);
    process.exit(1);
  });