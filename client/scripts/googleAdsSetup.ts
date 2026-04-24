// scripts/googleAdsSetup.ts
// show full failure payload including logs
async function run() {
  try {
    console.log("=== GOOGLE ADS SETUP ===");

    const URL = process.env.BASE_URL + "/api/cron/googleAdsSetup";

    const res = await fetch(URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.CRON_SECRET}`,
      },
      body: JSON.stringify({
        location: "Oakland CA",
        phoneNumber: "+1510XXXXXXX",
        dryRun: false,
      }),
    });

    const data = await res.json();

    console.dir(data, { depth: null });

    if (!data.ok) {
      console.error("\n=== SETUP FAILED ===");

      // // print all possible failure surfaces
      console.error("error:", data.error ?? "none");
      console.error("stack:", data.stack ?? "none");
      console.error("logs:", JSON.stringify(data.logs, null, 2));

      process.exit(1);
    }

    console.log("\n=== SETUP COMPLETE ===");

  } catch (err: any) {
    console.error("\n=== SCRIPT CRASHED ===");
    console.error(err?.message || err);
    console.error(err?.stack);
    process.exit(1);
  }
}

run();