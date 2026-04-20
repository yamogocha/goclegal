// client/src/app/api/cron/googleAds/route.ts

import { resetAICallCount } from "@/lib/budgetMonitor";
import {
  runGoogleAdsEngine,
  // runNegativeKeywordCleanup,
} from "@/lib/googleAds";
import { verifyCronAuth } from "@/lib/oauth";

export const runtime = "nodejs";

export async function POST(req: Request): Promise<Response> {
  return new Response("ROUTE HARD STOP", { status: 500 });
}