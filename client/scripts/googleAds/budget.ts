// // script for local/manual execution

import { runBudgetControl } from "@/lib/googleAds/budget";

async function main() {
  try {
    const result = await runBudgetControl();
    console.log(JSON.stringify(result, null, 2));

    if (!result.success) {
      process.exit(1);
    }
  } catch (err: any) {
    console.error("fatal:", err.message);
    process.exit(1);
  }
}

main();