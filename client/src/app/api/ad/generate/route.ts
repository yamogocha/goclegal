import { openai } from "@/lib/openai";
import { toFile } from "openai";
import { client } from "@/sanity/client";
import { NextResponse } from "next/server";
import path from "path";
import { z } from "zod";
import fs from "fs";
import os from "os";
import { put } from "@vercel/blob";
import ffmpeg from "fluent-ffmpeg";
import sharp from "sharp";

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

async function generateImage({ message }: { message: string }) {
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

  Make ONLY these two changes:
  1) Replace the large message text with: "${message}"
  - Use the EXACT same font style, size, weight, color, and position as the existing message text in the template.
  - Do not reformat or reposition the text block.

  2) Update ONLY the attorney’s CLOTHING to a different professional outfit for this week.
  - The attorney’s face must remain IDENTICAL to the template (same identity, facial features, skin tone, expression).
  - Do not change the attorney’s hair, eyes, head shape, age, or ethnicity.
  - Do not change pose, crop, or placement.
  - Change clothing only. Alternate between: a suit/blazer with shirt and tie, or a professional plain-color sweater worn over a shirt and tie. Use neutral, professional colors.

  Output: a clean 1:1 image. Do not add anything new. Do not overlay new elements.
  `;

  const img = await openai.images.edit({ model: "gpt-image-1.5", image: images, prompt: imgPrompt, size: "1024x1024", input_fidelity: "high" });
  const b64 = img.data?.[0]?.b64_json;
  if (!b64) throw new Error("No image returned from image model.");
  return Buffer.from(b64, "base64")
}

// Shared ffmpeg renderer: loops image, adds silent audio, outputs H.264 MP4
async function renderWithFfmpeg(imageBuffer: Buffer): Promise<Buffer> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  ffmpeg.setFfmpegPath(require("ffmpeg-static"));
  const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const tmpDir = os.tmpdir();
  const imgPath = path.join(tmpDir, `ad-img-${id}.png`);
  const silentPath = path.join(tmpDir, `ad-silent-${id}.mp3`);
  const outPath = path.join(tmpDir, `ad-out-${id}.mp4`);

  fs.writeFileSync(imgPath, imageBuffer);

  // Download silent audio
  const silentRes = await fetch(process.env.SILENT_AUDIO_URL!);
  fs.writeFileSync(silentPath, Buffer.from(await silentRes.arrayBuffer()));

  try {
    const stderrLines: string[] = [];
    await new Promise<void>((resolve, reject) => {
      ffmpeg()
        .input(imgPath).inputOptions(["-loop 1"])
        .input(silentPath)
        .outputOptions([
          "-map 0:v", "-map 1:a",
          "-c:v libx264", "-preset fast", "-crf 23",
          "-c:a aac", "-b:a 128k",
          "-t 15", "-r 30", "-pix_fmt yuv420p",
          "-movflags +faststart",
          "-shortest",
        ])
        .output(outPath)
        .on("stderr", (line) => { stderrLines.push(line); console.error("[ffmpeg]", line); })
        .on("end", () => resolve())
        .on("error", (err) =>
          reject(new Error(`ffmpeg error: ${err.message}\n${stderrLines.join("\n")}`))
        )
        .run();
    });
    return fs.readFileSync(outPath);
  } finally {
    for (const f of [imgPath, silentPath, outPath]) {
      try { fs.unlinkSync(f); } catch {}
    }
  }
}

// Instagram: 1080x1080 — image already has text baked in by OpenAI
async function generateVideo({ imageBuffer }: { imageBuffer: Buffer }) {
  return renderWithFfmpeg(imageBuffer);
}

// YouTube: 1920x1080 — blurred bg + sharp 1080x1080 image centered
async function generateYouTubeVideo({ imageBuffer }: { imageBuffer: Buffer }) {
  const blurredBg = await sharp(imageBuffer)
    .resize(1920, 1080, { fit: "cover" })
    .blur(20)
    .png()
    .toBuffer();

  const squareLayer = await sharp(imageBuffer)
    .resize(1080, 1080)
    .png()
    .toBuffer();

  const finalFrame = await sharp(blurredBg)
    .composite([{ input: squareLayer, top: 0, left: 420 }])
    .png()
    .toBuffer();

  return renderWithFfmpeg(finalFrame);
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
    body: new Uint8Array(videoBuffer),
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

export async function generateWeeklyAd({ preview = false }: { preview?: boolean } = {}) {
  const post = await client.fetch<{title: string, headline: string, slug: string, date: string}>(`*[_type == "post" && defined(date)] | order(date desc)[0]{title, headline, "slug": slug.current, date}`)
  if (!post) throw new Error("No post found");
  const { title, headline, slug } = post
  const { message, hashtags } = await generateCaption({ title, headline });
  const igCaption = buildInstagramCaption(message, hashtags);

  // 1) generate image with message text baked in by OpenAI
  const imageBuffer = await generateImage({ message });
  const imageUrl = await saveAdToBlob(imageBuffer, `${slug}.png`);

  // 2) generate square video (1080x1080) for Instagram Reel
  const videoBuffer = await generateVideo({ imageBuffer });
  const videoUrl = await saveReelToBlob(videoBuffer, `${slug}.mp4`);

  // 2b) generate widescreen video (1920x1080) for YouTube
  const youtubeVideoBuffer = await generateYouTubeVideo({ imageBuffer });
  const youtubeVideoUrl = await saveReelToBlob(youtubeVideoBuffer, `${slug}-yt.mp4`);

  if (preview) {
    return { preview: true, imageUrl, videoUrl, youtubeVideoUrl, caption: igCaption }
  }

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

export async function POST(req: Request) {
  const { searchParams } = new URL(req.url);
  const preview = searchParams.get("preview") === "true";
  try {
      const result = await generateWeeklyAd({ preview })
      return NextResponse.json({ ok: true, ...result })
  } catch(err: any) {
      console.error("[ad/generate] error:", err);
      return NextResponse.json({ error: err?.message || String(err), stack: err?.stack }, { status: 500 })
  }
}