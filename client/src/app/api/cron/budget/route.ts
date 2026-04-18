// client/src/app/api/cron/budget/route.ts

import { controlBudget } from "@/lib/budgetMonitor";
import { verifyCronAuth } from "@/lib/oauth";

export const runtime = "nodejs";

export async function POST(req: Request) {
  // Auth check
  const unauthorized = verifyCronAuth(req);
  if (unauthorized) return unauthorized;

  const auth = req.headers.get("authorization");

console.log("AUTH HEADER:", auth);
console.log("EXPECTED:", `Bearer ${process.env.CRON_SECRET}`);
console.log("MATCH:", auth === `Bearer ${process.env.CRON_SECRET}`);

  // Parse query params
  const { searchParams } = new URL(req.url);
  const dryRun = searchParams.get("dryRun") === "true";

  try {
    const result = await controlBudget({ dryRun });

    return Response.json({
      ok: true,
      dryRun,
      result,
      timestamp: new Date().toISOString(),
    });
  } catch (err: unknown) {
    console.error("[BUDGET ERROR]", err);

    const message = err instanceof Error ? err.message : String(err);

    return Response.json(
      {
        ok: false,
        error: message,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}