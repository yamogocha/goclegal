// client/src/app/api/cron/weeklyBlog/route.ts
import { verifyCronAuth } from "@/lib/oauth";
import { generateWeeklyBlog } from "@/lib/weeklyBlog";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const unauthorized = verifyCronAuth(req);
  if (unauthorized) return unauthorized;

  try {
    const result = await generateWeeklyBlog();

    return Response.json({ ok: true, result });
  } catch (err) {
    console.error("[WEEKLY BLOG ERROR]", err);

    return Response.json(
      { ok: false, error: String(err) },
      { status: 500 }
    );
  }
}