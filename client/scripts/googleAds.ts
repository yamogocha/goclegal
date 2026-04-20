// scripts/googleAds.ts
export {};
const BASE_URL = process.env.BASE_URL;
const CRON_SECRET = process.env.CRON_SECRET;

if (!BASE_URL) {
  console.error("Missing BASE_URL");
  process.exit(1);
}

if (!CRON_SECRET) {
  console.error("Missing CRON_SECRET");
  process.exit(1);
}

async function main() {

  console.log("BASE_URL USED:", BASE_URL);
  const dryRun = process.env.DRY_RUN === "true";

  const url = `${BASE_URL}/api/cron/googleAds?dryRun=${dryRun}`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${CRON_SECRET}`,
      "Content-Type": "application/json",
    },
  });

  const text = await res.text();

  if (!res.ok) {
    throw new Error(`Request failed: ${res.status} - ${text}`);
  }

  console.log("Google Ads job completed");
  console.log(text);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Google Ads job failed", err);
    process.exit(1);
  });