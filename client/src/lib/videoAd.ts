import groq from "groq";
import { client } from "@/sanity/client";
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { getOpenAI, storyboardFromLibraryPrompt } from "./openai";
import { serverClient } from "@/sanity/serverClient";
import { Sandbox } from "@vercel/sandbox";

const openai = getOpenAI();
const FADE = 0.35;

// Remove fluent-ffmpeg, ffmpeg-static, ffprobe-static imports and getFfmpeg() entirely.

async function runSandboxCommand(sandbox: Sandbox, cmd: string, args: string[]) {
    const result = await sandbox.runCommand({ cmd, args });
    if (result.exitCode !== 0) throw new Error(`Sandbox command failed: ${cmd} ${args.join(" ")}\n${await result.stderr()}`);
    return result;
}

async function createVideoSandbox(): Promise<Sandbox> {
    const sandbox = await Sandbox.create({ runtime: "node22", timeout: 10 * 60 * 1000, persistent: false });
    await runSandboxCommand(sandbox, "dnf", ["install", "-y", "ffmpeg"]);
    return sandbox;
}

async function writeSandboxFile(sandbox: Sandbox, sandboxPath: string, data: Buffer) {
    await sandbox.writeFiles([{ path: sandboxPath, content: data }]);
}

async function readSandboxFile(sandbox: Sandbox, sandboxPath: string): Promise<Buffer> {
    const data = await sandbox.readFileToBuffer({ path: sandboxPath });
    if (!data) throw new Error(`Sandbox output missing: ${sandboxPath}`);
    return data;
}

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
type CaptionSegment = { text?: string; start?: number; end?: number; };

// Storyboard schema.
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

// Keep all storyboard/timeline logic unchanged below this point.
function normalizeNarration(text: string): string {
    return text.replace(/^\s*\d+:\d+\s*/, "").toLowerCase().replace(/[’‘]/g, "'").replace(/[^a-z0-9\s']/g, " ").replace(/\s+/g, " ").trim();
}

function validateStoryboardCoverage(script: string, beats: Omit<StoryboardBeat, "duration">[]) {
    const sourceWords = normalizeNarration(script).split(/\s+/).filter(Boolean);
    const storyboardWords = normalizeNarration(beats.map(b => b.narration).join(" ")).split(/\s+/).filter(Boolean);
    if (sourceWords.length !== storyboardWords.length) throw new Error(`Storyboard coverage mismatch: script has ${sourceWords.length} words but storyboard has ${storyboardWords.length}.`);
    for (let i = 0; i < sourceWords.length; i++) if (sourceWords[i] !== storyboardWords[i]) throw new Error(`Storyboard narration mismatch at word ${i + 1}: expected "${sourceWords[i]}" but received "${storyboardWords[i]}".`);
}

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
        text: { format: { type: "json_schema", name: "storyboard", strict: true, schema: StoryboardSchema } },
    });
    const { beats } = JSON.parse(response.output_text) as { beats: Omit<StoryboardBeat, "duration">[] };
    if (beats.length !== 8) throw new Error(`Expected exactly 8 storyboard beats, received ${beats.length}.`);
    validateStoryboardCoverage(script, beats);
    const validAssets = new Map(assets.map(a => [a.slug, a]));
    for (const beat of beats) {
        if (beat.visualType === "asset" && beat.assetSlug && !validAssets.has(beat.assetSlug)) throw new Error(`Storyboard selected unavailable StoryAsset: ${beat.assetSlug}.`);
        if (beat.visualType === "greg" && beat.assetSlug !== null) throw new Error(`Greg beat "${beat.id}" must have assetSlug = null.`);
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

async function notifyConceptSuggestions(beats: StoryboardBeat[]) {
    const webhook = process.env.SLACK_ALERTS_URL;
    if (!webhook) return;
    const suggestions = beats.filter(b => b.visualType === "asset" && !b.assetSlug).map(b => `• * ${b.slug}*\n  ${b.narration} `).join("\n\n");
    if (!suggestions) return;
    const response = await fetch(webhook, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: `* Review concepts suggestions *\n\n${suggestions} ` }) });
    if (!response.ok) throw new Error(`Slack notification failed: ${response.status} `);
}

// Avatar timing.
export async function getVideoDuration(file: string): Promise<number> {
    const sandbox = await createVideoSandbox();
    try {
        await writeSandboxFile(sandbox, "input.mp4", await fs.readFile(file));
        const result = await runSandboxCommand(sandbox, "ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", "input.mp4"]);
        const duration = Number((await result.stdout()).trim());
        if (!Number.isFinite(duration)) throw new Error("Unable to determine video duration.");
        return duration;
    } finally {
        await sandbox.stop();
    }
}

function normalizeAlignWord(text: string): string {
    return text.toLowerCase().replace(/[’‘`]/g, "'").replace(/[^ a - z0 - 9']/g, "").replace(/^' +| '+$/g, "");
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
    for (let i = 1; i < rows; i++) for (let j = 1; j < cols; j++) {
        const match = dp[i - 1][j - 1] + wordSimilarity(target[i - 1], spoken[j - 1]);
        const skipTarget = dp[i - 1][j] - 0.45;
        const skipSpoken = dp[i][j - 1] - 0.2;
        dp[i][j] = Math.max(match, skipTarget, skipSpoken);
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
        if (bestStart < 0 || bestScore < 0.70) throw new Error(`Could not align storyboard narration to Greg audio: "${beat.narration}" (best score ${bestScore.toFixed(2)})`);
        const start = words[bestStart].start;
        const end = words[bestEnd].end;
        cursor = bestEnd + 1;
        console.log(`[TIMING] ${beat.id}: ${start.toFixed(2)}s → ${end.toFixed(2)}s (${(end - start).toFixed(2)}s, score ${bestScore.toFixed(2)})`);
        return { ...beat, start, duration: end - start };
    });
}

const reusableStoryAssetsQuery = groq`*[_type=="storyAsset" && isReusable != false]{title,"slug":slug.current,category,tags,prompt,"imageUrl":image.asset->url,orientation,isReusable}`;

export async function generateAssets(storyboard: StoryboardBeat[]): Promise<GeneratedStoryAsset[]> {
    const slugs = storyboard.map(b => b.assetSlug).filter((s): s is string => Boolean(s));
    if (!slugs.length) return storyboard.map(b => ({ ...b, reused: false, resolvedSlug: null }));
    const assets = await client.fetch<ReusableStoryAsset[]>(groq`*[_type=="storyAsset" && slug.current in $slugs]{title,"slug":slug.current,category,tags,prompt,"imageUrl":image.asset->url,orientation,isReusable}`, { slugs });
    const map = new Map(assets.map(a => [a.slug, a]));
    return storyboard.map(beat => {
        if (!beat.assetSlug || beat.visualType === "greg") return { ...beat, reused: false, resolvedSlug: null };
        const asset = map.get(beat.assetSlug);
        if (!asset) throw new Error(`Storyboard selected missing StoryAsset: ${beat.assetSlug}`);
        console.log(`[ASSET] "${beat.id}" → "${asset.slug}"`);
        return { ...beat, imageUrl: asset.imageUrl, reused: true, resolvedSlug: asset.slug };
    });
}

export async function storyboardToAlignedTimeline(storyboard: StoryboardBeat[]): Promise<TimelineInput> {
    return {
        clips: storyboard.filter(beat => beat.visualType === "asset" && beat.assetSlug && beat.start != null).map(beat => {
            const duration = Math.min(2.8, Math.max(1.6, beat.duration * 0.52));
            const start = beat.start! + (beat.duration - duration) / 2;
            return { id: beat.id, type: "asset", assetSlug: beat.assetSlug!, narration: beat.narration, start, duration };
        }),
    };
}

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

const storyAssetsBySlugs = groq`*[_type=="storyAsset" && slug.current in $slugs]{"title":title,"slug":slug.current,"imageUrl":image.asset->url,"metadata":image.asset->metadata{dimensions}}`;

async function resolveStoryAssets(timeline: Timeline): Promise<Timeline> {
    const slugs = [...new Set(timeline.clips.filter(c => c.type === "asset").map(c => c.assetSlug).filter((slug): slug is string => Boolean(slug)))];
    const docs = await client.fetch<StoryAsset[]>(storyAssetsBySlugs, { slugs });
    const map = new Map(docs.map(d => [d.slug, d]));
    return {
        clips: timeline.clips.map(c => {
            if (c.type === "avatar") return c;
            if (!c.assetSlug) throw new Error(`Asset clip "${c.id}" is missing assetSlug.`);
            const asset = map.get(c.assetSlug);
            if (!asset) throw new Error(`Missing StoryAsset: ${c.assetSlug}`);
            return { ...c, imageUrl: asset.imageUrl, imageWidth: asset.metadata.dimensions.width, imageHeight: asset.metadata.dimensions.height };
        }),
    };
}

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

async function renderKenBurns(assets: ImageRenderAsset[], outDir: string, avatarDuration: number): Promise<RenderClip[]> {
    await fs.mkdir(outDir, { recursive: true });
    const results: RenderClip[] = [];
    for (const a of assets) {
        const out = path.join(outDir, `${String(a.start).padStart(3, "0")}_${a.id}.mp4`);
        const sandbox = await createVideoSandbox();
        try {
            await writeSandboxFile(sandbox, "input.png", await fs.readFile(a.localPath));
            const hasFollowingClip = a.start + a.duration < avatarDuration - 0.01;
            const renderDuration = a.duration + (hasFollowingClip ? FADE : 0);
            await runSandboxCommand(sandbox, "ffmpeg", ["-y", "-loop", "1", "-i", "input.png", "-vf", "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,format=yuv420p", "-t", String(renderDuration), "-r", "30", "-pix_fmt", "yuv420p", "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-movflags", "+faststart", "output.mp4"]);
            await fs.writeFile(out, await readSandboxFile(sandbox, "output.mp4"));
            results.push({ id: a.id, videoPath: out, start: a.start, duration: a.duration });
        } finally {
            await sandbox.stop();
        }
    }
    return results;
}

async function renderGregSegment(avatar: string, start: number, duration: number, out: string, addFade: boolean): Promise<RenderClip> {
    const sandbox = await createVideoSandbox();
    try {
        await writeSandboxFile(sandbox, "avatar.mp4", await fs.readFile(avatar));
        const renderDuration = duration + (addFade ? FADE : 0);
        await runSandboxCommand(sandbox, "ffmpeg", ["-y", "-ss", String(start), "-i", "avatar.mp4", "-t", String(renderDuration), "-an", "-vf", "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,format=yuv420p", "-r", "30", "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p", "-movflags", "+faststart", "output.mp4"]);
        await fs.writeFile(out, await readSandboxFile(sandbox, "output.mp4"));
    } finally {
        await sandbox.stop();
    }
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

async function crossfadeTimeline(clips: RenderClip[], output: string, totalDuration: number) {
    if (!clips.length) throw new Error("No visual clips to assemble.");
    const sandbox = await createVideoSandbox();
    try {
        for (let i = 0; i < clips.length; i++) await writeSandboxFile(sandbox, `clip-${i}.mp4`, await fs.readFile(clips[i].videoPath));
        const inputs = clips.flatMap((_, i) => ["-i", `clip-${i}.mp4`]);
        const filters: string[] = [];
        clips.forEach((_, i) => filters.push(`[${i}:v]fps=30,scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,format=yuv420p,settb=1/30,setpts=PTS-STARTPTS[v${i}]`));
        let current = "v0";
        let accumulatedDuration = clips[0].duration;
        for (let i = 1; i < clips.length; i++) {
            const next = `xf${i}`;
            filters.push(`[${current}][v${i}]xfade=transition=fade:duration=${FADE}:offset=${accumulatedDuration}[${next}]`);
            current = next;
            accumulatedDuration += clips[i].duration;
        }
        filters.push(`[${current}]trim=start=0:duration=${totalDuration},setpts=PTS-STARTPTS[outv]`);
        await runSandboxCommand(sandbox, "ffmpeg", ["-y", ...inputs, "-filter_complex", filters.join(";"), "-map", "[outv]", "-an", "-t", String(totalDuration), "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p", "-movflags", "+faststart", "output.mp4"]);
        await fs.writeFile(output, await readSandboxFile(sandbox, "output.mp4"));
    } finally {
        await sandbox.stop();
    }
    return output;
}

async function transcribeGreg(avatar: string): Promise<CaptionWord[]> {
    const audioPath = path.join(path.dirname(avatar), "greg-caption-audio.m4a");
    const sandbox = await createVideoSandbox();
    try {
        await writeSandboxFile(sandbox, "avatar.mp4", await fs.readFile(avatar));
        await runSandboxCommand(sandbox, "ffmpeg", ["-y", "-i", "avatar.mp4", "-vn", "-c:a", "aac", "-b:a", "128k", "audio.m4a"]);
        const buffer = await readSandboxFile(sandbox, "audio.m4a");
        await fs.writeFile(audioPath, buffer);
    } finally {
        await sandbox.stop();
    }
    const file = new File([await fs.readFile(audioPath)], "greg-caption-audio.m4a", { type: "audio/mp4" });
    const transcription = await openai.audio.transcriptions.create({ file, model: "whisper-1", response_format: "verbose_json", timestamp_granularities: ["word", "segment"] });
    await fs.unlink(audioPath).catch(() => { });
    const words = (transcription.words ?? []).map((w: any) => ({ word: w.word.trim(), start: Number(w.start), end: Number(w.end) })).filter(w => w.word);
    return applySegmentPunctuation(words, (transcription.segments ?? []) as CaptionSegment[]);
}

// Captions.
function punctuationOf(text: string): string { return text.trim().match(/[.,!?;:]+(?:["'’)]*)$/)?.[0] ?? ""; }
function normalizeCaptionWord(text: string): string { return text.toLowerCase().replace(/[.,!?;:%'"’)\]}]+$/g, "").replace(/[^a-z0-9]/g, ""); }
function joinCaptionWords(words: CaptionWord[]): string { return words.reduce((text, w) => { const word = w.word.trim(); if (!text) return word; if (/^[.,!?;:%)\]}]/.test(word) || /^['’]/.test(word)) return `${text}${word}`; return `${text} ${word}`; }, ""); }

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

function escapeXml(text: string): string { return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }

async function addCaptions(video: string, avatar: string, output: string): Promise<string> {
    const captionDir = path.join(path.dirname(output), "caption-images");
    await fs.mkdir(captionDir, { recursive: true });
    const words = await transcribeGreg(avatar);
    const captions = buildCaptionLines(words);
    const sandbox = await createVideoSandbox();
    try {
        await writeSandboxFile(sandbox, "video.mp4", await fs.readFile(video));
        const filters: string[] = [];
        const inputs: string[] = ["-i", "video.mp4"];
        for (let i = 0; i < captions.length; i++) {
            const png = path.join(captionDir, `${i}.png`);
            await createCaptionImage(captions[i].text, png);
            await writeSandboxFile(sandbox, `caption-${i}.png`, await fs.readFile(png));
            inputs.push("-loop", "1", "-framerate", "30", "-i", `caption-${i}.png`);
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
        await runSandboxCommand(sandbox, "ffmpeg", ["-y", ...inputs, "-filter_complex", filters.join(";"), "-map", "[outv]", "-an", "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p", "-movflags", "+faststart", "output.mp4"]);
        await fs.writeFile(output, await readSandboxFile(sandbox, "output.mp4"));
    } finally {
        await sandbox.stop();
    }
    return output;
}

async function replaceAudio(video: string, audioSource: string, output: string) {
    const sandbox = await createVideoSandbox();
    try {
        await writeSandboxFile(sandbox, "video.mp4", await fs.readFile(video));
        await writeSandboxFile(sandbox, "audio.mp4", await fs.readFile(audioSource));
        await runSandboxCommand(sandbox, "ffmpeg", ["-y", "-i", "video.mp4", "-i", "audio.mp4", "-map", "0:v:0", "-map", "1:a:0", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", "output.mp4"]);
        await fs.writeFile(output, await readSandboxFile(sandbox, "output.mp4"));
    } finally {
        await sandbox.stop();
    }
    return output;
}

async function uploadFinalVideo(videoPath: string) {
    const file = await fs.readFile(videoPath);
    const filename = path.basename(videoPath);
    const asset = await serverClient.assets.upload("file", file, { filename, contentType: "video/mp4" });
    return { assetId: asset._id, url: asset.url };
}

export function renderBrollVideo(timeline: TimelineInput, gregAvatarVideo: string, dryRun: false): Promise<{ assetId: string; url: string }>;
export function renderBrollVideo(timeline: TimelineInput, gregAvatarVideo: string, dryRun: true): Promise<{ localPath: string }>;
export async function renderBrollVideo(timeline: TimelineInput, gregAvatarVideo: string, dryRun = false): Promise<{ assetId: string; url: string } | { localPath: string }> {
    const root = "/tmp/weekly-video";
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
