import { NextRequest, NextResponse } from "next/server";
import { groq } from "next-sanity";
import { client } from "@/sanity/client";
import { buildSpecialInterrogatoryDocx, createFinalResponse, Interrogatory, loadSpecialInterrogatoryPdfQuestions, loadFormInterrogatoryPdfQuestions, detectInterrogatoryType, buildFormInterrogatoryDocx } from "@/lib/pdfToDocx";
import crypto from "crypto";
import { serverClient } from "@/sanity/serverClient";

export const runtime = "nodejs";

type SavedInterrogatory = {
  _key?: string;
  number: string;
  question?: string;
  questionLines?: string[];
  plaintiffAttorneyResponse?: string;
  plaintiffClientResponse?: string;
  finalResponse?: string;
};

// Resolve clientId to the client's most recent interrogatory.
async function getLatestInterrogatory(clientId: string) {
  return client.fetch(
    groq`*[_type == "clientType" && (_id == $clientId || clientId == $clientId)][0]{
      _id,
      clientId,
      clientName,
      clientAccessToken,
      "interrogatory": *[_type == "interrogatory" && references(^._id)] | order(_createdAt desc)[0]{
        _id,
        clientAccessToken,
        caseNumber,
        metadata,
        interrogatoryType,
        interrogatories,
        status,
        createdAt,
        updatedAt
      }
    }`,
    { clientId }
  );
}

// LOAD LATEST INTERROGATORY FOR CLIENT.
export async function GET(req: NextRequest, context: { params: Promise<{ clientId: string }> }) {
  try {
    const { clientId } = await context.params;
    const decodedClientId = decodeURIComponent(clientId);
    const record = await getLatestInterrogatory(decodedClientId);

    if (!record) return NextResponse.json({ error: "Client not found" }, { status: 404 });
    if (!record.interrogatory) return NextResponse.json({ error: "No interrogatories found for this client" }, { status: 404 });

    return NextResponse.json(record.interrogatory);
  } catch (e: any) {
    console.error("LOAD INTERROGATORY ERROR", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// LOAD/REPLACE QUESTIONS FOR CLIENT'S LATEST INTERROGATORY.
export async function POST(req: NextRequest, context: { params: Promise<{ clientId: string }> }) {
  try {
    const { clientId } = await context.params;
    const decodedClientId = decodeURIComponent(clientId);
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) return NextResponse.json({ error: "No PDF uploaded" }, { status: 400 });

    const buffer = await file.arrayBuffer();
    const interrogatoryType = await detectInterrogatoryType(buffer);
    const result = interrogatoryType === "form" ? await loadFormInterrogatoryPdfQuestions(buffer) : await loadSpecialInterrogatoryPdfQuestions(buffer);
    const record = await getLatestInterrogatory(decodedClientId);
    const existing = record?.interrogatory;

    const existingResponses = new Map<string, SavedInterrogatory>(
      (existing?.interrogatories || []).map((q: SavedInterrogatory) => [q.number, q])
    );

    const interrogatories = result.interrogatories.map((q: Interrogatory) => {
      const existingQuestion = existingResponses.get(q.number);
      return {
        _key: existingQuestion?._key || crypto.randomUUID(),
        number: q.number,
        question: q.question,
        questionLines: q.questionLines || [],
        plaintiffAttorneyResponse: existingQuestion?.plaintiffAttorneyResponse || "",
        plaintiffClientResponse: existingQuestion?.plaintiffClientResponse || "",
        finalResponse: existingQuestion?.finalResponse || "",
      };
    });

    const payload = {
      caseNumber: result.metadata.caseNumber,
      metadata: result.metadata,
      interrogatoryType: interrogatoryType === "form" ? "form" : "special",
      interrogatories,
      updatedAt: new Date().toISOString(),
    };

    if (existing?._id) {
      await serverClient.patch(existing._id).set(payload).commit();
    } else {
      if (!record?._id) return NextResponse.json({ error: "Client not found" }, { status: 404 });
      await serverClient.create({
        _type: "interrogatory",
        client: { _type: "reference", _ref: record._id },
        clientAccessToken: record.clientAccessToken,
        ...payload,
        createdAt: new Date().toISOString(),
      });
    }

    return NextResponse.json({ interrogatories });
  } catch (e: any) {
    console.error("LOAD QUESTIONS ERROR", e);
    return NextResponse.json({ error: e.message || "Server error" }, { status: 500 });
  }
}

// AUTOSAVE LATEST CLIENT INTERROGATORY.
export async function PUT(req: NextRequest, context: { params: Promise<{ clientId: string }> }) {
  try {
    const { clientId } = await context.params;
    const decodedClientId = decodeURIComponent(clientId);
    const body = await req.json();
    const record = await getLatestInterrogatory(decodedClientId);
    const existing = record?.interrogatory;

    if (!existing?._id) return NextResponse.json({ error: "Interrogatories not found" }, { status: 404 });
    if (!Array.isArray(body.interrogatories)) return NextResponse.json({ error: "Invalid interrogatories" }, { status: 400 });

    await serverClient.patch(existing._id).set({
      interrogatories: body.interrogatories.map((q: any) => ({
        _key: q._key || crypto.randomUUID(),
        ...q,
      })),
      updatedAt: new Date().toISOString(),
    }).commit();

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("AUTOSAVE INTERROGATORY ERROR", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// GENERATE FINAL RESPONSES OR DOCX.
export async function PATCH(req: NextRequest, context: { params: Promise<{ clientId: string }> }) {
  try {
    const body = await req.json().catch(() => null);

    if (body?.action === "generateFinalResponse") {
      const finalResponse = await createFinalResponse({
        question: body.question,
        attorneyResponse: body.attorneyResponse,
        clientResponse: body.clientResponse,
      });
      return NextResponse.json({ finalResponse });
    }

    const { clientId } = await context.params;
    const decodedClientId = decodeURIComponent(clientId);
    const record = await getLatestInterrogatory(decodedClientId);
    const existing = record?.interrogatory;

    if (!existing?.interrogatories?.length) {
      return NextResponse.json({ error: "No saved interrogatories found. Please load questions first." }, { status: 404 });
    }

    const buffer = existing.interrogatoryType === "form"
      ? await buildFormInterrogatoryDocx(existing.interrogatories, existing.metadata)
      : await buildSpecialInterrogatoryDocx(existing.interrogatories, existing.metadata);

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${existing.caseNumber}.docx"`,
      },
    });
  } catch (e: any) {
    console.error("GENERATE INTERROGATORY ERROR", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}