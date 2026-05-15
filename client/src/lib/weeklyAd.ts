import os from "os";
import { put } from "@vercel/blob";
import ffmpeg from "fluent-ffmpeg";
import sharp from "sharp";
import path from "path";
import fs from "fs";
import { z } from "zod";
import { getOpenAI } from "./openai";
import { toFile } from "openai";
import { getGoogleAccessToken } from "./oauth";
import { client } from "@/sanity/client";
import ffmpegPath from "ffmpeg-static";
import { getErrorMessage, notifySlackError, notifySlackResult } from ".";

export const runtime = "nodejs";

const openai = getOpenAI();

const CreativeSchema = z.object({
  message: z.string().min(5).max(140),
  hashtags: z.array(z.string().min(2).max(40)).min(5).max(25),
});

type Creative = z.infer<typeof CreativeSchema>;

export function getWeekOfMonth(
  date: Date = new Date()
): 1 | 2 | 3 | 4 {
  const week = Math.ceil(date.getDate() / 7);
  return Math.min(week, 4) as 1 | 2 | 3 | 4;
}

export async function generateCaption(params: {
  title: string;
  headline: string;
}): Promise<Creative> {
  try {
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

    const resp = await openai.responses.create({
      model: "gpt-5",
      input: prompt,
    });

    const text = resp.output_text?.trim();

    if (!text) {
      throw new Error("OpenAI returned empty caption response.");
    }

    let parsed: unknown;

    try {
      parsed = JSON.parse(text);
    } catch (err) {
      await notifySlackError(
        "Weekly Ad Caption JSON Parse Failed",
        err,
        {
          responseText: text,
          blogTitle: params.title,
        }
      );

      throw new Error("Caption JSON parsing failed.");
    }

    return CreativeSchema.parse(parsed);
  } catch (err) {
    await notifySlackError(
      "Weekly Ad Caption Generation Failed",
      err,
      {
        blogTitle: params.title,
      }
    );

    throw err;
  }
}

export async function generateImage({
  message,
  template = "instagram",
  weekNumber,
}: {
  message: string;
  template?: "instagram" | "youtube";
  weekNumber?: 1 | 2 | 3 | 4;
}) {
  try {
    const week = weekNumber ?? getWeekOfMonth();

    const templateName =
      template === "instagram"
        ? `instagram-ad-${week}.png`
        : `youtube-short-${week}.png`;

    const templatePath = path.join(
      process.cwd(),
      "public",
      templateName
    );

    const isYoutube = template === "youtube";

    const images = await Promise.all([
      toFile(fs.createReadStream(templatePath), null, {
        type: "image/png",
      }),
    ]);

    const imgPrompt = `
    Edit the PROVIDED ${
      isYoutube
        ? "YouTube Shorts vertical (9:16)"
        : "Instagram square"
    } ad template image.

    NON-NEGOTIABLE (must be pixel-faithful):
    - Keep the background exactly the same.
    - Keep ALL existing small text exactly the same.
    - Keep the CTA button exactly the same.
    - Keep the white logo EXACTLY the same.
    - Keep layout identical.

    Replace ONLY the main message with:
    "${message}"

    Change ONLY the attorney clothing.
    Face/head must remain identical.

    Output: clean ${
      isYoutube ? "9:16 vertical" : "1:1"
    } image.
    `;

    const size: "1024x1024" | "1024x1536" =
      isYoutube ? "1024x1536" : "1024x1024";

    const img = await openai.images.edit({
      model: "gpt-image-1.5",
      image: images,
      prompt: imgPrompt,
      size,
      input_fidelity: "high",
      quality: "high",
    });

    const b64 = img.data?.[0]?.b64_json;

    if (!b64) {
      throw new Error(
        "OpenAI image generation returned no image data."
      );
    }

    return Buffer.from(b64, "base64");
  } catch (err) {
    await notifySlackError(
      "Weekly Ad Image Generation Failed",
      err,
      {
        template,
      }
    );

    throw err;
  }
}

export async function renderWithFfmpeg(
  imageBuffer: Buffer,
  width: number,
  height: number
): Promise<Buffer> {
  ffmpeg.setFfmpegPath(ffmpegPath as string);

  const id = `${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}`;

  const tmpDir = os.tmpdir();

  const imgPath = path.join(
    tmpDir,
    `ad-img-${id}.png`
  );

  const outPath = path.join(
    tmpDir,
    `ad-out-${id}.mp4`
  );

  try {
    // Resize image to target canvas
    const resized = await sharp(imageBuffer)
      .resize(width, height, {
        fit: "contain",
        background: {
          r: 0,
          g: 48,
          b: 91,
          alpha: 1,
        },
      })
      .png()
      .toBuffer();

    fs.writeFileSync(imgPath, resized);

    // Generate MP4 from static image
    await new Promise<void>(
      (resolve, reject) => {
        ffmpeg()
          .input(imgPath)

          .inputOptions([
            "-loop 1",
            "-framerate 30",
          ])

          .outputOptions([
            // duration
            "-t 15",

            // video codec
            "-c:v libx264",

            // quality
            "-preset slow",
            "-profile:v high",
            "-pix_fmt yuv420p",

            // fps
            "-r 30",

            // GOP structure
            "-g 60",
            "-keyint_min 60",
            "-sc_threshold 0",

            // bitrate / quality tuning
            "-crf 18",
            "-b:v 6M",
            "-maxrate 8M",
            "-bufsize 12M",

            // streaming optimization
            "-movflags +faststart",
          ])

          .output(outPath)

          .on("start", (cmd) => {
            console.log(
              "[FFMPEG] start:",
              cmd
            );
          })

          .on("stderr", (line) => {
            console.log(
              "[FFMPEG STDERR]",
              line
            );
          })

          .on("end", () => {
            console.log(
              "[FFMPEG] render complete"
            );

            resolve();
          })

          .on("error", async (err) => {
            const error =
              getErrorMessage(err);

            await notifySlackError(
              "Weekly Ad FFmpeg Render Failed",
              err,
              {
                width,
                height,
                ffmpegPath,
              }
            );

            reject(
              new Error(
                `FFmpeg render failed: ${error}`
              )
            );
          })

          .run();
      }
    );

    if (!fs.existsSync(outPath)) {
      throw new Error(
        "FFmpeg output file was not created."
      );
    }

    const videoBuffer =
      fs.readFileSync(outPath);

    if (!videoBuffer.length) {
      throw new Error(
        "FFmpeg output video is empty."
      );
    }

    return videoBuffer;

  } catch (err) {
    await notifySlackError(
      "Weekly Ad Video Generation Failed",
      err,
      {
        width,
        height,
      }
    );

    throw err;

  } finally {
    try {
      if (fs.existsSync(imgPath)) {
        fs.unlinkSync(imgPath);
      }
    } catch {}

    try {
      if (fs.existsSync(outPath)) {
        fs.unlinkSync(outPath);
      }
    } catch {}
  }
}

export async function generateVideo({
  imageBuffer,
}: {
  imageBuffer: Buffer;
}) {
  return renderWithFfmpeg(imageBuffer, 1080, 1080);
}

export async function generateYouTubeVideo({
  message,
  weekNumber,
}: {
  message: string;
  weekNumber?: 1 | 2 | 3 | 4;
}) {
  const ytImageBuffer = await generateImage({
    message,
    template: "youtube",
    weekNumber,
  });

  return renderWithFfmpeg(ytImageBuffer, 1080, 1920);
}

export async function saveAdToBlob(
  buffer: Buffer,
  filename: string
) {
  try {
    const pathname = `ad/${filename}`;

    const blob = await put(pathname, buffer, {
      access: "public",
      contentType: "image/png",
      token: process.env.BLOB_READ_WRITE_TOKEN,
      addRandomSuffix: true,
    });

    return blob.url;
  } catch (err) {
    await notifySlackError(
      "Weekly Ad Image Blob Upload Failed",
      err,
      {
        filename,
      }
    );

    throw err;
  }
}

export async function saveReelToBlob(
  videoBuffer: Buffer,
  filename: string
) {
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
    await notifySlackError(
      "Weekly Ad Video Blob Upload Failed",
      err,
      {
        filename,
      }
    );

    throw err;
  }
}

export function buildInstagramCaption(
  message: string,
  hashtags: string[]
) {
  const tags = hashtags
    .map((h) => (h.startsWith("#") ? h : `#${h}`))
    .join(" ");

  return `${message}\n\n${tags}`.trim();
}

async function igCreateImagePost(opts: {
  igUserId: string;
  accessToken: string;
  imageUrl: string;
  caption: string;
}) {
  const url = `https://graph.facebook.com/v20.0/${opts.igUserId}/media`;

  const form = new URLSearchParams();

  form.set("image_url", opts.imageUrl);
  form.set("caption", opts.caption);
  form.set(
    "published_platforms",
    '["INSTAGRAM","FACEBOOK"]'
  );
  form.set("access_token", opts.accessToken);

  const res = await fetch(url, {
    method: "POST",
    body: form,
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(
      `Create IG image container failed: ${JSON.stringify(
        data,
        null,
        2
      )}`
    );
  }

  return data.id as string;
}

async function igWaitForContainer(opts: {
  creationId: string;
  accessToken: string;
}) {
  const timeoutMs = 10 * 60_000;
  const started = Date.now();

  while (true) {
    const url =
      `https://graph.facebook.com/v20.0/${opts.creationId}` +
      `?fields=status_code,status` +
      `&access_token=${opts.accessToken}`;

    const res = await fetch(url);
    const data = await res.json();

    if (!res.ok) {
      throw new Error(
        `Read IG container status failed: ${JSON.stringify(
          data,
          null,
          2
        )}`
      );
    }

    const status = data.status_code as string;

    if (status === "FINISHED") {
      return;
    }

    if (status === "ERROR") {
      throw new Error(
        `IG container processing failed: ${JSON.stringify(
          data,
          null,
          2
        )}`
      );
    }

    if (Date.now() - started > timeoutMs) {
      throw new Error(
        `IG container timed out. Last status: ${status}`
      );
    }

    await new Promise((r) => setTimeout(r, 3000));
  }
}

async function igPublish({
  igUserId,
  accessToken,
  creationId,
}: {
  igUserId: string;
  accessToken: string;
  creationId: string;
}) {
  const url = `https://graph.facebook.com/v20.0/${igUserId}/media_publish`;

  const form = new URLSearchParams();

  form.set("creation_id", creationId);
  form.set("access_token", accessToken);

  const res = await fetch(url, {
    method: "POST",
    body: form,
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(
      `IG publish failed: ${JSON.stringify(data, null, 2)}`
    );
  }

  return data.id as string;
}

async function youtubeUploadVideo({
  videoBuffer,
  title,
  description,
}: {
  videoBuffer: Buffer;
  title: string;
  description: string;
}) {
  const accessToken = await getGoogleAccessToken();

  const initRes = await fetch(
    "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "X-Upload-Content-Type": "video/mp4",
        "X-Upload-Content-Length": String(
          videoBuffer.byteLength
        ),
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
    }
  );

  if (!initRes.ok) {
    const err = await initRes.json();

    throw new Error(
      `YouTube upload init failed: ${JSON.stringify(
        err,
        null,
        2
      )}`
    );
  }

  const uploadUrl = initRes.headers.get("location");

  if (!uploadUrl) {
    throw new Error(
      "YouTube upload URL missing from resumable session."
    );
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
    throw new Error(
      `YouTube upload failed: ${JSON.stringify(
        uploadData,
        null,
        2
      )}`
    );
  }

  return uploadData.id as string;
}

async function gbpUploadMedia({
  accountId,
  locationId,
  imageUrl,
}: {
  accountId: string;
  locationId: string;
  imageUrl: string;
}) {
  const accessToken = await getGoogleAccessToken();

  const url = `https://mybusiness.googleapis.com/v4/accounts/${accountId}/locations/${locationId}/media`;

  const payload = {
    mediaFormat: "PHOTO",
    locationAssociation: {
      category: "ADDITIONAL",
    },
    sourceUrl: imageUrl,
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const raw = await res.text();

  let data: any = null;
  let isJson = false;

  try {
    data = JSON.parse(raw);
    isJson = true;
  } catch {}

  if (!res.ok) {
    throw new Error(
      JSON.stringify(
        {
          message: "GBP upload failed",
          status: res.status,
          statusText: res.statusText,
          response: isJson
            ? data
            : raw.slice(0, 1000),
        },
        null,
        2
      )
    );
  }

  if (!isJson) {
    throw new Error(
      `GBP upload returned non-JSON response: ${raw.slice(
        0,
        1000
      )}`
    );
  }

  if (!data?.name) {
    throw new Error(
      `GBP response missing media name: ${JSON.stringify(
        data,
        null,
        2
      )}`
    );
  }

  return data.name as string;
}

export async function generateWeeklyAd(
  {
    preview = false,
    dryRun = false,
  }: {
    preview?: boolean;
    dryRun?: boolean;
  } = {}
) {
  const start = Date.now();

  const result: any = {
    ok: true,
    preview,
    dryRun,
    durationMs: 0,
  };

  try {
    const post = await client.fetch<{
      title: string;
      headline: string;
      slug: string;
      date: string;
    }>(
      `*[_type == "post" && defined(date)] | order(date desc)[0]{title, headline, "slug": slug.current, date}`
    );

    if (!post) {
      throw new Error("No blog post found.");
    }

    const { title, headline, slug } = post;

    const { message, hashtags } =
      await generateCaption({
        title,
        headline,
      });

    const igCaption = buildInstagramCaption(
      message,
      hashtags
    );

    const weekNumber = getWeekOfMonth();

    console.log("[ASSET] generating image");

    const imageBuffer = await generateImage({
      message,
      weekNumber,
    });

    const imageUrl = await saveAdToBlob(
      imageBuffer,
      `${slug}.png`
    );

    console.log("[ASSET] generating IG video");

    const videoBuffer = await generateVideo({
      imageBuffer,
    });

    const videoUrl = await saveReelToBlob(
      videoBuffer,
      `${slug}.mp4`
    );

    console.log("[ASSET] generating YouTube video");

    const youtubeVideoBuffer =
      await generateYouTubeVideo({
        message,
        weekNumber,
      });

    const youtubeVideoUrl =
      await saveReelToBlob(
        youtubeVideoBuffer,
        `${slug}-yt.mp4`
      );

    Object.assign(result, {
      imageUrl,
      videoUrl,
      youtubeVideoUrl,
      caption: message,
      hashtags,
    });

    if (preview || dryRun) {
      result.durationMs = Date.now() - start;
      return result;
    }

    // Instagram
    try {
      const creationId = await igCreateImagePost({
        igUserId: process.env.IG_USER_ID!,
        accessToken:
          process.env.FB_ACCESS_TOKEN!,
        imageUrl,
        caption: igCaption,
      });

      await igWaitForContainer({
        creationId,
        accessToken:
          process.env.FB_ACCESS_TOKEN!,
      });

      const postId = await igPublish({
        igUserId: process.env.IG_USER_ID!,
        accessToken:
          process.env.FB_ACCESS_TOKEN!,
        creationId,
      });

      result.postId = postId;
    } catch (err) {
      result.ok = false;

      result.igError = getErrorMessage(err);

      await notifySlackError(
        "Weekly Ad Instagram Publish Failed",
        err,
        {
          slug,
          title,
          platform: "instagram",
        }
      );
    }

    // YouTube
    try {
      const youtubeDescription = `${message}

#Shorts

${hashtags
  .map((h) =>
    h.startsWith("#") ? h : `#${h}`
  )
  .join(" ")}`;

      const youtubeVideoId =
        await youtubeUploadVideo({
          videoBuffer:
            youtubeVideoBuffer,
          title,
          description:
            youtubeDescription,
        });

      result.youtubeVideoId =
        youtubeVideoId;
    } catch (err) {
      result.ok = false;

      result.youtubeError =
        getErrorMessage(err);

      await notifySlackError(
        "Weekly Ad YouTube Publish Failed",
        err,
        {
          slug,
          title,
          platform: "youtube",
        }
      );
    }

    // GBP
    try {
      const gbpMediaName =
        await gbpUploadMedia({
          accountId:
            process.env.GBP_ACCOUNT_ID!,
          locationId:
            process.env.GBP_LOCATION_ID!,
          imageUrl,
        });

      result.gbpMediaName =
        gbpMediaName;
    } catch (err) {
      result.ok = false;

      result.gbpError =
        getErrorMessage(err);

      await notifySlackError(
        "Weekly Ad GBP Publish Failed",
        err,
        {
          slug,
          title,
          platform: "gbp",
        }
      );
    }

    result.ok =
      !result.igError &&
      !result.youtubeError &&
      !result.gbpError;

    result.durationMs = Date.now() - start;

    await notifySlackResult(
      "Weekly Ad Result",
      result
    );

    return result;
  } catch (err) {
    await notifySlackError(
      "Weekly Ad Fatal Pipeline Failure",
      err,
      {
        preview,
        dryRun,
      }
    );

    return {
      ok: false,
      error: getErrorMessage(err),
      durationMs: Date.now() - start,
    };
  }
}