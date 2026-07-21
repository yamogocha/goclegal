// app/api/webhooks/heygen/route.ts

import { NextResponse } from "next/server";
import { client } from "@/sanity/client";
import { publishInstagramAndFacebook, uploadYoutubeVideo, uploadGBPMedia, buildInstagramCaption, publishInstagramReel, publishFacebookReel, deleteBlob } from "@/lib/weeklyAd";
import { getErrorMessage, notifySlackError, notifySlackResult } from "@/lib/error";
import { serverClient } from "@/sanity/serverClient";

export async function POST(req: Request) {
    const started = Date.now();

    try {
        // Parse webhook
        const body = await req.json();

        console.log(JSON.stringify(body, null, 2));

        if (body.event_type !== "avatar_video.success") {
            return NextResponse.json({ ok: true, ignored: true });
        }

        const eventData = body.event_data;

        const adId = eventData.callback_id;
        const videoUrl = eventData.url;
        const heygenVideoId = eventData.video_id;

        if (!adId) {
            throw new Error("HeyGen webhook missing callback_id");
        }
        if (!videoUrl) {
            throw new Error("HeyGen webhook missing event_data.url");
        }

        const ad = await client.getDocument(adId);
        if (!ad) {
            throw new Error(`Weekly ad not found for ${adId}`);
        }

        // Prevent duplicate webhook execution
        if (ad.status === "completed") {
            console.log("Weekly ad already completed.");
            return NextResponse.json({ ok: true, duplicate: true });
        }

        if (ad.status === "publishing") {
            console.log("Weekly ad already publishing.");
            return NextResponse.json({ ok: true, duplicate: true });
        }

        // Lock immediately so another webhook can't start
        await serverClient.patch(ad._id).set({ status: "publishing", heygenVideoId, videoUrl }).commit();

        // Download video
        const download = await fetch(videoUrl);
        if (!download.ok) {
            throw new Error("Unable to download HeyGen video.");
        }
        const buffer = Buffer.from(await download.arrayBuffer());

        // Upload to Blob
        const reelUrl = videoUrl;
        const caption = buildInstagramCaption(ad.caption, ad.hashtags);

        // Static Instagram + Facebook
        let instagramPostId = ad.instagramPostId;
        let facebookPostId = ad.facebookPostId;
        if (!instagramPostId || !facebookPostId) {
            const staticAds = await publishInstagramAndFacebook({
                igUserId: process.env.IG_USER_ID!,
                fbPageId: process.env.FB_PAGE_ID!,
                userAccessToken: process.env.FB_USER_ACCESS_TOKEN!,
                pageAccessToken: process.env.FB_PAGE_ACCESS_TOKEN!,
                imageUrl: ad.imageUrl,
                caption,
            });
            instagramPostId = staticAds.instagramPostId;
            facebookPostId = staticAds.facebookPostId;
            await serverClient.patch(ad._id).set({ instagramPostId, facebookPostId }).commit();
        }

        // Instagram Reel
        let instagramReelId = ad.instagramReelId;
        if (!instagramReelId) {
            for (let i = 0; i < 5; i++) {
                try {
                    instagramReelId =
                        await publishInstagramReel({
                            igUserId: process.env.IG_USER_ID!,
                            userAccessToken:
                                process.env.FB_USER_ACCESS_TOKEN!,
                            reelUrl,
                            caption,
                        });
                    break;
                } catch (err) {
                    if (
                        !String(err).includes("Media ID is not available")
                    ) { throw err }
                    await new Promise(r => setTimeout(r, 10000));
                }
            }

            if (!instagramReelId) {
                throw new Error("Instagram Reel never became ready.");
            }
            await serverClient.patch(ad._id).set({ instagramReelId }).commit();
        }

        // Facebook Reel
        let facebookReelId = ad.facebookReelId;
        if (!facebookReelId) {
            facebookReelId =
                await publishFacebookReel({
                    fbPageId: process.env.FB_PAGE_ID!,
                    pageAccessToken:
                        process.env.FB_PAGE_ACCESS_TOKEN!,
                    reelUrl,
                    caption,
                });
            await serverClient.patch(ad._id).set({ facebookReelId }).commit();
        }

        // YouTube
        let youtubeVideoId = ad.youtubeVideoId;
        if (!youtubeVideoId) {
            youtubeVideoId =
                await uploadYoutubeVideo({
                    videoBuffer: buffer,
                    title: ad.title,
                    description: `${ad.caption}\n\n${ad.hashtags.join(
                        " "
                    )}`,
                });
            await serverClient.patch(ad._id).set({ youtubeVideoId }).commit();
        }

        // Google Business Profile
        let gbpMediaName = ad.gbpMediaName;
        if (!gbpMediaName) {
            gbpMediaName = await uploadGBPMedia({
                accountId: process.env.GBP_ACCOUNT_ID!,
                locationId: process.env.GBP_LOCATION_ID!,
                imageUrl: ad.imageUrl,
            });
            await serverClient.patch(ad._id).set({ gbpMediaName }).commit();
        }

        // Complete
        await serverClient.patch(ad._id).set({ status: "completed", completedAt: new Date().toISOString() }).unset(["imageUrl"]).commit();
        // Delete temporary image now that every platform has it.
        await deleteBlob(ad.imageUrl);
        await notifySlackResult("Weekly Ad Completed", {
            videoUrl,
            youtubeVideoId,
            instagramPostId,
            facebookPostId,
            instagramReelId,
            facebookReelId,
            gbpMediaName,
            durationMs: Date.now() - started,
        });
        return NextResponse.json({ ok: true });
    } catch (err) {
        await notifySlackError("Weekly Ad Webhook Failure", err, { error: getErrorMessage(err) });
        return NextResponse.json({ ok: false, error: getErrorMessage(err) }, { status: 500 });
    }
}