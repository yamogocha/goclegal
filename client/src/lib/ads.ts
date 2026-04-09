import os from "os";
import { put } from "@vercel/blob";
import ffmpeg from "fluent-ffmpeg";
import sharp from "sharp";
import path from "path";
import fs from "fs";
import { z } from "zod";
import { openai } from "./openai";
import { toFile } from "openai";


const CreativeSchema = z.object({
    message: z.string().min(5).max(140),
    // cta: z.string().min(5).max(140),
    hashtags: z.array(z.string().min(2).max(40)).min(5).max(25),
  });

type Creative = z.infer<typeof CreativeSchema>

export async function generateCaption(params: { title: string, headline: string }): Promise<Creative> {
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

export function getWeekOfMonth(date: Date = new Date()): 1 | 2 | 3 | 4 {
  const week = Math.ceil(date.getDate() / 7);
  return Math.min(week, 4) as 1 | 2 | 3 | 4;
}

export async function generateImage({ message, template = "instagram", weekNumber }: { message: string, template?: "instagram" | "youtube", weekNumber?: 1 | 2 | 3 | 4 }) {
  const week = weekNumber ?? getWeekOfMonth();
  const templateName = template === "instagram" ? `instagram-ad-${week}.png` : `youtube-short-${week}.png`;
  const templatePath = path.join(process.cwd(), "public", templateName);
  const isYoutube = template === "youtube";

  const images = await Promise.all([
    toFile(fs.createReadStream(templatePath), null, { type: "image/png" }),
  ]);

  const imgPrompt = `
  Edit the PROVIDED ${isYoutube ? "YouTube Shorts vertical (9:16)" : "Instagram square"} ad template image.

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

  2) Update ONLY the attorney's CLOTHING to a different professional outfit for this week.
  - The attorney's face must remain IDENTICAL to the template (same identity, facial features, skin tone, expression).
  - Do not change the attorney's hair, eyes, head shape, age, or ethnicity.
  - Do not change pose, crop, or placement.
  - CRITICAL: The person's face and head must be pixel-identical to the input template. Do not redraw, reimagine, or alter the face in any way whatsoever.
  - Change clothing ONLY. Nothing above the collar changes.
  - Alternate between: a suit/blazer with shirt and tie, or a professional plain-color sweater worn over a shirt and tie. Use neutral, professional colors.

  Output: a clean ${isYoutube ? "9:16 vertical" : "1:1"} image. Do not add anything new. Do not overlay new elements.
  `;

  const size = isYoutube ? "1024x1536" : "1024x1024";

  const img = await openai.images.edit({
    model: "gpt-image-1.5",
    image: images,
    prompt: imgPrompt,
    size: size as any,
    input_fidelity: "high",
    quality: "high",
  });

  const b64 = img.data?.[0]?.b64_json;
  if (!b64) throw new Error("No image returned from image model.");
  return Buffer.from(b64, "base64")
}
// Shared ffmpeg renderer: loops image, adds silent audio, outputs H.264 MP4
export async function renderWithFfmpeg(imageBuffer: Buffer, width: number, height: number): Promise<Buffer> {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    ffmpeg.setFfmpegPath(require("ffmpeg-static"));
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const tmpDir = os.tmpdir();
    const imgPath = path.join(tmpDir, `ad-img-${id}.png`);
    const silentPath = path.join(tmpDir, `ad-silent-${id}.mp3`);
    const outPath = path.join(tmpDir, `ad-out-${id}.mp4`);
  
    // Resize image to exact output dimensions first
    const isVertical = height > width; // YouTube Shorts = true, Instagram = false
  
    const resized = await sharp(imageBuffer)
      .resize(width, height, {
        fit: isVertical ? "contain" : "fill",  // contain = no stretch, fill = Instagram stays as-is
        background: { r: 0, g: 48, b: 91, alpha: 1 }, // #00305b
        kernel: sharp.kernel.lanczos3,
      })
      .png()
      .toBuffer();
      fs.writeFileSync(imgPath, resized);
  
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
  export async function generateVideo({ imageBuffer }: { imageBuffer: Buffer }) {
    return renderWithFfmpeg(imageBuffer, 1080, 1080);
  }
  
  // YouTube Shorts: 1080x1920 vertical — blurred bg + sharp 1080x1080 centered top
  export async function generateYouTubeVideo({ message, weekNumber }: { message: string, weekNumber?: 1 | 2 | 3 | 4 }) {
    const ytImageBuffer = await generateImage({ message, template: "youtube", weekNumber });
    return renderWithFfmpeg(ytImageBuffer, 1080, 1920);
  }
  
  export async function saveAdToBlob(buffer: Buffer, filename: string) {
    // Organize by date/slug so listing later is easy
    const pathname = `ad/${filename}`;
  
    const blob = await put(pathname, buffer, {
      access: "public", // required today
      contentType: "image/png", // or image/png
      token: process.env.BLOB_READ_WRITE_TOKEN,
      addRandomSuffix: true, // avoids collisions
    });
  
    // blob.url is the public URL Meta can fetch
    return blob.url;
  }
  
  export async function saveReelToBlob(videoBuffer: Buffer, filename: string) {
    const pathname = `reel/${filename}`;
  
    const blob = await put(pathname, videoBuffer, {
      access: "public",
      contentType: "video/mp4",
      token: process.env.BLOB_READ_WRITE_TOKEN,
      addRandomSuffix: true,
    });
  
    return blob.url; // public URL Meta can fetch
  }
  
  export function buildInstagramCaption(message: string, hashtags: string[]) {
    const tags = hashtags.map(h => (h.startsWith("#") ? h : `#${h}`)).join(" ");
    return `${message}\n\n${tags}`.trim();
  }