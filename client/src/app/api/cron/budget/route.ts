import { controlBudgetAdvanced } from "@/lib/budgetMonitor";
import { verifyCronAuth } from "@/lib/oauth";


export async function GET(req: Request) {
  const unauthorized = verifyCronAuth(req);
  if (unauthorized) return unauthorized;

  await controlBudgetAdvanced();
  return Response.json({ ok: true });
}