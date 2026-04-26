// scripts/googleAdsSetup.ts
// robust fetch + safe parsing + full visibility


async function run() {
  try {
    console.log("=== GOOGLE ADS SETUP ===");

    const res = await fetch(process.env.BASE_URL + "/api/cron/googleAdsSetup", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.CRON_SECRET}`,
      },
      body: JSON.stringify({
        location: "Oakland CA",
        phoneNumber: "+15108460928",
        dryRun: false,
      }),
    });

    const text = await res.text(); // // ALWAYS read raw first

    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      console.error("\n=== NON JSON RESPONSE ===");
      console.error(text.slice(0, 2000));
      process.exit(1);
    }

    console.dir(data, { depth: null });

    if (!data.ok) {
      console.error("\n=== SETUP FAILED ===");

      console.error("error:", data.error || "missing_error");
      console.error("details:", JSON.stringify(data.details || [], null, 2));
      console.error("logs:", JSON.stringify(data.logs || [], null, 2));

      // // CRITICAL: fallback visibility
      if (!data.error && (!data.details || data.details.length === 0)) {
        console.error("\n=== FALLBACK RAW ===");
        console.error(text.slice(0, 2000));
      }

      process.exit(1);
    }

    console.log("\n=== SETUP COMPLETE ===");

  } catch (err: any) {
    console.error("\n=== SCRIPT CRASHED ===");
    console.error(err?.message || err);
    process.exit(1);
  }
}

run();