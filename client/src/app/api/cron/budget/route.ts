import { controlBudgetAdvanced } from "@/lib/budgetMonitor";


export async function GET() {
  await controlBudgetAdvanced();
  return Response.json({ ok: true });
}