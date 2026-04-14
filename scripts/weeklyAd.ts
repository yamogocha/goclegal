import { generateWeeklyAd } from "../client/src/lib/weeklyAd";

generateWeeklyAd()
  .then(() => {
    console.log("✅ Weekly Ad completed");
    process.exit(0);
  })
  .catch((err) => {
    console.error("❌ Weekly Ad failed", err);
    process.exit(1);
  });