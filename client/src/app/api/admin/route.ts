import { NextRequest, NextResponse } from "next/server";
import { groq } from "next-sanity";
import { client } from "@/sanity/client";
import { serverClient } from "@/lib/blog";
import { detectInterrogatoryType, loadFormInterrogatoryPdfQuestions, loadSpecialInterrogatoryPdfQuestions } from "@/lib/pdfToDocx";
import crypto from "crypto";

// Search
export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get("q") || "";

  if (!query.trim()) return NextResponse.json([]);

  const cases = await client.fetch(
    groq`
      *[
        _type == "interrogatory" &&
        metadata.plaintiffName match $search
      ]{
        caseNumber,
        metadata,
        clientAccessToken
      }
    `,
    { search: `${query}*` }
  );

  const results = cases.map((c: any) => ({
    plaintiffName: c.metadata?.plaintiffName,
    caseNumber: c.caseNumber,
    links: [
      { label: "Admin Interrogatories", href: `/admin/${encodeURIComponent(c.caseNumber)}` },
      { label: "Client Interrogatories", href: `/client/${encodeURIComponent(c.caseNumber)}?token=${c.clientAccessToken}` },
    ],
  }));

  return NextResponse.json(results);
}

// New case
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No PDF uploaded" }, { status: 400 });
    }

    const buffer = await file.arrayBuffer();

    const interrogatoryType = await detectInterrogatoryType(buffer);

    const result =
      interrogatoryType === "form"
        ? await loadFormInterrogatoryPdfQuestions(buffer)
        : await loadSpecialInterrogatoryPdfQuestions(buffer);

    const existing = await client.fetch(
      groq`
      *[
        _type == "interrogatory" &&
        caseNumber == $caseNumber
      ][0]
    `,
      { caseNumber: result.metadata.caseNumber }
    );

    if (existing) {
      return NextResponse.json({ error: "Case already exists" }, { status: 409 });
    }

    const clientAccessToken = crypto.randomBytes(32).toString("hex");
    const payload = {
      clientAccessToken,
      caseNumber: result.metadata.caseNumber,
      metadata: result.metadata,
      interrogatoryType: interrogatoryType === "form" ? "form" : "special",
      interrogatories: result.interrogatories.map((q) => ({
        number: q.number,
        question: q.question,
        questionLines: q.questionLines || [],
        plaintiffAttorneyResponse: "",
        plaintiffClientResponse: "",
        finalResponse: "",
      })),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await serverClient.create({
      _type: "interrogatory",
      ...payload,
    });

    return NextResponse.json({
      caseNumber: payload.caseNumber,
      redirectTo: `/admin/${payload.caseNumber}`,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}