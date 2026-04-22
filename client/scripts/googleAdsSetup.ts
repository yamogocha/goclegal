// scripts/googleAdsSetup.ts
// run one-time google ads setup via api with clear logging
async function run() {
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

  console.log("\n=== GOOGLE ADS SETUP ===");
  console.dir(data, { depth: null });

  if (!data.ok) {
    console.error("Setup failed");
    process.exit(1);
  }

  console.log("\nSetup complete");
}

run();