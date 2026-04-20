// scripts/weeklyBlog.ts
import { generateWeeklyBlog } from "../src/lib/weeklyBlog";

async function main() {
  console.log("[WEEKLY BLOG] Starting job");

  const start = Date.now();

  try {
    const result = await generateWeeklyBlog();

    if (!result) {
      throw new Error("Empty weekly blog result");
    }

    console.log("[WEEKLY BLOG] Success");

    console.log("::group::Weekly Blog Result");
    console.log(
      JSON.stringify(
        {
          ok: true,
          durationMs: Date.now() - start,
          result,
        },
        null,
        2
      )
    );
    console.log("::endgroup::");

    process.exit(0);
  } catch (err) {
    console.error("[WEEKLY BLOG ERROR]", err);
    process.exit(1);
  }
}

main();