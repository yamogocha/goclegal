import { manageGoogleAds } from "../client/src/lib/googleAds";

manageGoogleAds()
  .then(() => {
    console.log("✅ Google Ads completed");
    process.exit(0);
  })
  .catch((err) => {
    console.error("❌ Google Ads failed", err);
    process.exit(1);
  });