
import { config } from "dotenv";
config({ path: ".env.local" });

console.log("[REPAIR] SANITY_PROJECT_ID:", process.env.SANITY_PROJECT_ID ? "loaded" : "MISSING");
console.log("[REPAIR] SANITY_DATASET:", process.env.SANITY_DATASET ? "loaded" : "MISSING");
console.log("[REPAIR] SANITY_API_TOKEN:", process.env.SANITY_API_TOKEN ? "loaded" : "MISSING");

async function main() {
    const weeklyAdId = process.argv[2];
    if (!weeklyAdId) throw new Error("Usage: npx tsx scripts/repairWeeklyAdStatic.ts <weeklyAdId>");

    const { repairWeeklyAdStaticImage } = await import("../src/lib/weeklyAd");

    console.log(`[REPAIR] Starting static ad repair: ${weeklyAdId} `);

    const result = await repairWeeklyAdStaticImage(weeklyAdId);

    console.log("::group::Static Ad Repair Result");
    console.log(JSON.stringify(result, null, 2));
    console.log("::endgroup::");
}

main().catch(err => {
    console.error("[REPAIR FAILED]", err);
    process.exit(1);
});
