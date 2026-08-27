import { NextResponse } from "next/server";
import { processWeeklyAdVideo } from "@/lib/weeklyAd";
import { getErrorMessage, notifySlackError } from "@/lib/error";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: Request) {
    try {
        const body = await req.json();
        if (body?.event_type !== "avatar_video.success") return NextResponse.json({ ok: true, ignored: true });
        const adId = body?.event_data?.callback_id;
        const heygenVideoId = body?.event_data?.video_id;
        const heygenVideoUrl = body?.event_data?.url;
        if (!adId || !heygenVideoId || !heygenVideoUrl) throw new Error("HeyGen webhook missing callback_id, video_id, or url.");
        const result = await processWeeklyAdVideo({ weeklyAdId: adId, heygenVideoId, heygenVideoUrl });
        return NextResponse.json(result);
    } catch (err) {
        const error = getErrorMessage(err);
        await notifySlackError("Weekly Ad Webhook Failure", err, { error }).catch(() => { });
        return NextResponse.json({ ok: false, error }, { status: 500 });
    }
}