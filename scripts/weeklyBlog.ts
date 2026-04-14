import { generateWeeklyBlog } from "../client/src/lib/weeklyBlog";

generateWeeklyBlog()
  .then(() => {
    console.log("✅ Weekly Blog completed");
    process.exit(0);
  })
  .catch((err) => {
    console.error("❌ Weekly Blog failed", err);
    process.exit(1);
  });