
import OpenAI from "openai";

export const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY!,
})

const blockSchema = {
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

export const weeklyPostSchema = {
    type: "object",
    additionalProperties: false,
    properties: {
        candidateTopics: {
            type: "array",
            minItems: 6,
            maxItems: 10,
            items: { type: "string" },
        },
        chosenTopic: { type: "string" },
        title: { type: "string" },
        headline: { type: "string" },
        buttonText: { type: "string" },
        columnLeft: blockSchema,
        columnRight: blockSchema,
    },
    required: [
        "candidateTopics",
        "chosenTopic",
        "title",
        "headline",
        "buttonText",
        "columnLeft",
        "columnRight"
    ]
}

export function postRespInstructions(recentTopicHints: { title: string, slug: string }[]) { 
    return "Write a weekly SEO blog post for GOC Legal, a California personal injury law firm. " +
    "Generate a concise title (max 5 words), generate a headline (max 12 words). " +
    "Select ONE topic based on either (1) recent California personal injury–related news or (2) trending personal injury search questions, researched via the web_search tool. " +
    "Write original, educational content (no citations, links, or news attribution) and do not provide legal advice. " +
    "Use clear, engaging language with H3 headings for readability and SEO. " +
    "Naturally include relevant personal injury keywords and link to appropriate GOC Legal service pages when helpful: " +
    "https://www.goclegal.com/auto-accidents, https://www.goclegal.com/slip-and-fall-injuries, https://www.goclegal.com/trucking-accidents, https://www.goclegal.com/bicycle-accidents, https://www.goclegal.com/construction-site-accidents, https://www.goclegal.com/traumatic-brain-injury, https://www.goclegal.com/wrongful-death. " +
    "Summarize and educate only—do not reproduce articles or include legal citations. " +
    "Return valid JSON that exactly matches the weekly_post schema." +
    "First propose 6–10 candidate topics. " +
    "Then choose ONE topic that does not overlap the recent posts list provided. " +
    "Return candidateTopics and chosenTopic in the JSON." +
    "Recent posts (do not repeat these topics): " +
    JSON.stringify(recentTopicHints) +
    "Topic selection rule: chosenTopic must be meaningfully different from every recent title/slug (not just reworded)."
}

export const postRespInput =
    "Audience: California residents researching personal injury topics. " +
    "Tone: Professional, reassuring, educational, and easy to read. " +
    "Each column must contain at least 6 blocks. " +
    "Include at most 3 headings per column; include at most one link per column; every link must be followed by 2~3 sentences explaining it. " +
    "The link field must always exist; set link=null for most blocks. " +
    "Limit to a maximum of ONE link per column. Links must be either a reputable external source or a provided GOC Legal service URL. " +
    "For paragraphs, place the text in the 'text' field. " +
    "If a link is included, link.text must be a short clickable phrase." +
    "Please remove em dashes."

export function imageRespInput(title: string): string {
    return "Photorealistic, real-life hero image for a personal injury law firm blog post" +
    ` Topic: ${title}` +
    " Realistic everyday scene relevant to the topic (e.g., calm roadside after a minor car incident, professional office handshake, courthouse exterior, thoughtful person using a phone)" +
    " Mood: calm, trustworthy, reassuring, professional" +
    " Composition: wide website hero banner, natural lighting, shallow depth of field" +
    " Style: true-to-life photography, high detail, modern, clean" +
    " STRICTLY NO text of any kind (no signs, no license plates, no screens, no papers, no captions)" +
    " No logos, no watermarks, no branding" +
    " No injuries, no blood, no gore, no medical scenes" +
    " No illustration, no cartoon, no CGI, no 3D render, no vector, no stylized art"
}