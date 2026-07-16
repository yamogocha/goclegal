// app/api/webhooks/heygen/route.ts

import { NextResponse } from "next/server";
import { client } from "@/sanity/client";
import { saveReelToBlob, publishInstagramAndFacebook, uploadYoutubeVideo, uploadGBPMedia, buildInstagramCaption, publishInstagramReel, publishFacebookReel } from "@/lib/weeklyAd";
import { getErrorMessage, notifySlackError, notifySlackResult } from "@/lib/error";
import { serverClient } from "@/sanity/serverClient";

export async function POST(req: Request) {
    const started = Date.now();

    try {
        // 1. Parse webhook
        const body = await req.json();

        console.log(
            JSON.stringify(body, null, 2)
        );

        const event = body.event_type;

        // Ignore non-completed events
        if (event !== "avatar_video.success") {
            return NextResponse.json({ ok: true, ignored: true });
        }

        // 2. Lookup ad
        const eventData = body.event_data;
        const videoUrl = eventData.url;
        const adId = eventData.callback_id;
        const heygenVideoId = eventData.video_id;
        const ad = await client.getDocument(adId);
        if (!ad) { throw new Error(`Weekly ad not found for ${adId}`) }
        if (!videoUrl) { throw new Error("HeyGen webhook missing event_data.url") }
        if (!adId) { throw new Error("HeyGen webhook missing callback_id") }

        // 3. Download MP4
        const download = await fetch(videoUrl);
        if (!download.ok) {
            throw new Error("Unable to download HeyGen video.");
        }
        const buffer = Buffer.from(await download.arrayBuffer());

        // 4. Upload to Blob
        const reelUrl = await saveReelToBlob(buffer, `${ad.slug}.mp4`);

        // 5. Instagram caption
        const caption = buildInstagramCaption(ad.caption, ad.hashtags);

        // 6. Instagram + Facebook
        const staticAds = await publishInstagramAndFacebook({
            igUserId: process.env.IG_USER_ID!,
            fbPageId: process.env.FB_PAGE_ID!,
            userAccessToken: process.env.FB_USER_ACCESS_TOKEN!,
            pageAccessToken: process.env.FB_PAGE_ACCESS_TOKEN!,
            imageUrl: ad.imageUrl,
            caption,
        });
        const instagramReelId = await publishInstagramReel({
            igUserId: process.env.IG_USER_ID!,
            userAccessToken: process.env.FB_USER_ACCESS_TOKEN!,
            reelUrl,
            caption,
        })
        const facebookReelId = await publishFacebookReel({
            fbPageId: process.env.FB_PAGE_ID!,
            pageAccessToken: process.env.FB_PAGE_ACCESS_TOKEN!,
            reelUrl,
            caption,
        })

        // 7. YouTube
        const youtubeDescription = `${ad.caption}\n\n${ad.hashtags.join(" ")}`;
        const youtubeVideoId = await uploadYoutubeVideo({ videoBuffer: buffer, title: ad.title, description: youtubeDescription });

        // 8. GBP
        const gbpMediaName = await uploadGBPMedia({ accountId: process.env.GBP_ACCOUNT_ID!, locationId: process.env.GBP_LOCATION_ID!, imageUrl: ad.imageUrl });

        // 9. Update Sanity
        await serverClient.patch(ad._id)
            .set({
                status: "completed",
                heygenVideoId,
                videoUrl,
                youtubeVideoId,
                instagramPostId: staticAds.instagramPostId,
                facebookPostId: staticAds.facebookPostId,
                instagramReelId,
                facebookReelId,
                gbpMediaName,
                completedAt: new Date().toISOString(),
            })
            .commit();

        // 10. Slack
        await notifySlackResult("Weekly Ad Completed", { videoUrl, youtubeVideoId, instagramPostId: staticAds.instagramPostId, facebookPostId: staticAds.facebookPostId, instagramReelId, facebookReelId, gbpMediaName, durationMs: Date.now() - started });
        return NextResponse.json({ ok: true });

    } catch (err) {
        await notifySlackError("Weekly Ad Webhook Failure", err, { error: getErrorMessage(err) });
        return NextResponse.json({ ok: false, error: getErrorMessage(err) }, { status: 500 });
    }
}