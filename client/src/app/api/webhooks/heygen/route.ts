// app/api/webhooks/heygen/route.ts
import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { client } from "@/sanity/client";
import { serverClient } from "@/sanity/serverClient";
import { generateStoryboard, alignStoryboardToAvatar, storyboardToAlignedTimeline, renderBrollVideo, getVideoDuration } from "@/lib/videoAd";
import { publishInstagramAndFacebook, uploadYoutubeVideo, uploadGBPMedia, buildInstagramCaption, publishInstagramReel, publishFacebookReel, deleteSanityAsset } from "@/lib/weeklyAd";
import { getErrorMessage, notifySlackError, notifySlackResult } from "@/lib/error";

export async function POST(req: Request) {
    const started = Date.now();
    let tempAvatarPath: string | undefined;
    let ad: any;
    let temporaryVideoAssetId: string | undefined;
    let completed = false;
    try {
        const body = await req.json();
        console.log(JSON.stringify(body, null, 2));
        if (body.event_type !== "avatar_video.success") return NextResponse.json({ ok: true, ignored: true });
        const eventData = body.event_data;
        const adId = eventData.callback_id;
        const heygenVideoId = eventData.video_id;
        const heygenVideoUrl = eventData.url;
        if (!adId) throw new Error("HeyGen webhook missing callback_id");
        if (!heygenVideoUrl) throw new Error("HeyGen webhook missing event_data.url");

        // Load temporary job.
        ad = await client.getDocument(adId);
        if (!ad) throw new Error(`Weekly ad not found for ${adId}`);
        if (ad.status === "completed") return NextResponse.json({ ok: true, duplicate: true });
        if (ad.status === "publishing") return NextResponse.json({ ok: true, duplicate: true });
        await serverClient.patch(ad._id).set({ status: "publishing", heygenVideoId }).commit();

        // Download HeyGen video to ephemeral runtime storage.
        const download = await fetch(heygenVideoUrl);
        if (!download.ok) throw new Error("Unable to download HeyGen video.");
        const buffer = Buffer.from(await download.arrayBuffer());
        const tempDir = path.join(process.cwd(), "tmp", "weekly-ad");
        await fs.mkdir(tempDir, { recursive: true });
        tempAvatarPath = path.join(tempDir, `${adId}-heygen.mp4`);
        await fs.writeFile(tempAvatarPath, buffer);

        // Generate 8-beat storyboard, align narration to Greg audio, and build aligned timeline.
        const avatarDuration = await getVideoDuration(tempAvatarPath);
        const storyboard = await generateStoryboard(ad.script, avatarDuration);
        const alignedStoryboard = await alignStoryboardToAvatar(storyboard, tempAvatarPath);
        const timeline = await storyboardToAlignedTimeline(alignedStoryboard);

        // Render final captioned B-roll video with Greg visible between segments.
        const rendered = await renderBrollVideo(timeline, tempAvatarPath, false);
        temporaryVideoAssetId = rendered.assetId;
        const reelUrl = rendered.url;

        // Download rendered video for YouTube while social platforms consume the temporary public Sanity URL.
        const renderedDownload = await fetch(reelUrl);
        if (!renderedDownload.ok) throw new Error("Unable to download rendered B-roll video.");
        const renderedBuffer = Buffer.from(await renderedDownload.arrayBuffer());
        const caption = buildInstagramCaption(ad.caption, ad.hashtags);

        // Static Instagram + Facebook.
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

        // Instagram Reel.
        let instagramReelId = ad.instagramReelId;
        if (!instagramReelId) {
            for (let i = 0; i < 5; i++) {
                try {
                    instagramReelId = await publishInstagramReel({ igUserId: process.env.IG_USER_ID!, userAccessToken: process.env.FB_USER_ACCESS_TOKEN!, reelUrl, caption });
                    break;
                } catch (err) {
                    if (!String(err).includes("Media ID is not available")) throw err;
                    await new Promise(r => setTimeout(r, 10000));
                }
            }
            if (!instagramReelId) throw new Error("Instagram Reel never became ready.");
            await serverClient.patch(ad._id).set({ instagramReelId }).commit();
        }

        // Facebook Reel.
        let facebookReelId = ad.facebookReelId;
        if (!facebookReelId) {
            facebookReelId = await publishFacebookReel({ fbPageId: process.env.FB_PAGE_ID!, pageAccessToken: process.env.FB_PAGE_ACCESS_TOKEN!, reelUrl, caption });
            await serverClient.patch(ad._id).set({ facebookReelId }).commit();
        }

        // YouTube.
        let youtubeVideoId = ad.youtubeVideoId;
        if (!youtubeVideoId) {
            youtubeVideoId = await uploadYoutubeVideo({ videoBuffer: renderedBuffer, title: ad.title, description: `${ad.caption}\n\n${ad.hashtags.join(" ")}` });
            await serverClient.patch(ad._id).set({ youtubeVideoId }).commit();
        }

        // Google Business Profile.
        let gbpMediaName = ad.gbpMediaName;
        if (!gbpMediaName) {
            gbpMediaName = await uploadGBPMedia({ accountId: process.env.GBP_ACCOUNT_ID!, locationId: process.env.GBP_LOCATION_ID!, imageUrl: ad.imageUrl });
            await serverClient.patch(ad._id).set({ gbpMediaName }).commit();
        }

        // Mark publishing complete before deleting temporary resources.
        await serverClient.patch(ad._id).set({ status: "completed", completedAt: new Date().toISOString() }).commit();
        completed = true;

        // Delete temporary Sanity assets and runtime file.
        await deleteSanityAsset(temporaryVideoAssetId);
        await deleteSanityAsset(ad.imageAssetId);
        await serverClient.delete(ad._id).catch(err => console.error("[SANITY] Temporary weeklyAd deletion failed:", err));
        await fs.unlink(tempAvatarPath).catch(() => { });

        // Slack is informational and must not turn a successful publication into a failed webhook.
        await notifySlackResult("Weekly Ad Completed", { videoUrl: reelUrl, heygenVideoId, youtubeVideoId, instagramPostId, facebookPostId, instagramReelId, facebookReelId, gbpMediaName, durationMs: Date.now() - started }).catch(err => console.error("[SLACK] Completion notification failed:", err));

        return NextResponse.json({ ok: true, videoUrl: reelUrl });
    } catch (err) {
        if (tempAvatarPath) await fs.unlink(tempAvatarPath).catch(() => { });
        if (!completed) {
            if (temporaryVideoAssetId) await deleteSanityAsset(temporaryVideoAssetId);
            if (ad?.imageAssetId) await deleteSanityAsset(ad.imageAssetId);
            if (ad?._id) await serverClient.patch(ad._id).set({ status: "pending", error: getErrorMessage(err) }).commit().catch(cleanupErr => console.error("[SANITY] Failed resetting weeklyAd:", cleanupErr));
        }
        await notifySlackError("Weekly Ad Webhook Failure", err, { error: getErrorMessage(err) });
        return NextResponse.json({ ok: false, error: getErrorMessage(err) }, { status: 500 });
    }
}