import { openai } from "@/lib/openai";
import { toFile } from "openai";
import { client } from "@/sanity/client";
import { NextResponse } from "next/server";
import path from "path";
import { z } from "zod";
import fs from "fs";
import { put } from "@vercel/blob";
import Creatomate from "creatomate";

export const runtime = "nodejs";

const CreativeSchema = z.object({
    message: z.string().min(5).max(140),
    // cta: z.string().min(5).max(140),
    hashtags: z.array(z.string().min(2).max(40)).min(5).max(25),
  });

type Creative = z.infer<typeof CreativeSchema>

async function generateCaption(params: { title: string, headline: string }): Promise<Creative> {
  const prompt = `
  Write ONE Instagram caption for GOC Legal (California personal injury).
  Tone: modern, credible, calm. No emojis. No legal advice. No phone/email/website in the caption.
  Goal: spark curiosity to read more.

  REQUIREMENTS:
  - 1–2 sentences about the blog topic.
  - MUST end with this exact sentence (verbatim, including punctuation):
    "Read our blog to find out what your rights are. Link in bio!"
  - Keep total caption length <= 140 characters (including the required ending).

  Blog:
  Title: ${params.title}
  Headline: ${params.headline ?? ""}

  Return ONLY JSON:
  {"message": string, "hashtags": string[]}

  Hashtags: 8-15. CA + personal injury + safety + local intent. No spaces inside hashtags.
  `;

  const resp = await openai.responses.create({ model: "gpt-5", input: prompt });
  const text = resp.output_text.trim() ?? "";
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch(err: any) {
      throw new Error(`Invalid JSON: ${err.message}`);
  }
  return CreativeSchema.parse(parsed);
}

// Generates the background image only — message text is intentionally omitted
// so Creatomate can animate it on top in generateVideo()
async function generateImage() {
  const templatePath = path.join(process.cwd(), "public", "ad-template.jpeg");
  const attorneyPath = path.join(process.cwd(), "public", "attorney.png");
  const logoPath = path.join(process.cwd(), "public", "white-logo.png");

  const images = await Promise.all([
    toFile(fs.createReadStream(templatePath), null, { type: "image/jpeg" }),
    toFile(fs.createReadStream(attorneyPath), null, { type: "image/png" }),
    toFile(fs.createReadStream(logoPath), null, { type: "image/png" }),
  ]);

  const imgPrompt = `
  Edit the PROVIDED Instagram square ad template image.

  NON-NEGOTIABLE (must be pixel-faithful):
  - Keep the background exactly the same (pattern, shapes, texture, gradients). Keep primary color #00305b.
  - Keep ALL existing small text exactly the same: phone number, email, website, and services list.
  - Keep the CTA button exactly the same.
  - Keep the white logo EXACTLY the same. Do NOT redraw it, do NOT restyle it, do NOT change its edges. It must match the template.
  - Keep the overall layout/spacing/positioning exactly identical to the template.
  - Clear the large message text area completely — replace it with the same solid background color (#00305b). No text, no placeholder.

  ONLY make this one change:
  1) Update ONLY the attorney’s CLOTHING to a different professional outfit for this week.
  - The attorney’s face must remain IDENTICAL to the template (same identity, facial features, skin tone, expression).
  - Do not change the attorney’s hair, eyes, head shape, age, or ethnicity.
  - Do not change pose, crop, or placement.
  - Change clothing only (suit/blazer/shirt/tie), professional neutral colors.

  Output: a clean 1:1 image. Do not add anything new. Do not overlay new elements.
  `;

  const img = await openai.images.edit({ model: "gpt-image-1.5", image: images, prompt: imgPrompt, size: "1024x1024", input_fidelity: "high" });
  const b64 = img.data?.[0]?.b64_json;
  if (!b64) throw new Error("No image returned from image model.");
  return Buffer.from(b64, "base64")
}

// Renders a 15-second MP4: background image + message text fading in line by line
async function generateVideo({ imageUrl, message }: { imageUrl: string; message: string }) {
  const creatomate = new Creatomate.Client(process.env.CREATOMATE_API_KEY!);

  const renders = await creatomate.render({
    source: {
      outputFormat: "mp4",
      width: 1080,
      height: 1080,
      duration: 15,
      frameRate: 30,
      elements: [
        {
          type: "image",
          source: imageUrl,
          width: "100%",
          height: "100%",
          fit: "cover",
        },
        {
          type: "text",
          text: message,
          width: "72%",
          height: "30%",
          xAlignment: "50%",
          yAlignment: "42%",
          fontSize: "5.5 vmin",
          fontWeight: "700",
          fillColor: "#ffffff",
          animations: [
            {
              type: "text-slide",
              scope: "line",
              splitBy: "line",
              direction: "up",
              fade: true,
              easing: "quadratic-out",
              duration: 0.6,
              start: 0.5,
            },
          ],
        },
      ],
    },
  });

  const videoUrl = renders[0].url;
  if (!videoUrl) throw new Error("No video URL returned from Creatomate.");

  const res = await fetch(videoUrl);
  return Buffer.from(await res.arrayBuffer());
}

// Renders a 1920x1080 MP4 for YouTube:
// - blurred square image fills the background
// - sharp square image centered on top
// - message text fades in line by line over the sharp image
async function generateYouTubeVideo({ imageUrl, message }: { imageUrl: string; message: string }) {
  const creatomate = new Creatomate.Client(process.env.CREATOMATE_API_KEY!);

  const renders = await creatomate.render({
    source: {
      outputFormat: "mp4",
      width: 1920,
      height: 1080,
      duration: 15,
      frameRate: 30,
      elements: [
        // Layer 1: blurred + darkened background
        {
          type: "image",
          source: imageUrl,
          width: "100%",
          height: "100%",
          fit: "cover",
          blur: 24,
          brightness: -0.15,
        },
        // Layer 2: sharp square image centered
        {
          type: "image",
          source: imageUrl,
          width: "56.25%", // 1080 / 1920
          height: "100%",
          xAlignment: "50%",
          yAlignment: "50%",
          fit: "cover",
        },
        // Layer 3: animated text over the sharp square
        {
          type: "text",
          text: message,
          width: "38%",
          height: "30%",
          xAlignment: "50%",
          yAlignment: "42%",
          fontSize: "5.5 vmin",
          fontWeight: "700",
          fillColor: "#ffffff",
          animations: [
            {
              type: "text-slide",
              scope: "line",
              splitBy: "line",
              direction: "up",
              fade: true,
              easing: "quadratic-out",
              duration: 0.6,
              start: 0.5,
            },
          ],
        },
      ],
    },
  });

  const ytVideoUrl = renders[0].url;
  if (!ytVideoUrl) throw new Error("No YouTube video URL returned from Creatomate.");

  const res = await fetch(ytVideoUrl);
  return Buffer.from(await res.arrayBuffer());
}

async function saveAdToBlob(buffer: Buffer, filename: string) {
  // Organize by date/slug so listing later is easy
  const pathname = `ad/${filename}`;

  const blob = await put(pathname, buffer, {
    access: "public", // required today
    contentType: "image/jpeg", // or image/jpeg
    token: process.env.BLOB_READ_WRITE_TOKEN,
    addRandomSuffix: true, // avoids collisions
  });

  // blob.url is the public URL Meta can fetch
  return blob.url;
}

async function saveReelToBlob(videoBuffer: Buffer, filename: string) {
  const pathname = `reel/${filename}`;

  const blob = await put(pathname, videoBuffer, {
    access: "public",
    contentType: "video/mp4",
    token: process.env.BLOB_READ_WRITE_TOKEN,
    addRandomSuffix: true,
  });

  return blob.url; // public URL Meta can fetch
}

function buildInstagramCaption(message: string, hashtags: string[]) {
  const tags = hashtags.map(h => (h.startsWith("#") ? h : `#${h}`)).join(" ");
  return `${message}\n\n${tags}`.trim();
}

async function igCreateImageContainer({ igUserId, accessToken, imageUrl, caption }:{
  igUserId: string; accessToken: string; imageUrl: string; caption: string;
}) {
  const url = `https://graph.facebook.com/v20.0/${igUserId}/media`;
  const form = new URLSearchParams();
  form.set("image_url", imageUrl);
  form.set("caption", caption);
  form.set("access_token", accessToken);

  const res = await fetch(url, { method: "POST", body: form });
  const data = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(data));
  return data.id as string;
}

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
      `?fields=status_code` +
      `&access_token=${opts.accessToken}`;

    const res = await fetch(url);
    const data = await res.json();
    if (!res.ok) throw new Error(`Read container status failed: ${JSON.stringify(data)}`);

    const status = data.status_code as string;

    if (status === "FINISHED") return;
    if (status === "ERROR") throw new Error(`Container processing ERROR: ${JSON.stringify(data)}`);

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

async function youtubeGetAccessToken() {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: process.env.YOUTUBE_REFRESH_TOKEN!,
      client_id: process.env.GBP_CLIENT_ID!,
      client_secret: process.env.GBP_CLIENT_SECRET!,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`YouTube token refresh failed: ${JSON.stringify(data)}`);
  return data.access_token as string;
}

async function youtubeUploadVideo({ videoBuffer, title, description }: {
  videoBuffer: Buffer;
  title: string;
  description: string;
}) {
  const accessToken = await youtubeGetAccessToken();

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
    body: videoBuffer,
  });

  const uploadData = await uploadRes.json();
  if (!uploadRes.ok) throw new Error(`YouTube video upload failed: ${JSON.stringify(uploadData)}`);
  return uploadData.id as string; // YouTube video ID
}

async function gbpRefreshAccessToken() {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: process.env.GBP_REFRESH_TOKEN!,
      client_id: process.env.GBP_CLIENT_ID!,
      client_secret: process.env.GBP_CLIENT_SECRET!,
    }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(`GBP token refresh failed: ${JSON.stringify(data)}`);
  return data.access_token as string;
}

async function gbpUploadMedia({ accountId, locationId, imageUrl }: {
  accountId: string;
  locationId: string;
  imageUrl: string;
}) {
  const accessToken = await gbpRefreshAccessToken();
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

  const data = await res.json();
  if (!res.ok) throw new Error(`GBP upload failed: ${JSON.stringify(data)}`);
  return data.name as string;
}

export async function generateWeeklyAd() {
  const post = await client.fetch<{title: string, headline: string, slug: string, date: string}>(`*[_type == "post" && defined(date)] | order(date desc)[0]{title, headline, "slug": slug.current, date}`)
  if (!post) throw new Error("No post found");
  const { title, headline, slug } = post
  const { message, hashtags } = await generateCaption({ title, headline });
  const igCaption = buildInstagramCaption(message, hashtags);

  // 1) generate background image (no message text)
  const imageBuffer = await generateImage();
  const imageUrl = await saveAdToBlob(imageBuffer, `${slug}.png`);

  // 2) generate square video (1080x1080) for Instagram Reel
  const videoBuffer = await generateVideo({ imageUrl, message });
  const videoUrl = await saveReelToBlob(videoBuffer, `${slug}.mp4`);

  // 2b) generate widescreen video (1920x1080) for YouTube
  const youtubeVideoBuffer = await generateYouTubeVideo({ imageUrl, message });

  // 3) publish to Instagram as Reel
  const igUserId = process.env.IG_USER_ID!;
  const accessToken = process.env.FB_ACCESS_TOKEN!;

  const creationId = await igCreateReelContainer({ igUserId, accessToken, videoUrl, caption: igCaption });
  await igWaitForContainer({ creationId, accessToken });
  const postId = await igPublish({ igUserId, accessToken, creationId });

  // 4) upload background image to Google Business Profile
  const gbpMediaName = await gbpUploadMedia({
    accountId: process.env.GBP_ACCOUNT_ID!,
    locationId: process.env.GBP_LOCATION_ID!,
    imageUrl,
  });

  // 5) upload widescreen video to YouTube
  const youtubeDescription = `${message}\n\n${hashtags.map(h => (h.startsWith("#") ? h : `#${h}`)).join(" ")}`;
  const youtubeVideoId = await youtubeUploadVideo({ videoBuffer: youtubeVideoBuffer, title, description: youtubeDescription });

  return { postId, gbpMediaName, youtubeVideoId, imageUrl, videoUrl, caption: message, hashtags }
}

export async function POST() {
  try {
      const result = await generateWeeklyAd()
      return NextResponse.json({ ok: true, ...result })
  } catch(err: any) {
      return NextResponse.json({ error: err.message }, { status: 500 })
  }
}