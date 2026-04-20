import { controlBudget } from "@/lib/budgetMonitor";
import { verifyCronAuth } from "@/lib/oauth";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const unauthorized = verifyCronAuth(req);
  if (unauthorized) return unauthorized;

  const { searchParams } = new URL(req.url);
  const dryRun = searchParams.get("dryRun") === "true";

  try {
    const result = await controlBudget({ dryRun });

    return Response.json({ ok: true, result });
  } catch (err) {
    console.error("[BUDGET ERROR]", err);

    return Response.json(
      { ok: false, error: String(err) },
      { status: 500 }
    );
  }
}