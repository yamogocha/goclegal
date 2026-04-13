
import { client } from "@/sanity/client";
import { NextResponse } from "next/server";
import { generateVideo, generateYouTubeVideo, saveAdToBlob, saveReelToBlob, buildInstagramCaption, generateImage, getWeekOfMonth, generateCaption } from "@/lib/ads";
import { getGoogleAccessToken } from "@/lib/oauth";

export const runtime = "nodejs";


async function igCreateReelContainer(opts: {
  igUserId: string;
  accessToken: string;
  videoUrl: string;
  caption: string;
}) {
  const url = `https://graph.facebook.com/v20.0/${opts.igUserId}/media`;

  const form = new URLSearchParams();
  form.set("media_type", "REELS");
  form.set("video_url", opts.videoUrl);
  form.set("caption", opts.caption);
  form.set("share_to_feed", "true");
  form.set("published_platforms", '["INSTAGRAM", "FACEBOOK"]');
  form.set("access_token", opts.accessToken);

  const res = await fetch(url, { method: "POST", body: form });
  const data = await res.json();
  if (!res.ok) throw new Error(`Create REELS container failed: ${JSON.stringify(data)}`);

  return data.id as string; // creation_id
}

async function igWaitForContainer(opts: {
  creationId: string;
  accessToken: string;
}) {
  const timeoutMs = 10 * 60_000; // 10 minutes
  const started = Date.now();

  while (true) {
    const url =
      `https://graph.facebook.com/v20.0/${opts.creationId}` +
      `?fields=status_code,status` +
      `&access_token=${opts.accessToken}`;

    const res = await fetch(url);
    const data = await res.json();
    if (!res.ok) throw new Error(`Read container status failed: ${JSON.stringify(data)}`);

    const status = data.status_code as string;

    if (status === "FINISHED") return;
    if (status === "ERROR") throw new Error(`Container processing ERROR: ${JSON.stringify(data)} | detail: ${JSON.stringify(data.status)}`);

    if (Date.now() - started > timeoutMs) {
      throw new Error(`Timed out waiting for container. Last status: ${status}`);
    }

    await new Promise(r => setTimeout(r, 3000)); // wait 3s
  }
}

async function igPublish({ igUserId, accessToken, creationId }:{
  igUserId: string; accessToken: string; creationId: string;
}) {
  const url = `https://graph.facebook.com/v20.0/${igUserId}/media_publish`;
  const form = new URLSearchParams();
  form.set("creation_id", creationId);
  form.set("access_token", accessToken);

  const res = await fetch(url, { method: "POST", body: form });
  const data = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(data));
  return data.id as string;
}

async function youtubeUploadVideo({ videoBuffer, title, description }: {
  videoBuffer: Buffer;
  title: string;
  description: string;
}) {
  const accessToken = await getGoogleAccessToken();

  // Step 1: initiate resumable upload session
  const initRes = await fetch(
    "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "X-Upload-Content-Type": "video/mp4",
        "X-Upload-Content-Length": String(videoBuffer.byteLength),
      },
      body: JSON.stringify({
        snippet: {
          title,
          description,
          categoryId: "22", // People & Blogs
        },
        status: {
          privacyStatus: "public",
          selfDeclaredMadeForKids: false,
        },
      }),
    }
  );

  if (!initRes.ok) {
    const err = await initRes.json();
    throw new Error(`YouTube upload init failed: ${JSON.stringify(err)}`);
  }

  const uploadUrl = initRes.headers.get("location");
  if (!uploadUrl) throw new Error("YouTube did not return an upload URL.");

  // Step 2: upload video bytes
  const uploadRes = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": "video/mp4",
      "Content-Length": String(videoBuffer.byteLength),
    },
    body: new Uint8Array(videoBuffer),
  });

  const uploadData = await uploadRes.json();
  if (!uploadRes.ok) throw new Error(`YouTube video upload failed: ${JSON.stringify(uploadData)}`);
  return uploadData.id as string; // YouTube video ID
}

async function gbpUploadMedia({ accountId, locationId, imageUrl }: {
  accountId: string;
  locationId: string;
  imageUrl: string;
}) {
  const accessToken = await getGoogleAccessToken();
  const url = `https://mybusiness.googleapis.com/v4/${accountId}/${locationId}/media`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      mediaFormat: "PHOTO",
      locationAssociation: { category: "ADDITIONAL" },
      sourceUrl: imageUrl,
    }),
  });

  const text = await res.text(); // ← read as text first

  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`GBP upload failed with non-JSON response (${res.status}): ${text.slice(0, 200)}`);
  }

  if (!res.ok) throw new Error(`GBP upload failed: ${JSON.stringify(data)}`);
  if (
    typeof data !== "object" ||
    data === null ||
    !("name" in data) ||
    typeof (data as { name: unknown }).name !== "string"
  ) {
    throw new Error("GBP upload response missing name");
  }
  return (data as { name: string }).name;
}

export async function generateWeeklyAd({ preview = false, dryRun = false }: { preview?: boolean, dryRun?: boolean } = {}) {
  const post = await client.fetch<{title: string, headline: string, slug: string, date: string}>(`*[_type == "post" && defined(date)] | order(date desc)[0]{title, headline, "slug": slug.current, date}`)
  if (!post) throw new Error("No post found");
  const { title, headline, slug } = post
  const { message, hashtags } = await generateCaption({ title, headline });
  const igCaption = buildInstagramCaption(message, hashtags);

  const weekNumber = getWeekOfMonth();

  // 1) generate image with message text baked in by OpenAI
  const imageBuffer = await generateImage({ message, weekNumber });
  const imageUrl = await saveAdToBlob(imageBuffer, `${slug}.png`);

  // 2) generate square video (1080x1080) for Instagram Reel
  const videoBuffer = await generateVideo({ imageBuffer });
  const videoUrl = await saveReelToBlob(videoBuffer, `${slug}.mp4`);

  // 2b) generate widescreen video (1920x1080) for YouTube
  const youtubeVideoBuffer = await generateYouTubeVideo({ message, weekNumber });
  const youtubeVideoUrl = await saveReelToBlob(youtubeVideoBuffer, `${slug}-yt.mp4`);

  if (preview) {
    return { preview: true, imageUrl, videoUrl, youtubeVideoUrl, caption: igCaption }
  }

  // Instagram
  const igUserId = process.env.IG_USER_ID!;
  const accessToken = process.env.FB_ACCESS_TOKEN!;
  const creationId = await igCreateReelContainer({ igUserId, accessToken, videoUrl, caption: igCaption });
  await igWaitForContainer({ creationId, accessToken });
  const postId = await igPublish({ igUserId, accessToken, creationId });

  // YouTube
    const youtubeDescription = `${message}\n\n#Shorts\n\n${hashtags.map(h => (h.startsWith("#") ? h : `#${h}`)).join(" ")}`;
    const youtubeVideoId = await youtubeUploadVideo({ videoBuffer: youtubeVideoBuffer, title, description: youtubeDescription });

  if (dryRun) {
    return { dryRun: true, imageUrl, videoUrl, youtubeVideoUrl, youtubeVideoId, caption: message, hashtags }
  }
  
  // GBP
  try {
    const gbpMediaName = await gbpUploadMedia({
      accountId: process.env.GBP_ACCOUNT_ID!,
      locationId: process.env.GBP_LOCATION_ID!,
      imageUrl,
    });
    console.log("[ad] GBP mediaName:", gbpMediaName);
  } catch (err: unknown) {
    console.error("[ad] GBP upload FAILED:", err instanceof Error ? err.message : String(err));
  }

  return { postId, youtubeVideoId, imageUrl, videoUrl, youtubeVideoUrl, caption: message, hashtags }
}

export async function POST(req: Request) {
  const { searchParams } = new URL(req.url);
  const preview = searchParams.get("preview") === "true";
  const dryRun = searchParams.get("dryRun") === "true";

  try {
      const result = await generateWeeklyAd({ preview, dryRun })
      return NextResponse.json({ ok: true, ...result })
  } catch (err: unknown) {
      console.error("[ad/generate] error:", err);
      const message = err instanceof Error ? err.message : String(err);
      const stack = err instanceof Error ? err.stack : undefined;
      return NextResponse.json({ error: message, stack }, { status: 500 })
  }
}