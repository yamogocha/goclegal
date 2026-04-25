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
        phoneNumber: "+1510XXXXXXX",
        dryRun: false,
      }),
    });

    const contentType = res.headers.get("content-type") || "";
    const text = await res.text();

    let data: any;
    try {
      data = contentType.includes("application/json")
        ? JSON.parse(text)
        : { ok: false, error: "non_json_response", raw: text };
    } catch {
      data = { ok: false, error: "invalid_json", raw: text };
    }

    console.dir(data, { depth: null });

    if (!data.ok) {
      console.error("\n=== SETUP FAILED ===");

      console.error("error:", data.error || "unknown");
      console.error("details:", JSON.stringify(data.details || [], null, 2));
      console.error("logs:", JSON.stringify(data.logs || [], null, 2));

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