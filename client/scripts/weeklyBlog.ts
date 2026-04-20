// scripts/weeklyBlog.ts
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
  const preview = process.env.PREVIEW === "true";
  const dryRun = process.env.DRY_RUN === "true";

  const url = `${BASE_URL}/api/cron/weeklyBlog?preview=${preview}&dryRun=${dryRun}`;

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

  console.log("Weekly Blog job completed");
  console.log(text);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Weekly Blog job failed", err);
    process.exit(1);
  });