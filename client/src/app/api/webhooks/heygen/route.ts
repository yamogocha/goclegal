import { NextResponse } from "next/server";
import { notifySlackError } from "@/lib/error";
import { getErrorMessage } from "@/lib/error";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
    try {
        const body = await req.json();

        if (body?.event_type !== "avatar_video.success") {
            return NextResponse.json({ ok: true, ignored: true });
        }

        const adId = body?.event_data?.callback_id;
        const heygenVideoId = body?.event_data?.video_id;
        const heygenVideoUrl = body?.event_data?.url;

        if (!adId || !heygenVideoId || !heygenVideoUrl) {
            throw new Error("HeyGen webhook missing callback_id, video_id, or url.");
        }

        // Do NOT run FFmpeg/B-roll/publishing from Vercel.
        console.log(`[HEYGEN WEBHOOK] Video ready: ${heygenVideoId}`);
        console.log(`[HEYGEN WEBHOOK] Weekly ad: ${adId}`);
        console.log(`[HEYGEN WEBHOOK] URL: ${heygenVideoUrl}`);

        return NextResponse.json({
            ok: true,
            accepted: true,
            weeklyAdId: adId,
            heygenVideoId,
            videoUrl: heygenVideoUrl,
        });
    } catch (err) {
        const error = getErrorMessage(err);
        await notifySlackError("Weekly Ad Webhook Failure", err, { error }).catch(() => { });
        return NextResponse.json({ ok: false, error }, { status: 500 });
    }
}