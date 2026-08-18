import groq from "groq";
import { client } from "@/sanity/client";
import fs from "node:fs/promises";
import path from "node:path";
import ffmpeg from "fluent-ffmpeg";
import sharp from "sharp";
import { getOpenAI, storyboardFromLibraryPrompt } from "./openai";
import { serverClient } from "@/sanity/serverClient";

const openai = getOpenAI();
const FADE = 0.35;

// Types.
export type TimelineInputClip = { id: string; type: "avatar" | "asset"; assetSlug?: string; narration: string; duration: number; start?: number; };
export type TimelineInput = { clips: TimelineInputClip[]; };
type TimelineClip = TimelineInputClip & { start: number; imageUrl?: string; imageWidth?: number; imageHeight?: number; };
type Timeline = { clips: TimelineClip[]; };
export type ReusableStoryAsset = { title: string; slug: string; category: StoryboardBeat["category"]; tags: string[]; prompt: string; imageUrl: string; orientation?: string; isReusable?: boolean; };
type GeneratedStoryAsset = StoryboardBeat & { imageUrl?: string; reused: boolean; resolvedSlug: string | null; };
type StoryAsset = { title: string; slug: string; imageUrl: string; metadata: { dimensions: { width: number; height: number } } };
type ImageRenderAsset = { id: string; type: "asset"; localPath: string; duration: number; start: number; narration: string; };
type RenderClip = { id: string; videoPath: string; start: number; duration: number; };
type CaptionWord = { word: string; start: number; end: number; };
type CaptionSegment = { text?: string; start?: number; end?: number };


// Storyboard schema.
// Storyboard beat.
export type StoryboardBeat = {
    id: string;
    narration: string;
    title: string;
    slug: string;
    category: "accident" | "insurance" | "medical" | "evidence";
    tags: string[];
    prompt: string;
    assetSlug: string | null;
    visualType: "asset" | "greg";
    duration: number;
    start?: number;
};

// Storyboard schema.
const StoryboardSchema = {
    type: "object",
    additionalProperties: false,
    properties: {
        beats: {
            type: "array",
            minItems: 1,
            items: {
                type: "object",
                additionalProperties: false,
                properties: {
                    id: { type: "string", pattern: "^[a-z0-9]+(?:_[a-z0-9]+)*$" },
                    narration: { type: "string" },
                    title: { type: "string" },
                    slug: { type: "string", pattern: "^[a-z0-9]+(?:_[a-z0-9]+)*$" },
                    category: { type: "string", enum: ["accident", "insurance", "medical", "evidence"] },
                    tags: { type: "array", items: { type: "string", pattern: "^[a-z0-9_]+$" }, minItems: 1, maxItems: 3 },
                    prompt: { type: "string", maxLength: 400 },
                    assetSlug: { type: ["string", "null"] },
                    visualType: { type: "string", enum: ["asset", "greg"] },
                },
                required: ["id", "narration", "title", "slug", "category", "tags", "prompt", "assetSlug", "visualType"],
            },
        },
    },
    required: ["beats"],
} as const;

// Normalize narration for exact script coverage.
function normalizeNarration(text: string): string {
    return text.replace(/^\s*\d+:\d+\s*/, "").toLowerCase().replace(/[’‘]/g, "'").replace(/[^a-z0-9\s']/g, " ").replace(/\s+/g, " ").trim();
}

// Validate complete narration coverage.
function validateStoryboardCoverage(script: string, beats: Omit<StoryboardBeat, "duration">[]) {
    const sourceWords = normalizeNarration(script).split(/\s+/).filter(Boolean);
    const storyboardWords = normalizeNarration(beats.map(b => b.narration).join(" ")).split(/\s+/).filter(Boolean);
    if (sourceWords.length !== storyboardWords.length) throw new Error(`Storyboard coverage mismatch: script has ${sourceWords.length} words but storyboard has ${storyboardWords.length}.`);
    for (let i = 0; i < sourceWords.length; i++) {
        if (sourceWords[i] !== storyboardWords[i]) throw new Error(`Storyboard narration mismatch at word ${i + 1}: expected "${sourceWords[i]}" but received "${storyboardWords[i]}".`);
    }
}

// Generate storyboard from available library assets.
export async function generateStoryboard(script: string, avatarDuration: number): Promise<StoryboardBeat[]> {
    const assets = await client.fetch<ReusableStoryAsset[]>(reusableStoryAssetsQuery);
    if (!assets.length) throw new Error("No reusable StoryAssets found in Sanity.");

    const assetsByCategory = {
        accident: assets.filter(a => a.category === "accident"),
        insurance: assets.filter(a => a.category === "insurance"),
        medical: assets.filter(a => a.category === "medical"),
        evidence: assets.filter(a => a.category === "evidence"),
    };

    const response = await openai.responses.create({
        model: "gpt-5",
        input: storyboardFromLibraryPrompt(script, avatarDuration, assetsByCategory),
        text: {
            format: {
                type: "json_schema",
                name: "storyboard",
                strict: true,
                schema: StoryboardSchema,
            },
        },
    });

    const { beats } = JSON.parse(response.output_text) as { beats: Omit<StoryboardBeat, "duration">[] };

    if (beats.length !== 8) throw new Error(`Expected exactly 8 storyboard beats, received ${beats.length}.`);
    validateStoryboardCoverage(script, beats);

    const validAssets = new Map(assets.map(a => [a.slug, a]));
    for (const beat of beats) {
        if (beat.visualType === "asset" && beat.assetSlug && !validAssets.has(beat.assetSlug)) throw new Error(`Storyboard selected unavailable StoryAsset: ${beat.assetSlug}.`);
        if (beat.visualType === "greg" && beat.assetSlug !== null) throw new Error(`Greg beat "${beat.id}" must have assetSlug=null.`);
    }

    const wordCounts = beats.map(b => normalizeNarration(b.narration).split(/\s+/).filter(Boolean).length);
    const totalWords = wordCounts.reduce((a, b) => a + b, 0);
    let elapsed = 0;

    const storyboard = beats.map((beat, i) => {
        const duration = i === beats.length - 1 ? avatarDuration - elapsed : avatarDuration * (wordCounts[i] / totalWords);
        const result = { ...beat, id: beat.slug, duration };
        elapsed += duration;
        return result;
    });

    await notifyConceptSuggestions(storyboard).catch(error => console.error("[SLACK] Concept notification failed:", error));
    return storyboard;
}

// Notify Slack when a storyboard needs a new library concept.
async function notifyConceptSuggestions(beats: StoryboardBeat[]) {
    const webhook = process.env.SLACK_ALERTS_URL;
    if (!webhook) return;

    const suggestions = beats
        .filter(b => b.visualType === "asset" && !b.assetSlug)
        .map(b => `• *${b.slug}*\n  ${b.narration}`)
        .join("\n\n");

    if (!suggestions) return;

    const response = await fetch(webhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: `*Review concepts suggestions*\n\n${suggestions}` }),
    });

    if (!response.ok) throw new Error(`Slack notification failed: ${response.status}`);
}

// Avatar timing.
export async function getVideoDuration(file: string): Promise<number> {
    return new Promise((resolve, reject) => ffmpeg.ffprobe(file, (err, data) => err ? reject(err) : resolve(Number(data.format.duration))));
}

async function transcribeGreg(avatar: string): Promise<CaptionWord[]> {
    const audioPath = path.join(path.dirname(avatar), "greg-caption-audio.m4a");
    await new Promise<void>((resolve, reject) => ffmpeg(avatar).noVideo().audioCodec("aac").audioBitrate("128k").outputOptions(["-y"]).on("end", resolve).on("error", reject).save(audioPath));
    const buffer = await fs.readFile(audioPath);
    const file = new File([buffer], "greg-caption-audio.m4a", { type: "audio/mp4" });
    const transcription = await openai.audio.transcriptions.create({ file, model: "whisper-1", response_format: "verbose_json", timestamp_granularities: ["word", "segment"] });
    await fs.unlink(audioPath).catch(() => { });
    const words = (transcription.words ?? []).map((w: any) => ({ word: w.word.trim(), start: Number(w.start), end: Number(w.end) })).filter(w => w.word);
    return applySegmentPunctuation(words, (transcription.segments ?? []) as CaptionSegment[]);
}

function normalizeAlignWord(text: string): string {
    return text.toLowerCase().replace(/[’‘`]/g, "'").replace(/[^a-z0-9']/g, "").replace(/^'+|'+$/g, "");
}

function wordSimilarity(a: string, b: string): number {
    if (!a || !b) return 0;
    if (a === b) return 1;
    if (a.replace(/'/g, "") === b.replace(/'/g, "")) return 1;
    if (a.startsWith(b) || b.startsWith(a)) return 0.85;
    return 0;
}

function alignmentScore(target: string[], spoken: string[]): number {
    if (!target.length || !spoken.length) return 0;
    const rows = target.length + 1;
    const cols = spoken.length + 1;
    const dp = Array.from({ length: rows }, () => Array(cols).fill(0));

    for (let i = 1; i < rows; i++) dp[i][0] = i * -0.45;
    for (let j = 1; j < cols; j++) dp[0][j] = j * -0.2;

    for (let i = 1; i < rows; i++) {
        for (let j = 1; j < cols; j++) {
            const match = dp[i - 1][j - 1] + wordSimilarity(target[i - 1], spoken[j - 1]);
            const skipTarget = dp[i - 1][j] - 0.45;
            const skipSpoken = dp[i][j - 1] - 0.2;
            dp[i][j] = Math.max(match, skipTarget, skipSpoken);
        }
    }

    return Math.max(0, dp[target.length][spoken.length] / target.length);
}

export async function alignStoryboardToAvatar(storyboard: StoryboardBeat[], avatar: string): Promise<StoryboardBeat[]> {
    const words = await transcribeGreg(avatar);
    const normalizedWords = words.map(w => normalizeAlignWord(w.word));
    let cursor = 0;

    return storyboard.map(beat => {
        const target = beat.narration.split(/\s+/).map(normalizeAlignWord).filter(Boolean);
        let bestStart = -1;
        let bestEnd = -1;
        let bestScore = 0;

        const minWindow = Math.max(1, target.length - 2);
        const maxWindow = Math.min(target.length + 4, normalizedWords.length);

        for (let start = cursor; start < normalizedWords.length; start++) {
            for (let size = minWindow; size <= maxWindow && start + size <= normalizedWords.length; size++) {
                const candidate = normalizedWords.slice(start, start + size);
                const score = alignmentScore(target, candidate);

                if (score > bestScore) {
                    bestScore = score;
                    bestStart = start;
                    bestEnd = start + size - 1;
                }

                if (score >= 0.92) break;
            }

            if (bestScore >= 0.92) break;
        }

        if (bestStart < 0 || bestScore < 0.70) {
            throw new Error(`Could not align storyboard narration to Greg audio: "${beat.narration}" (best score ${bestScore.toFixed(2)})`);
        }

        const start = words[bestStart].start;
        const end = words[bestEnd].end;
        cursor = bestEnd + 1;

        console.log(`[TIMING] ${beat.id}: ${start.toFixed(2)}s → ${end.toFixed(2)}s (${(end - start).toFixed(2)}s, score ${bestScore.toFixed(2)})`);

        return { ...beat, start, duration: end - start };
    });
}

const reusableStoryAssetsQuery = groq`*[_type=="storyAsset" && isReusable != false]{title,"slug":slug.current,category,tags,prompt,"imageUrl":image.asset->url,orientation,isReusable}`;

// Resolve only StoryAssets explicitly selected by the storyboard.
export async function generateAssets(storyboard: StoryboardBeat[]): Promise<GeneratedStoryAsset[]> {
    const slugs = storyboard.map(b => b.assetSlug).filter((s): s is string => Boolean(s));
    if (!slugs.length) return storyboard.map(b => ({ ...b, reused: false, resolvedSlug: null }));

    const assets = await client.fetch<ReusableStoryAsset[]>(
        groq`*[_type=="storyAsset" && slug.current in $slugs]{
            title,
            "slug":slug.current,
            category,
            tags,
            prompt,
            "imageUrl":image.asset->url,
            orientation,
            isReusable
        }`,
        { slugs }
    );

    const map = new Map(assets.map(a => [a.slug, a]));

    return storyboard.map(beat => {
        if (!beat.assetSlug || beat.visualType === "greg") return { ...beat, reused: false, resolvedSlug: null };

        const asset = map.get(beat.assetSlug);
        if (!asset) throw new Error(`Storyboard selected missing StoryAsset: ${beat.assetSlug}`);

        console.log(`[ASSET] "${beat.id}" → "${asset.slug}"`);
        return { ...beat, imageUrl: asset.imageUrl, reused: true, resolvedSlug: asset.slug };
    });
}

// Map storyboard-selected assets directly into the aligned timeline.
export async function storyboardToAlignedTimeline(storyboard: StoryboardBeat[]): Promise<TimelineInput> {
    return {
        clips: storyboard
            .filter(beat => beat.visualType === "asset" && beat.assetSlug && beat.start != null)
            .map(beat => {
                const duration = Math.min(2.8, Math.max(1.6, beat.duration * 0.52));
                const start = beat.start! + (beat.duration - duration) / 2;
                return { id: beat.id, type: "asset", assetSlug: beat.assetSlug!, narration: beat.narration, start, duration };
            }),
    };
}

// Timeline.
export async function storyboardToTimeline(storyboard: StoryboardBeat[], assetSlugMap: Record<string, string | null>): Promise<TimelineInput> {
    let beatStart = 0;
    const clips: TimelineInputClip[] = [];
    for (const beat of storyboard) {
        const assetSlug = assetSlugMap[beat.id];
        if (assetSlug) {
            const duration = Math.min(2.8, Math.max(1.6, beat.duration * 0.52));
            const start = beatStart + (beat.duration - duration) / 2;
            clips.push({ id: beat.id, type: "asset", assetSlug, narration: beat.narration, start, duration });
        }
        beatStart += beat.duration;
    }
    return { clips };
}

function buildTimeline(input: TimelineInput): Timeline {
    let t = 0;
    return { clips: input.clips.map(c => { const start = c.start ?? t; const clip = { ...c, start }; t = Math.max(t, start + c.duration); return clip; }) };
}

// Resolve Sanity assets.
const storyAssetsBySlugs = groq`*[_type=="storyAsset" && slug.current in $slugs]{"title":title,"slug":slug.current,"imageUrl":image.asset->url,"metadata":image.asset->metadata{dimensions}}`;

async function resolveStoryAssets(timeline: Timeline): Promise<Timeline> {
    const slugs = [...new Set(timeline.clips.filter(c => c.type === "asset").map(c => c.assetSlug!))];
    const docs = await client.fetch<StoryAsset[]>(storyAssetsBySlugs, { slugs });
    const map = new Map(docs.map(d => [d.slug, d]));

    return {
        clips: timeline.clips.map(c => {
            if (c.type === "avatar") return c;
            const asset = map.get(c.assetSlug);
            if (!asset) throw new Error(`Missing StoryAsset: ${c.assetSlug}`);
            return { ...c, imageUrl: asset.imageUrl, imageWidth: asset.metadata.dimensions.width, imageHeight: asset.metadata.dimensions.height };
        }),
    };
}

// Download render assets.
async function downloadRenderAssets(timeline: Timeline, renderDir: string): Promise<ImageRenderAsset[]> {
    await fs.mkdir(renderDir, { recursive: true });
    const assets: ImageRenderAsset[] = [];

    for (const clip of timeline.clips) {
        if (clip.type !== "asset") continue;
        const res = await fetch(clip.imageUrl!);
        if (!res.ok) throw new Error(`Failed downloading ${clip.assetSlug}`);
        const buffer = Buffer.from(await res.arrayBuffer());
        const localPath = path.join(renderDir, `${String(clip.start).padStart(3, "0")}_${clip.assetSlug}.png`);
        await fs.writeFile(localPath, buffer);
        assets.push({ id: clip.id, type: "asset", localPath, duration: clip.duration, start: clip.start, narration: clip.narration });
    }

    return assets;
}

// Render images as B-roll.
async function renderKenBurns(assets: ImageRenderAsset[], outDir: string, avatarDuration: number): Promise<RenderClip[]> {
    await fs.mkdir(outDir, { recursive: true });

    return Promise.all(assets.map(a => new Promise<RenderClip>((resolve, reject) => {
        const out = path.join(outDir, `${String(a.start).padStart(3, "0")}_${a.id}.mp4`);
        const hasFollowingClip = a.start + a.duration < avatarDuration - 0.01;
        const renderDuration = a.duration + (hasFollowingClip ? FADE : 0);

        ffmpeg(a.localPath)
            .inputOptions(["-loop 1"])
            .videoFilters("scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,format=yuv420p")
            .outputOptions([`-t ${renderDuration}`, "-r 30", "-pix_fmt yuv420p", "-c:v libx264", "-preset medium", "-crf 18", "-movflags +faststart", "-y"])
            .on("end", () => resolve({ id: a.id, videoPath: out, start: a.start, duration: a.duration }))
            .on("error", reject)
            .save(out);
    })));
}

// Render Greg between B-roll clips.
async function renderGregSegment(avatar: string, start: number, duration: number, out: string, addFade: boolean): Promise<RenderClip> {
    const renderDuration = duration + (addFade ? FADE : 0);

    await new Promise<void>((resolve, reject) => ffmpeg(avatar)
        .inputOptions([`-ss ${start}`])
        .outputOptions([`-t ${renderDuration}`, "-an", "-vf", "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,format=yuv420p", "-r 30", "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-y"])
        .on("end", resolve)
        .on("error", reject)
        .save(out));

    return { id: `greg-${start}`, videoPath: out, start, duration };
}

async function buildVisualTimeline(assets: RenderClip[], avatar: string, avatarDuration: number, outDir: string): Promise<RenderClip[]> {
    await fs.mkdir(outDir, { recursive: true });
    const sortedAssets = [...assets].sort((a, b) => a.start - b.start);
    const segments: RenderClip[] = [];
    let cursor = 0;

    for (const asset of sortedAssets) {
        if (asset.start < cursor - 0.01) throw new Error(`Overlapping B-roll clips: ${asset.id} starts at ${asset.start}s before ${cursor}s.`);

        if (asset.start > cursor + 0.01) {
            const duration = asset.start - cursor;
            segments.push(await renderGregSegment(avatar, cursor, duration, path.join(outDir, `greg-${String(cursor).padStart(3, "0")}.mp4`), true));
        }

        segments.push(asset);
        cursor = asset.start + asset.duration;
    }

    if (cursor < avatarDuration - 0.01) segments.push(await renderGregSegment(avatar, cursor, avatarDuration - cursor, path.join(outDir, `greg-${String(cursor).padStart(3, "0")}-final.mp4`), false));

    return segments.sort((a, b) => a.start - b.start);
}

// Crossfade visual segments.
async function crossfadeTimeline(clips: RenderClip[], output: string, totalDuration: number) {
    if (!clips.length) throw new Error("No visual clips to assemble.");
    const sorted = [...clips].sort((a, b) => a.start - b.start);
    const command = ffmpeg();
    sorted.forEach(c => command.input(c.videoPath));
    const filters: string[] = [];
    sorted.forEach((c, i) => filters.push(`[${i}:v]fps=30,scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,format=yuv420p,settb=1/30,setpts=PTS-STARTPTS[v${i}]`));
    let current = "v0";
    let accumulatedDuration = sorted[0].duration;
    for (let i = 1; i < sorted.length; i++) {
        const next = `xf${i}`;
        filters.push(`[${current}][v${i}]xfade=transition=fade:duration=${FADE}:offset=${accumulatedDuration}[${next}]`);
        current = next;
        accumulatedDuration += sorted[i].duration;
    }
    filters.push(`[${current}]trim=start=0:duration=${totalDuration},setpts=PTS-STARTPTS[outv]`);
    await new Promise<void>((resolve, reject) => command.complexFilter(filters).outputOptions(["-map [outv]", "-an", "-t", String(totalDuration), "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-y"]).on("end", resolve).on("error", reject).save(output));
    return output;
}

// Captions.
function punctuationOf(text: string): string { return text.trim().match(/[.,!?;:]+(?:["'’)]*)$/)?.[0] ?? ""; }

function normalizeCaptionWord(text: string): string { return text.toLowerCase().replace(/[.,!?;:%'"’)\]}]+$/g, "").replace(/[^a-z0-9]/g, ""); }

function joinCaptionWords(words: CaptionWord[]): string {
    return words.reduce((text, w) => {
        const word = w.word.trim();
        if (!text) return word;
        if (/^[.,!?;:%)\]}]/.test(word) || /^['’]/.test(word)) return `${text}${word}`;
        return `${text} ${word}`;
    }, "");
}

function applySegmentPunctuation(words: CaptionWord[], segments: CaptionSegment[]): CaptionWord[] {
    return words.map(word => {
        const normalized = normalizeCaptionWord(word.word);
        const segment = segments.find(s => Number(s.start) <= word.start + 0.05 && Number(s.end) >= word.end - 0.05);
        if (!segment?.text) return word;
        const match = (segment.text.match(/\S+/g) ?? []).find(token => normalizeCaptionWord(token) === normalized);
        return match ? { ...word, word: `${word.word.replace(/[.,!?;:%]+$/g, "")}${punctuationOf(match)}` } : word;
    });
}

function buildCaptionLines(words: CaptionWord[]): { start: number; end: number; text: string }[] {
    const captions: { start: number; end: number; text: string }[] = [];
    let current: CaptionWord[] = [];
    const maxCaptionChars = 92;
    const minWords = 12;
    const maxWords = 18;

    for (const word of words) {
        const candidate = joinCaptionWords([...current, word]);
        const sentenceEnd = /[.!?]["'’)]?$/.test(word.word.trim());

        if (current.length >= minWords && (sentenceEnd || candidate.length > maxCaptionChars || current.length >= maxWords)) {
            captions.push({ start: current[0].start, end: current[current.length - 1].end, text: joinCaptionWords(current) });
            current = [word];
        } else current.push(word);
    }

    if (current.length) captions.push({ start: current[0].start, end: current[current.length - 1].end, text: joinCaptionWords(current) });
    return captions;
}

async function createCaptionImage(text: string, output: string): Promise<void> {
    const boxWidth = 1000;
    const boxHeight = 180;
    const paddingY = 30;
    const innerHeight = boxHeight - paddingY * 2;
    const fontSize = 42;
    const lineHeight = 48;
    const maxLineChars = 46;
    const words = text.trim().split(/\s+/);

    let bestSplit = -1;
    let bestScore = Infinity;

    for (let i = 1; i < words.length; i++) {
        const left = words.slice(0, i).join(" ");
        const right = words.slice(i).join(" ");
        if (left.length > maxLineChars || right.length > maxLineChars) continue;
        const score = Math.abs(left.length - right.length);
        if (score < bestScore) { bestScore = score; bestSplit = i; }
    }

    if (bestSplit < 0) {
        for (let i = 1; i < words.length; i++) {
            const left = words.slice(0, i).join(" ");
            const right = words.slice(i).join(" ");
            const score = Math.max(left.length, right.length);
            if (score < bestScore) { bestScore = score; bestSplit = i; }
        }
    }

    const lines = [words.slice(0, bestSplit).join(" "), words.slice(bestSplit).join(" ")].filter(Boolean);
    const textBlockHeight = lines.length * lineHeight;
    const firstCenterY = paddingY + (innerHeight - textBlockHeight) / 2 + lineHeight / 2;
    const tspans = lines.map((line, i) => `<tspan x="${boxWidth / 2}" y="${firstCenterY + i * lineHeight}">${escapeXml(line)}</tspan>`).join("");
    const svg = `<svg width="${boxWidth}" height="${boxHeight}" viewBox="0 0 ${boxWidth} ${boxHeight}" xmlns="http://www.w3.org/2000/svg"><rect x="0" y="0" width="${boxWidth}" height="${boxHeight}" rx="24" fill="#000000" fill-opacity="0.72"/><text x="${boxWidth / 2}" text-anchor="middle" dominant-baseline="middle" font-family="Arial,sans-serif" font-size="${fontSize}" font-weight="700" fill="white">${tspans}</text></svg>`;

    await sharp(Buffer.from(svg)).png().toFile(output);
}

function escapeXml(text: string): string {
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

async function addCaptions(video: string, avatar: string, output: string): Promise<string> {
    const captionDir = path.join(path.dirname(output), "caption-images");
    await fs.mkdir(captionDir, { recursive: true });

    const words = await transcribeGreg(avatar);
    const captions = buildCaptionLines(words);
    const command = ffmpeg(video);
    const filters: string[] = [];

    for (let i = 0; i < captions.length; i++) {
        const png = path.join(captionDir, `${i}.png`);
        await createCaptionImage(captions[i].text, png);
        command.input(png).inputOptions(["-loop", "1", "-framerate", "30"]);
        filters.push(`[${i + 1}:v]format=rgba,setpts=PTS-STARTPTS[cap${i}]`);
    }

    let current = "[0:v]";

    for (let i = 0; i < captions.length; i++) {
        const c = captions[i];
        const next = `[capout${i}]`;
        filters.push(`${current}[cap${i}]overlay=x=(W-w)/2:y=55:enable='between(t,${c.start},${c.end})':eof_action=pass${next}`);
        current = next;
    }

    filters.push(`${current}format=yuv420p[outv]`);

    await new Promise<void>((resolve, reject) => command
        .complexFilter(filters)
        .outputOptions(["-map [outv]", "-an", "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-y"])
        .on("end", resolve)
        .on("error", reject)
        .save(output));

    return output;
}

// Final audio/upload.
async function replaceAudio(video: string, audioSource: string, output: string) {
    await new Promise<void>((resolve, reject) => ffmpeg()
        .input(video)
        .input(audioSource)
        .outputOptions(["-map", "0:v:0", "-map", "1:a:0", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart"])
        .on("end", resolve)
        .on("error", reject)
        .save(output));

    return output;
}

// Temporary Sanity video asset; caller deletes it after all platforms finish publishing.
async function uploadFinalVideo(videoPath: string) {
    const file = await fs.readFile(videoPath);
    const filename = path.basename(videoPath);
    const asset = await serverClient.assets.upload("file", file, { filename, contentType: "video/mp4" });
    return { assetId: asset._id, url: asset.url };
}

// Main render pipeline.
export function renderBrollVideo(timeline: TimelineInput, gregAvatarVideo: string, dryRun: false): Promise<{ assetId: string; url: string }>;
export function renderBrollVideo(timeline: TimelineInput, gregAvatarVideo: string, dryRun: true): Promise<{ localPath: string }>;
export async function renderBrollVideo(timeline: TimelineInput, gregAvatarVideo: string, dryRun = false): Promise<{ assetId: string; url: string } | { localPath: string }> {
    const root = path.join(process.cwd(), "tmp", "weekly-video");
    const avatarDuration = await getVideoDuration(gregAvatarVideo);
    const renderTimeline = buildTimeline(timeline);
    const assets = await downloadRenderAssets(await resolveStoryAssets(renderTimeline), path.join(root, "assets"));
    for (const asset of assets) if (asset.start + asset.duration > avatarDuration + 0.01) throw new Error(`B-roll "${asset.id}" ends at ${(asset.start + asset.duration).toFixed(2)}s but Greg video ends at ${avatarDuration.toFixed(2)}s.`);
    const brollClips = await renderKenBurns(assets, path.join(root, "clips"), avatarDuration);
    const visualClips = await buildVisualTimeline(brollClips, gregAvatarVideo, avatarDuration, path.join(root, "segments"));
    const assembled = await crossfadeTimeline(visualClips, path.join(root, "assembled.mp4"), avatarDuration);
    const assembledDuration = await getVideoDuration(assembled);
    if (Math.abs(assembledDuration - avatarDuration) > 0.1) throw new Error(`Visual assembly duration mismatch: expected ${avatarDuration.toFixed(2)}s, got ${assembledDuration.toFixed(2)}s.`);
    const captioned = await addCaptions(assembled, gregAvatarVideo, path.join(root, "captioned.mp4"));
    const finalVideo = await replaceAudio(captioned, gregAvatarVideo, path.join(root, "weekly-final.mp4"));
    const finalDuration = await getVideoDuration(finalVideo);
    if (Math.abs(finalDuration - avatarDuration) > 0.1) throw new Error(`Final video duration mismatch: expected ${avatarDuration.toFixed(2)}s, got ${finalDuration.toFixed(2)}s.`);
    if (dryRun) return { localPath: finalVideo };
    return await uploadFinalVideo(finalVideo);
}