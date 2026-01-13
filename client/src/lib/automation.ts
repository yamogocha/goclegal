import "server-only";

import { createClient } from "next-sanity";
import OpenAI from "openai";
import { ResponseOutputItem } from 'openai/resources/responses/responses.mjs'

export const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY!,
})


export function extractImageBase64(response: { output: ResponseOutputItem[] }): string {
    const call = response.output.find(
        (output): output is Extract<ResponseOutputItem, { type: "image_generation_call" }> => 
            output.type === "image_generation_call");
    
    if (!call) throw new Error(`No image generation call found`);

    if (typeof call.result === "string") return call.result;
    if (call.result && typeof call.result === "object" && "image_base64" in call.result) return call.result.image_base64;

    throw new Error(`Image generation call has no base64 payload`)
}


export const serverClient = createClient({
    projectId: process.env.SANITY_PROJECT_ID!,
    dataset: process.env.SANITY_DATASET!,
    apiVersion: "2024-01-01",
    useCdn: false, // MUST be false for mutations
    token: process.env.SANITY_API_TOKEN!, // 👈 write token
  });

export function slugify(input: string) {
    return input
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g,"-")
}

export const blockSchema = {
    type: "array",
    minItems: 6,
    items: {
        type: "object",
        additionalProperties: false,
        properties: {
        type: { type: "string", enum: ["heading3", "paragraph"] },
        text: { type: "string" },
        link: {
            anyOf: [
                { type: "null" },
                {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    href: { type: "string" },
                    text: { type: "string" }
                  },
                  required: ["href", "text"]
                }
              ]
        }
        },
        required: ["type", "text", "link"]
    }
}

export type Block = {
    type: "heading3" | "paragraph",
    text: string,
    link: null | {
        href: string
        text: string
    }
}

export function toPortatbleTextBlock(block: Block) {
    const style = block.type === "heading3" ? "h3" : "normal"
    const hasLink = !!block.link?.href
    const markKey = crypto.randomUUID();
    const text = (hasLink ? block.link!.text : block.text).trim()

    return [{
        _type: "block", 
        _key: crypto.randomUUID(), 
        style, 
        markDefs: hasLink ? [{ _type: "link", _key: markKey, href: block.link!.href }] : [],
        children: [{ _type: "span", _key: crypto.randomUUID(), text, marks: hasLink ? [markKey] :[] }]
    }]
}