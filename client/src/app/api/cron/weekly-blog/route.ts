import { openai, extractImageBase64, serverClient, Block, toPortatbleTextBlock, blockSchema, slugify } from "@/lib/automation";
import { NextResponse } from "next/server"


type GeneratedBlog = {
    title: string;
    headline: string;
    buttonText: string;
    phoneNumber: string;
    columnLeft: Block[];
    columnRight: Block[];
  };

export async function GET(req: Request) {

    try {
    // secure the endpoint
    const auth = req.headers.get("authorization")
    const expected = `Bearer ${process.env.CRON_SECRET}`
    if (!process.env.CRON_SECRET || auth !== expected) {
        return NextResponse.json({ error: "Unauthorized"}, { status: 401 })
    }

    const blogResp = await openai.responses.create({
        model: "gpt-5",
        tools: [{ type: "web_search" }],
        // Include sources so you can audit what it used (helpful for compliance).
        instructions: 
        "Write a weekly SEO blog post for GOC Legal, a California personal injury law firm. " +
        "Generate a concise title (max 5 words), generate a headline (max 12 words). " +
        "Select ONE topic based on either (1) recent California personal injury–related news or (2) trending personal injury search questions, researched via the web_search tool. " +
        "Write original, educational content (no citations, links, or news attribution) and do not provide legal advice. " +
        "Use clear, engaging language with H3 headings for readability and SEO. " +
        "Naturally include relevant personal injury keywords and link to appropriate GOC Legal service pages when helpful: " +
        "https://www.goclegal.com/auto-accidents, https://www.goclegal.com/slip-and-fall-injuries, https://www.goclegal.com/trucking-accidents, https://www.goclegal.com/bicycle-accidents, https://www.goclegal.com/construction-site-accidents, https://www.goclegal.com/traumatic-brain-injury, https://www.goclegal.com/wrongful-death. " +
        "Summarize and educate only—do not reproduce articles or include legal citations. " +
        "Return valid JSON that exactly matches the weekly_post schema."
        ,
        text: {
            format: {
                type: "json_schema",
                name: "weekly_blog",
                schema: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                        title: { type: "string" },
                        headline: { type: "string" },
                        buttonText: { type: "string" },
                        columnLeft: blockSchema,
                        columnRight: blockSchema,
                    },
                    required: [
                        "title",
                        "headline",
                        "buttonText",
                        "columnLeft",
                        "columnRight"
                    ]
                },
            },
        },
        input: 
        "Audience: California residents researching personal injury topics. " +
        "Tone: Professional, reassuring, educational, and easy to read. " +
        "Each column must contain at least 6 blocks. " +
        "Include at most 3 headings per column; include at most one link per column; every link must be followed by 2~3 sentences explaining it. " +
        "The link field must always exist; set link=null for most blocks. " +
        "Limit to a maximum of ONE link per column. Links must be either a reputable external source or a provided GOC Legal service URL. " +
        "For paragraphs, place the text in the 'text' field. " +
        "If a link is included, link.text must be a short clickable phrase." +
        "Please remove em dashes."
    });

    const generated: GeneratedBlog = JSON.parse(blogResp.output_text)
    const slug = slugify(generated.title)
    const FIRM_PHONE_NUMBER = "510-846-0928";
    const CTA_TEXT = "Get a free case review, contact GOC Legal today.";

    const imageResp = await openai.responses.create({
        model: "gpt-5",
        tools: [{ type: "image_generation" }],
        tool_choice: { type: "image_generation" },
        input: 
        "Photorealistic, real-life hero image for a personal injury law firm blog post" +
        ` + Topic: "${generated.title}"` +
        " + Realistic everyday scene relevant to the topic (e.g., calm roadside after a minor car incident, professional office handshake, courthouse exterior, thoughtful person using a phone)" +
        " + Mood: calm, trustworthy, reassuring, professional" +
        " + Composition: wide website hero banner, natural lighting, shallow depth of field" +
        " + Style: true-to-life photography, high detail, modern, clean" +
        " + STRICTLY NO text of any kind (no signs, no license plates, no screens, no papers, no captions)" +
        " + No logos, no watermarks, no branding" +
        " + No injuries, no blood, no gore, no medical scenes" +
        " + No illustration, no cartoon, no CGI, no 3D render, no vector, no stylized art"
    })

    const imageBase64 = extractImageBase64(imageResp)
    const imageBuffer = Buffer.from(imageBase64, "base64")

    const uploadedImage = await serverClient.assets.upload("image", imageBuffer, {
        filename: `${slug}.jpeg`,
        contentType: "image/jpeg"
    })

    const doc = {
        _type: "post",
        title: generated.title,
        headline: generated.headline,
        date: new Date().toISOString(),
        slug: { _type: "slug", current: slug },
        image: { _type: "image", asset: { _type: "reference", _ref: uploadedImage._id }},
        columnLeft: generated.columnLeft.flatMap(toPortatbleTextBlock),
        columnRight: generated.columnRight.flatMap(toPortatbleTextBlock),
        buttonText: CTA_TEXT,
        phoneNumber: FIRM_PHONE_NUMBER
    }

    const weeklyBlog = await serverClient.create(doc)
    return NextResponse.json({
        ok: true,
        id: weeklyBlog._id,
        slug,
        title: generated.title
    })

    } catch(err: any) {
        return NextResponse.json(
            { ok: false, error: err.message },
            { status: 500 }
        )
    }
}