// src/lib/openai.ts
import OpenAI from "openai";

let client: OpenAI | null = null;

export function getOpenAI() {
  if (client) return client;

  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY");
  }

  client = new OpenAI({ apiKey });

  return client;
}

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

// Brand + competitive research document injected into the search mix
export const GOC_LEGAL_BRAND_CONTEXT = `
FIRM OVERVIEW — GOC Legal, P.C. (Oakland, CA · goclegal.com · (510) 846-0928)
Attorney: Greg O'Connell — former Alameda County prosecutor turned personal injury attorney, 20+ years experience. His DA background is the firm's single most unique differentiator in the Oakland market.
Structure: Boutique single-attorney firm. Every client works directly with Greg.
Practice areas: Auto accidents, bicycle accidents, trucking, construction, slip & fall, wrongful death.
Awards: Super Lawyers, National Trial Lawyers Top 100, Multi-Million Dollar Advocates Forum.

TOP CASE RESULTS:
- $3,000,000 — premises liability, hazardous staircase
- $500,000 — pedestrian, driver failed to yield (full policy limits)
- $265,000 — hit-and-run bicycle (Greg partnered with police to track driver)
- $230,000 — slip & fall, 100-year-old client, insurer tried to blame her age
- $128,000 — parking lot fall, inadequate lighting, elbow surgery
- Multiple $100,000 policy-limit wins: rear-end, freeway, spine aggravation, hand injury, hotel premises
- $7,500 offered → $100,000 recovered (two separate cases — strongest ad data point)

KEY CLIENT PAIN POINTS TO INFORM TOPIC SELECTION:
- Lowball insurance offers (the $7,500→$100K gap is the #1 hook)
- Medical bill spiral while liability is unresolved
- California's 2-year statute of limitations (unknown to most victims)
- Partial fault fear (CA comparative negligence — partial fault doesn't disqualify a claim)
- Recorded statements to adjusters (victims don't know they can refuse)
- Slip & fall self-blame and shame
- Preexisting condition fear (victims assume prior injury voids claim — GOC has wins on this)
- Evidence decay in slip & fall (surveillance deleted in 30–72 hrs)
- Wrongful death: grief meets paperwork; justice vs. money framing

COMPETITOR DIFFERENTIATORS TO INFORM CONTENT ANGLES:
- GJEL, Barnes Firm: volume firms, paralegal-heavy, no named founding attorney handling cases personally
- Heinrich Law: former insurance defense attorney (insurer side), GOC = DA side (builds prosecutorial case)
- GOC's unique triple: (1) single attorney handles every case personally, (2) Alameda County DA background, (3) documented case-by-case results with real dollar amounts

TONE FOR ALL CONTENT: Professional, reassuring, educational. No legal advice. Summarize and educate only.
`;

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
    // stronger topic diversity rules
    "First propose 6–10 candidate topics, spanning DIFFERENT practice areas and subject categories. " +
    "Then choose ONE topic following these strict rules:\n" +
    "  1. The chosen topic must NOT overlap with any recent post title or slug — not even as a reworded or narrower version of the same subject.\n" +
    "  2. The chosen topic must be in a DIFFERENT CATEGORY from the last 3 recent posts. " +
    "     Categories include: e-bike/bicycle, auto accidents, trucking, slip & fall, construction, wrongful death, brain injury, insurance tactics, legal process, and seasonal safety. " +
    "     If the last 3 posts all fall in the same category (e.g. e-bike/bicycle), do NOT pick anything in that category this week — choose a completely different practice area or subject.\n" +
    "  3. Rotate across the full range of GOC Legal's practice areas over time.\n" +
    // inject brand context as a research input
    "Use the following GOC Legal firm research to inform topic selection and content angles — prioritize topics that connect to the firm's documented client pain points, case results, and competitive differentiators:\n" +
    GOC_LEGAL_BRAND_CONTEXT + "\n" +
    "Return candidateTopics and chosenTopic in the JSON.\n" +
    "Recent posts (do not repeat these topics or their categories): " +
    JSON.stringify(recentTopicHints) +
    "\nTopic selection rule: chosenTopic must be meaningfully different from every recent title/slug AND must be in a different category from the last 3 recent posts."
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