import { NextResponse } from "next/server";
import { getErrorMessage, notifySlackError } from "@/lib/error";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
    try {
        const body = await req.json();
        if (body?.event_type !== "avatar_video.success") return NextResponse.json({ ok: true, ignored: true });

        const adId = body?.event_data?.callback_id;
        const heygenVideoId = body?.event_data?.video_id;
        const heygenVideoUrl = body?.event_data?.url;

        if (!adId || !heygenVideoId || !heygenVideoUrl) throw new Error("HeyGen webhook missing callback_id, video_id, or url.");

        const token = process.env.GITHUB_ACTIONS_TOKEN;
        const repository = process.env.GITHUB_REPOSITORY;

        if (!token) throw new Error("GITHUB_ACTIONS_TOKEN is not configured.");
        if (!repository) throw new Error("GITHUB_REPOSITORY is not configured.");

        console.log(`[HEYGEN WEBHOOK] Video ready: ${heygenVideoId}`);
        console.log(`[HEYGEN WEBHOOK] Weekly ad: ${adId}`);
        console.log(`[HEYGEN WEBHOOK] Dispatching GitHub Actions workflow.`);

        const response = await fetch(`https://api.github.com/repos/${repository}/dispatches`, {
            method: "POST",
            headers: {
                Accept: "application/vnd.github+json",
                Authorization: `Bearer ${token}`,
                "X-GitHub-Api-Version": "2026-03-10",
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                event_type: "weekly-ad-ready",
                client_payload: {
                    weeklyAdId: adId,
                    heygenVideoId,
                    heygenVideoUrl,
                },
            }),
        });

        if (!response.ok) throw new Error(`GitHub repository dispatch failed: ${response.status} ${await response.text()}`);

        return NextResponse.json({ ok: true, accepted: true, weeklyAdId: adId, heygenVideoId });
    } catch (err) {
        const error = getErrorMessage(err);
        await notifySlackError("Weekly Ad Webhook Failure", err, { error }).catch(() => { });
        return NextResponse.json({ ok: false, error }, { status: 500 });
    }
}