import { put } from "@vercel/blob";
import path from "path";
import fs from "fs";
import { z } from "zod";
import { getOpenAI, weeklyAdCaptionPrompt, weeklyVideoPrompt } from "./openai";
import { toFile } from "openai";
import { getGoogleAccessToken } from "./oauth";
import { client } from "@/sanity/client";
import { getErrorMessage, notifySlackError, notifySlackResult } from "./error";
import { serverClient } from "@/sanity/serverClient";
import { del } from "@vercel/blob";

export const runtime = "nodejs";

const openai = getOpenAI();

const ScriptSchema = z.object({ title: z.string().min(5), script: z.string().max(840) });
type Script = z.infer<typeof ScriptSchema>;

const CreativeSchema = z.object({
  caption: z.string().min(5).max(140),
  hashtags: z.array(z.string().min(2).max(40)).min(5).max(25),
});
type Creative = z.infer<typeof CreativeSchema>;

export function getWeekOfMonth(date: Date = new Date()): 1 | 2 | 3 | 4 {
  const week = Math.ceil(date.getDate() / 7);
  return Math.min(week, 4) as 1 | 2 | 3 | 4;
}

export async function generateScript(params: { title: string; headline: string }): Promise<Script> {
  try {
    const prompt = weeklyVideoPrompt(params);

    const resp = await openai.responses.create({ model: "gpt-5", input: prompt });
    const text = resp.output_text?.trim();
    if (!text) {
      throw new Error("OpenAI returned empty video script response.");
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch (err) {
      await notifySlackError("Weekly video script JSON Parse Failed", err, { responseText: text, blogTitle: params.title });
      throw new Error("Video script JSON parsing failed.");
    }

    return ScriptSchema.parse(parsed);
  } catch (err) {
    await notifySlackError("Weekly Ad Caption Generation Failed", err, { blogTitle: params.title });
    throw err;
  }
}

export async function generateCaption(params: { title: string; headline: string }): Promise<Creative> {
  try {
    const prompt = weeklyAdCaptionPrompt(params);

    const resp = await openai.responses.create({ model: "gpt-5", input: prompt });
    const text = resp.output_text?.trim();
    if (!text) {
      throw new Error("OpenAI returned empty caption response.");
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch (err) {
      await notifySlackError("Weekly Ad Caption JSON Parse Failed", err, { responseText: text, blogTitle: params.title });
      throw new Error("Caption JSON parsing failed.");
    }

    return CreativeSchema.parse(parsed);
  } catch (err) {
    await notifySlackError("Weekly Ad Caption Generation Failed", err, { blogTitle: params.title });
    throw err;
  }
}

export async function generateImage({ caption, template = "instagram", weekNumber }: { caption: string; template?: "instagram" | "youtube"; weekNumber?: 1 | 2 | 3 | 4 }) {
  try {
    const week = weekNumber ?? getWeekOfMonth();
    const templateName = template === "instagram" ? `instagram-ad-${week}.png` : `youtube-short-${week}.png`;
    const templatePath = path.join(process.cwd(), "public", templateName);
    const isYoutube = template === "youtube";
    const images = await Promise.all([toFile(fs.createReadStream(templatePath), null, { type: "image/png" })]);

    const imgPrompt = `
    Edit the PROVIDED ${isYoutube ? "YouTube Shorts vertical (9:16)" : "Instagram square"} ad template image.

    NON-NEGOTIABLE (must be pixel-faithful):
    - Keep the background exactly the same.
    - Keep the large ALL-CAPS headline exactly the same
    - Keep ALL existing small text exactly the same.
    - Keep the CTA button exactly the same.
    - Keep the white logo EXACTLY the same.
    - Keep layout identical.

    Replace ONLY the quoted body message with:
    "${caption}"

    Change ONLY the attorney clothing.
    Face/head must remain identical.

    Output: clean ${isYoutube ? "9:16 vertical" : "1:1"} image.
    `;

    const size: "1024x1024" | "1024x1536" = isYoutube ? "1024x1536" : "1024x1024";
    const img = await openai.images.edit({ model: "gpt-image-1.5", image: images, prompt: imgPrompt, size, input_fidelity: "high", quality: "high" });
    const b64 = img.data?.[0]?.b64_json;
    if (!b64) {
      throw new Error("OpenAI image generation returned no image data.");
    }
    return Buffer.from(b64, "base64");
  } catch (err) {
    await notifySlackError("Weekly Ad Image Generation Failed", err, { template });
    throw err;
  }
}

export async function createHeyGenVideo({
  script,
  adId,
}: {
  script: string;
  adId: string;
}) {
  const res = await fetch("https://api.heygen.com/v3/videos", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Api-Key": process.env.HEYGEN_API_KEY! },
    body: JSON.stringify({
      type: "avatar", avatar_id: process.env.HEYGEN_AVATAR_ID!, voice_id: process.env.HEYGEN_VOICE_ID!,
      script, title: `Weekly Ad ${adId}`, resolution: "1080p", aspect_ratio: "9:16", fit: "cover", output_format: "mp4",
      engine: { type: "avatar_v" }, voice_settings: { speed: 1 }, caption: { file_format: "srt", style: "default" },
      callback_url: `${process.env.BASE_URL}/api/webhooks/heygen`, callback_id: adId,
    })
  });

  if (!res.ok) throw new Error(await res.text());
  const json = await res.json();
  const videoId = json?.data?.video_id;
  if (!videoId) {
    throw new Error(`HeyGen did not return a video_id: ${JSON.stringify(json)}`);;
  }

  return videoId;
}

export async function saveStaticAdToBlob(imageBuffer: Buffer, filename: string) {
  try {
    const pathname = `ad/${filename}`;
    const blob = await put(pathname, imageBuffer, {
      access: "public",
      contentType: "image/png",
      token: process.env.BLOB_READ_WRITE_TOKEN,
      addRandomSuffix: true,
    });
    return blob.url;
  } catch (err) {
    await notifySlackError("Weekly Ad Image Blob Upload Failed", err, { filename });
    throw err;
  }
}

export async function saveReelToBlob(videoBuffer: Buffer, filename: string) {
  try {
    const pathname = `reel/${filename}`;
    const blob = await put(pathname, videoBuffer, {
      access: "public",
      contentType: "video/mp4",
      token: process.env.BLOB_READ_WRITE_TOKEN,
      addRandomSuffix: true,
    });
    return blob.url;
  } catch (err) {
    await notifySlackError("Weekly Ad Video Blob Upload Failed", err, { filename });
    throw err;
  }
}

export function buildInstagramCaption(message: string, hashtags: string[]) {
  const tags = hashtags.map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" ");
  return `${message}\n\n${tags}`.trim();
}

export async function publishInstagramAndFacebook(opts: { igUserId: string; fbPageId: string; userAccessToken: string; pageAccessToken: string; imageUrl: string; caption: string }) {
  // INSTAGRAM
  const igCreateUrl = `https://graph.facebook.com/v20.0/${opts.igUserId}/media`;
  const igForm = new URLSearchParams();
  igForm.set("image_url", opts.imageUrl);
  igForm.set("caption", opts.caption);
  igForm.set("access_token", opts.userAccessToken);

  const igCreateRes = await fetch(igCreateUrl, { method: "POST", body: igForm });
  const igCreateData = await igCreateRes.json();

  if (!igCreateRes.ok) {
    throw new Error(`IG container creation failed: ${JSON.stringify(igCreateData, null, 2)}`);
  }
  const creationId = igCreateData.id;

  // Wait for IG processing
  const timeoutMs = 10 * 60_000;
  const started = Date.now();
  while (true) {
    const statusUrl = `https://graph.facebook.com/v20.0/${creationId}` + `?fields=status_code,status` + `&access_token=${opts.userAccessToken}`;
    const statusRes = await fetch(statusUrl);
    const statusData = await statusRes.json();
    if (!statusRes.ok) {
      throw new Error(`IG container status failed: ${JSON.stringify(statusData, null, 2)}`);
    }
    const status = statusData.status_code;
    if (status === "FINISHED") { break }
    if (status === "ERROR") {
      throw new Error(`IG processing failed: ${JSON.stringify(statusData, null, 2)}`);
    }
    if (Date.now() - started > timeoutMs) {
      throw new Error(`IG processing timed out. Last status: ${status}`);
    }
    await new Promise((r) => setTimeout(r, 3000));
  }

  // Publish IG media
  const igPublishUrl = `https://graph.facebook.com/v20.0/${opts.igUserId}/media_publish`;
  const igPublishForm = new URLSearchParams();
  igPublishForm.set("creation_id", creationId);
  igPublishForm.set("access_token", opts.userAccessToken);
  const igPublishRes = await fetch(igPublishUrl, { method: "POST", body: igPublishForm });
  const igPublishData = await igPublishRes.json();
  if (!igPublishRes.ok) {
    throw new Error(`IG publish failed: ${JSON.stringify(igPublishData, null, 2)}`);
  }

  // FACEBOOK PAGE POST
  const fbPostUrl = `https://graph.facebook.com/v20.0/${opts.fbPageId}/photos`;
  const fbForm = new URLSearchParams();
  fbForm.set("url", opts.imageUrl);
  fbForm.set("caption", opts.caption);
  fbForm.set("published", "true");
  fbForm.set("access_token", opts.pageAccessToken);
  const fbRes = await fetch(fbPostUrl, { method: "POST", body: fbForm });
  const fbData = await fbRes.json();
  if (!fbRes.ok) {
    throw new Error(`Facebook publish failed: ${JSON.stringify(fbData, null, 2)}`);
  }
  return { instagramPostId: igPublishData.id, facebookPostId: fbData.post_id ?? fbData.id };
}

export async function publishInstagramReel(opts: {
  igUserId: string;
  userAccessToken: string;
  reelUrl: string;
  caption: string;
}) {
  // Create Reel container
  const createForm = new URLSearchParams();
  createForm.set("media_type", "REELS");
  createForm.set("video_url", opts.reelUrl);
  createForm.set("caption", opts.caption);
  createForm.set("access_token", opts.userAccessToken);

  const createRes = await fetch(`https://graph.facebook.com/v20.0/${opts.igUserId}/media`, { method: "POST", body: createForm });
  const createData = await createRes.json();
  if (!createRes.ok) {
    throw new Error(`IG Reel creation failed: ${JSON.stringify(createData, null, 2)}`);
  }
  const creationId = createData.id;

  // Wait for processing
  const timeout = Date.now() + 10 * 60_000;
  while (true) {
    const statusRes = await fetch(`https://graph.facebook.com/v20.0/${creationId}?fields=status_code&access_token=${opts.userAccessToken}`);
    const status = await statusRes.json();
    if (!statusRes.ok) {
      throw new Error(JSON.stringify(status));
    }

    if (status.status_code === "FINISHED") {
      // Instagram sometimes reports FINISHED slightly before
      // the media is actually publishable.
      await new Promise(r => setTimeout(r, 5000));
      break
    }
    if (status.status_code === "ERROR") {
      throw new Error(JSON.stringify(status));
    }
    if (Date.now() > timeout) {
      throw new Error("Instagram Reel processing timed out.");
    }
    await new Promise(r => setTimeout(r, 3000));
  }

  // Publish
  const publishForm = new URLSearchParams();
  publishForm.set("creation_id", creationId);
  publishForm.set("access_token", opts.userAccessToken);
  for (let i = 0; i < 5; i++) {
    const publishRes = await fetch(`https://graph.facebook.com/v20.0/${opts.igUserId}/media_publish`, { method: "POST", body: publishForm });
    const publishData = await publishRes.json();
    if (publishRes.ok) { return publishData.id }
    if (JSON.stringify(publishData).includes("Media ID is not available")) {
      await new Promise(r => setTimeout(r, 10000));
      continue
    }
    throw new Error(`IG Reel publish failed: ${JSON.stringify(publishData, null, 2)}`);
  }
}

export async function publishFacebookReel(opts: {
  fbPageId: string;
  pageAccessToken: string;
  reelUrl: string;
  caption: string;
}) {
  const form = new URLSearchParams();
  form.set("file_url", opts.reelUrl);
  form.set("description", opts.caption);
  form.set("published", "true");
  form.set("access_token", opts.pageAccessToken);

  const res = await fetch(`https://graph.facebook.com/v20.0/${opts.fbPageId}/videos`, { method: "POST", body: form });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Facebook Reel upload failed: ${JSON.stringify(data, null, 2)}`);
  }
  return data.id;
}

export async function uploadYoutubeVideo({ videoBuffer, title, description }: { videoBuffer: Buffer; title: string; description: string }) {
  const accessToken = await getGoogleAccessToken();
  const initRes = await fetch("https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "X-Upload-Content-Type": "video/mp4",
      "X-Upload-Content-Length": String(videoBuffer.byteLength),
    },
    body: JSON.stringify({
      snippet: {
        title,
        description,
        categoryId: "22",
      },
      status: {
        privacyStatus: "public",
        selfDeclaredMadeForKids: false,
      },
    }),
  });

  if (!initRes.ok) {
    const err = await initRes.json();
    throw new Error(`YouTube upload init failed: ${JSON.stringify(err, null, 2)}`);
  }

  const uploadUrl = initRes.headers.get("location");
  if (!uploadUrl) {
    throw new Error("YouTube upload URL missing from resumable session.");
  }

  const uploadRes = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": "video/mp4",
      "Content-Length": String(videoBuffer.byteLength),
    },
    body: new Uint8Array(videoBuffer),
  });

  const uploadData = await uploadRes.json();
  if (!uploadRes.ok) {
    throw new Error(`YouTube upload failed: ${JSON.stringify(uploadData, null, 2)}`);
  }

  return uploadData.id as string;
}

export async function uploadGBPMedia({ accountId, locationId, imageUrl }: { accountId: string; locationId: string; imageUrl: string }) {
  const accessToken = await getGoogleAccessToken();
  const url = `https://mybusiness.googleapis.com/v4/accounts/${accountId}/locations/${locationId}/media`;
  const payload = { mediaFormat: "PHOTO", locationAssociation: { category: "ADDITIONAL" }, sourceUrl: imageUrl };
  const res = await fetch(url, { method: "POST", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  const raw = await res.text();
  let data: any = null;
  let isJson = false;
  try { data = JSON.parse(raw); isJson = true } catch { }

  if (!res.ok) {
    throw new Error(JSON.stringify({ message: "GBP upload failed", status: res.status, statusText: res.statusText, response: isJson ? data : raw.slice(0, 1000) }, null, 2));
  }
  if (!isJson) {
    throw new Error(`GBP upload returned non-JSON response: ${raw.slice(0, 1000)}`);
  }
  if (!data?.name) {
    throw new Error(`GBP response missing media name: ${JSON.stringify(data, null, 2)}`);
  }
  return data.name as string;
}

export async function getHeyGenVideo(videoId: string) {
  const res = await fetch(`https://api.heygen.com/v3/videos/${videoId}`, { headers: { "X-Api-Key": process.env.HEYGEN_API_KEY! } });
  if (!res.ok) {
    throw new Error(await res.text());
  }
  return res.json();
}

export async function deleteBlob(url?: string) {
  if (!url) return;
  try {
    await del(url, {
      token: process.env.BLOB_READ_WRITE_TOKEN!,
    });
    console.log("Deleted Blob:", url);
  } catch (err) {
    console.error("Unable to delete Blob:", err);
  }
}

export async function generateWeeklyAd({ dryRun = false }: { dryRun?: boolean } = {}) {
  const start = Date.now();
  const result: any = { ok: true, dryRun, durationMs: 0 };

  try {
    const post = await client.fetch<{ title: string; headline: string; slug: string; date: string }>(`*[_type == "post" && defined(date)] | order(date desc)[0]{title, headline, "slug": slug.current, date}`);
    if (!post) { throw new Error("No blog post found.") }

    const { title, headline, slug } = post;
    const { script } = await generateScript({ title, headline });
    const { caption, hashtags } = await generateCaption({ title, headline });
    const weekNumber = getWeekOfMonth();

    console.log("[ASSET] generating image");
    const imageBuffer = await generateImage({ caption, weekNumber });
    const imageUrl = await saveStaticAdToBlob(imageBuffer, `${slug}.png`);

    console.log("[ASSET] creating ad");
    const weeklyAd = await serverClient.create({ _type: "weeklyAd", status: "pending", title, slug, script, caption, hashtags, imageUrl });
    const heygenVideoId = await createHeyGenVideo({ script, adId: weeklyAd._id });
    await serverClient.patch(weeklyAd._id).set({ heygenVideoId }).commit();
    Object.assign(result, { imageUrl, heygenVideoId });

    if (dryRun) {
      for (let i = 0; i < 60; i++) {
        await new Promise(r => setTimeout(r, 5000));
        const status = await getHeyGenVideo(heygenVideoId);
        if (status.data.status === "completed") {
          result.videoUrl = status.data.video_url;
          return result;
        }
        if (status.data.status === "failed") {
          throw new Error(status.data.failure_reason);
        }
      }
      throw new Error("HeyGen timed out.");
    }

    result.durationMs = Date.now() - start;
    await notifySlackResult("Weekly Ad Result", result);
    return result;
  } catch (err) {
    await notifySlackError("Weekly Ad Fatal Pipeline Failure", err, { dryRun });
    return { ok: false, error: getErrorMessage(err), durationMs: Date.now() - start };
  }
}
