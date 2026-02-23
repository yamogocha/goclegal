import { openai } from "@/lib/openai";
import { toFile } from "openai";
import { client } from "@/sanity/client";
import { NextResponse } from "next/server";
import path from "path";
import { z } from "zod";
import fs from "fs";
import { put } from "@vercel/blob";

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

async function generateImage(params: { message: string }) {
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

  ONLY make these two changes:
  1) Replace ONLY the large message text block with this exact text (no extra words):
  "${params.message}"
  Match the same font style and font size seen in the template message. Keep the same spacing and line-break feel.

  2) Update ONLY the attorney’s CLOTHING to a different professional outfit for this week.
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

export async function generateWeeklyAd() {
  const post = await client.fetch<{title: string, headline: string, slug: string, date: string}>(`*[_type == "post" && defined(date)] | order(date desc)[0]{title, headline, "slug": slug.current, date}`)
  if (!post) throw new Error("No post found");
  const { title, headline, slug } = post
  const { message, hashtags } = await generateCaption({ title, headline });
  const media = await generateImage({ message });
  const filename = `${slug}.png`
  const imageUrl = await saveAdToBlob(media, filename)
  const igCaption = buildInstagramCaption(message, hashtags);

  // 4) create container + publish
  const igUserId = process.env.IG_USER_ID!;
  const accessToken = process.env.FB_ACCESS_TOKEN!; // page/user token with publish perms

  const creationId = await igCreateImageContainer({ igUserId, accessToken, imageUrl, caption: igCaption });  
  await igWaitForContainer({ creationId, accessToken })                
  const postId = await igPublish({ igUserId, accessToken, creationId });

  return { postId, imageUrl, caption: message, hashtags }
}

export async function POST() {
  try {
      const result = await generateWeeklyAd()
      return NextResponse.json({ ok: true, ...result })
  } catch(err: any) {
      return NextResponse.json({ error: err.message }, { status: 500 })
  }
}