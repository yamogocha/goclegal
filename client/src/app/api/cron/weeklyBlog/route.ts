
import { verifyCronAuth } from "@/lib/oauth";
import { generateWeeklyBlog } from "@/lib/weeklyBlog";
import { NextResponse } from "next/server"




export async function GET(req: Request) {
    const unauthorized = verifyCronAuth(req);
    if (unauthorized) return unauthorized;

    // secure the endpoint
    const auth = req.headers.get("authorization")
    const expected = `Bearer ${process.env.CRON_SECRET}`
    if (!process.env.CRON_SECRET || auth !== expected) {
        return NextResponse.json({ error: "Unauthorized"}, { status: 401 })
    }

    await generateWeeklyBlog()
}