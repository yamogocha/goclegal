// scripts/checkCampaigns.ts
import { checkCampaignsForPause, pauseCampaigns } from "@/lib/googleAds/check";

async function run() {
    const res = await checkCampaignsForPause();
  
    console.log("\n=== CAMPAIGN DIAGNOSTIC ===\n");
    console.dir(res.summary, { depth: null });
  
    console.table(res.campaigns);
  
    // FIX: use res.campaigns (not res)
    const toPause = res.campaigns
      .filter((c: any) => c.action === "PAUSE" && c.status !== "PAUSED")
      .map((c: any) => c.id);
  
    console.log("\nCandidates to pause:", toPause);
  
    if (!toPause.length) {
      console.log("\nNothing to pause. Check reasons above.");
      return;
    }
  
    if (process.argv.includes("--apply")) {
      console.log("\nApplying pause...");
      await pauseCampaigns(toPause);
      console.log("Paused:", toPause);
    } else {
      console.log("\nDry run. Use --apply to execute.");
    }
  }
  
  run();