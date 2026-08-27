import { NextResponse } from "next/server";
import { processWeeklyAdVideo } from "@/lib/weeklyAd";
import { getErrorMessage, notifySlackError } from "@/lib/error";

export const maxDuration = 300;

export async function POST(req: Request) {
    try {
        const body: unknown = await req.json();
        if (!body || typeof body !== "object") return NextResponse.json({ ok: false, error: "Invalid webhook body." }, { status: 400 });
        const data = body as Record<string, unknown>;
        if (data.event_type !== "avatar_video.success") return NextResponse.json({ ok: true, ignored: true });
        const eventData = data.event_data;
        if (!eventData || typeof eventData !== "object") throw new Error("HeyGen webhook missing event_data.");
        const event = eventData as Record<string, unknown>;
        const weeklyAdId = typeof event.callback_id === "string" ? event.callback_id : "";
        const heygenVideoId = typeof event.video_id === "string" ? event.video_id : "";
        const heygenVideoUrl = typeof event.url === "string" ? event.url : "";
        if (!weeklyAdId || !heygenVideoId || !heygenVideoUrl) throw new Error("HeyGen webhook missing callback_id, video_id, or url.");
        const result = await processWeeklyAdVideo({ weeklyAdId, heygenVideoId, heygenVideoUrl });
        return NextResponse.json(result, { status: 200 });
    } catch (err) {
        const error = getErrorMessage(err);
        await notifySlackError("Weekly Ad Webhook Failure", err, { error });
        return NextResponse.json({ ok: false, error }, { status: 500 });
    }
}