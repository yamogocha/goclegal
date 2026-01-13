import { extractImageBase64, serverClient, Block, toPortatbleTextBlock, slugify, getRecentPosts } from "@/lib/automation";
import { imageRespInput, openai, postRespInput, postRespInstructions, weeklyPostSchema } from "@/lib/openai";
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

    const recentTopics = await getRecentPosts(12)
    const recentTopicHints = recentTopics.map(({ title, slug }) => ( { title, slug } ))
    const blogResp = await openai.responses.create({
        model: "gpt-5",
        tools: [{ type: "web_search" }],
        // Include sources so you can audit what it used (helpful for compliance).
        instructions: postRespInstructions(recentTopicHints),
        text: {
            format: {
                type: "json_schema",
                name: "weekly_blog",
                schema: weeklyPostSchema,
            },
        },
        input: postRespInput,
    });

    const generated: GeneratedBlog = JSON.parse(blogResp.output_text)
    const slug = slugify(generated.title)
    const FIRM_PHONE_NUMBER = "510-846-0928";
    const CTA_TEXT = "Get a free case review, contact GOC Legal today.";

    const imageResp = await openai.responses.create({
        model: "gpt-5",
        tools: [{ type: "image_generation" }],
        tool_choice: { type: "image_generation" },
        input: imageRespInput(generated.title)
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