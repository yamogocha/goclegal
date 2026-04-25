// scripts/googleAdsSetup.ts
// robust fetch + safe parsing + full visibility

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

    const contentType = res.headers.get("content-type") || "";

    let data: any;

    // parse response safely
    if (contentType.includes("application/json")) {
      data = await res.json();
    } else {
      const text = await res.text();

      console.error("\n=== NON-JSON RESPONSE ===");
      console.error("status:", res.status);
      console.error("body:", text.slice(0, 1000)); // avoid huge dumps

      process.exit(1);
    }

    console.dir(data, { depth: null });

    if (!data.ok) {
      console.error("\n=== SETUP FAILED ===");
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