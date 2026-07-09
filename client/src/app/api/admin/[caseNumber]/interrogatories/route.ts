import { NextRequest, NextResponse } from "next/server";
import { groq } from "next-sanity";
import { client } from "@/sanity/client";
import { serverClient } from "@/lib/blog";
import {
  buildSpecialInterrogatoryDocx,
  createFinalResponse,
  Interrogatory,
  loadSpecialInterrogatoryPdfQuestions,
  loadFormInterrogatoryPdfQuestions,
  detectInterrogatoryType,
  buildFormInterrogatoryDocx,
} from "@/lib/pdfToDocx";
import crypto from "crypto"; export const runtime = "nodejs"; type SavedInterrogatory = {
  number: string;
  question?: string;
  questionLines?: string[];
  plaintiffAttorneyResponse?: string;
  plaintiffClientResponse?: string;
  finalResponse?: string;
};
// LOAD CASE
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ caseNumber: string }> }
) {
  try {
    const { caseNumber } = await context.params;
    const decoded = decodeURIComponent(caseNumber); const data = await client.fetch(
      groq`
        *[
          _type == "interrogatory" &&
          caseNumber == $caseNumber
        ][0]
      `,
      { caseNumber: decoded }
    ); return NextResponse.json(data || {});
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
// LOAD QUESTIONS
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ caseNumber: string }> }
) {
  try {
    const { caseNumber } = await context.params;
    const decoded = decodeURIComponent(caseNumber); const formData = await req.formData();
    const file = formData.get("file") as File | null; if (!file) {
      return NextResponse.json({ error: "No PDF uploaded" }, { status: 400 });
    } const buffer = await file.arrayBuffer(); const interrogatoryType = await detectInterrogatoryType(buffer); const result =
      interrogatoryType === "form"
        ? await loadFormInterrogatoryPdfQuestions(buffer)
        : await loadSpecialInterrogatoryPdfQuestions(buffer); const existing = await client.fetch(
          groq`
        *[
          _type == "interrogatory" &&
          caseNumber == $caseNumber
        ][0]
      `,
          { caseNumber: decoded }
        ); const existingResponses = new Map<string, SavedInterrogatory>(
          (existing?.interrogatories || []).map((q: SavedInterrogatory) => [q.number, q])
        ); const interrogatories = result.interrogatories.map((q: Interrogatory) => {
          const existingQuestion = existingResponses.get(q.number); return {
            _key: (existingQuestion as any)?._key || crypto.randomUUID(),
            number: q.number,
            question: q.question,
            questionLines: q.questionLines || [],
            plaintiffAttorneyResponse: existingQuestion?.plaintiffAttorneyResponse || "",
            plaintiffClientResponse: existingQuestion?.plaintiffClientResponse || "",
            finalResponse: existingQuestion?.finalResponse || "",
          };
        }); const payload = {
          caseNumber: result.metadata.caseNumber,
          metadata: result.metadata,
          interrogatoryType: interrogatoryType === "form" ? "form" : "special",
          interrogatories,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }; if (existing?._id) {
          await serverClient.patch(existing._id).set(payload).commit();
        } else {
      await serverClient.create({
        _type: "interrogatory",
        ...payload,
        createdAt: new Date().toISOString(),
      });
    } return NextResponse.json({ interrogatories });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json(
      { error: e.message || "Server error" },
      { status: 500 }
    );
  }
}
// AUTOSAVE
export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ caseNumber: string }> }
) {
  try {
    const { caseNumber } = await context.params;
    const decoded = decodeURIComponent(caseNumber); const body = await req.json(); const existing = await client.fetch(
      groq`
        *[
          _type == "interrogatory" &&
          caseNumber == $caseNumber
        ][0]
      `,
      { caseNumber: decoded }
    ); if (!existing?._id) {
      return NextResponse.json({ error: "Case not found" }, { status: 404 });
    } await serverClient
      .patch(existing._id)
      .set({
        interrogatories: body.interrogatories.map((q: any) => ({
          _key: q._key || crypto.randomUUID(),
          ...q,
        })),
        updatedAt: new Date().toISOString(),
      })
      .commit(); return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ caseNumber: string }> }
) {
  try {
    const body = await req.json().catch(() => null); if (body?.action === "generateFinalResponse") {
      const finalResponse = await createFinalResponse({
        question: body.question,
        attorneyResponse: body.attorneyResponse,
        clientResponse: body.clientResponse,
      }); return NextResponse.json({ finalResponse });
    } const { caseNumber } = await context.params;
    const decoded = decodeURIComponent(caseNumber); const existing = await client.fetch(
      groq`
        *[
          _type == "interrogatory" &&
          caseNumber == $caseNumber
        ][0]
      `,
      { caseNumber: decoded }
    ); if (!existing?.interrogatories?.length) {
      return NextResponse.json(
        { error: "No saved DOCX found. Please load questions first." },
        { status: 404 }
      );
    } const buffer =
      existing.interrogatoryType === "form"
        ? await buildFormInterrogatoryDocx(
          existing.interrogatories,
          existing.metadata
        )
        : await buildSpecialInterrogatoryDocx(
          existing.interrogatories,
          existing.metadata
        ); console.log("buffer.length", buffer.length); return new NextResponse(new Uint8Array(buffer), {
          headers: {
            "Content-Type":
              "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "Content-Disposition": `attachment; filename="${decoded}.docx"`,
          },
        });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}