import { NextRequest, NextResponse } from "next/server";
import { client } from "@/sanity/client";
import { serverClient } from "@/sanity/serverClient";
import {
  buildSpecialInterrogatoryDocx,
  Interrogatory,
  loadSpecialInterrogatoryPdfQuestions,
  loadFormInterrogatoryPdfQuestions,
  detectInterrogatoryType,
  buildFormInterrogatoryDocx,
  CaseMetadata,
} from "@/lib/pdfToDocx";
import crypto from "crypto";

export const runtime = "nodejs";

type SavedInterrogatory = {
  _key?: string;
  number: string;
  question?: string;
  questionLines?: string[];
  plaintiffAttorneyResponse?: string;
  plaintiffClientResponse?: string;
};

type ClientRecord = {
  _id: string;
  clientId?: string;
  clientName?: string;
  caseNumber?: string;
  clientAccessToken?: string;
  clientPronoun?: "his" | "her";
  defendantName?: string;
  defendantAttorney?: string;
  defendantAttorneyAddress?: string;
  defendantAttorneyEmail?: string;
};

type InterrogatoryMetadata = {
  serviceDate?: string;
  caseNumber?: string;
  clientPronoun?: "his" | "her";
  setNumber?: string;
  title?: string;
  plaintiffName?: string;
  defendantName?: string;
  defendantAttorney?: string;
  defendantAttorneyAddress?: string;
  defendantAttorneyEmail?: string;
};

type InterrogatoryRecord = {
  _id: string;
  caseNumber?: string;
  metadata?: InterrogatoryMetadata;
  interrogatoryType?: "form" | "special";
  interrogatories?: SavedInterrogatory[];
  status?: string;
  createdAt?: string;
  updatedAt?: string;
};

type ClientWithInterrogatory = ClientRecord & {
  interrogatory?: InterrogatoryRecord;
};

function getServiceDate(): string {
  return new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

// Find the current client. clientType is the source of truth for client data.
async function findClientByIdentifier(
  identifier: string,
): Promise<ClientRecord | null> {
  const decodedIdentifier = decodeURIComponent(identifier).trim();

  if (!decodedIdentifier) return null;

  return client.fetch<ClientRecord | null>(
    `*[
      _type == "clientType" &&
      (
        clientId == $identifier ||
        lower(clientName) == lower($identifier)
      )
    ][0]{
      _id,
      clientId,
      clientName,
      caseNumber,
      clientAccessToken,
      clientPronoun,
      defendantName,
      defendantAttorney,
      defendantAttorneyAddress,
      defendantAttorneyEmail
    }`,
    { identifier: decodedIdentifier },
  );
}

// Load the latest interrogatory linked to the current client.
async function getLatestInterrogatory(
  identifier: string,
): Promise<ClientWithInterrogatory | null> {
  const decodedIdentifier = decodeURIComponent(identifier).trim();

  if (!decodedIdentifier) return null;

  return client.fetch<ClientWithInterrogatory | null>(
    `*[
      _type == "clientType" &&
      (
        clientId == $identifier ||
        lower(clientName) == lower($identifier)
      )
    ][0]{
      _id,
      clientId,
      clientName,
      caseNumber,
      clientAccessToken,
      clientPronoun,
      defendantName,
      defendantAttorney,
      defendantAttorneyAddress,
      defendantAttorneyEmail,
      "interrogatory": *[
        _type == "interrogatory" &&
        references(^._id)
      ] | order(_createdAt desc)[0]{
        _id,
        interrogatoryType,
        interrogatories,
        status,
        createdAt,
        updatedAt,
        "metadata": {
          "serviceDate": $serviceDate,
          "setNumber": metadata.setNumber,
          "title": metadata.title
        }
      }
    }`,
    {
      identifier: decodedIdentifier,
      serviceDate: getServiceDate(),
    },
  );
}

// Always build document metadata from the current clientType profile.
function buildCaseMetadata(
  clientRecord: ClientRecord,
  interrogatoryMetadata?: InterrogatoryMetadata,
): CaseMetadata {
  return {
    serviceDate: getServiceDate(),
    caseNumber: clientRecord.caseNumber || "",
    clientPronoun: clientRecord.clientPronoun || "his",
    setNumber: interrogatoryMetadata?.setNumber || "",
    title: interrogatoryMetadata?.title || "",
    plaintiffName: clientRecord.clientName || "",
    defendantName: clientRecord.defendantName || "",
    defendantAttorney: clientRecord.defendantAttorney || "",
    defendantAttorneyAddress: clientRecord.defendantAttorneyAddress || "",
    defendantAttorneyEmail: clientRecord.defendantAttorneyEmail || "",
  };
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Server error";
}

// LOAD LATEST INTERROGATORY FOR CLIENT.
export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ clientId: string }> },
) {
  try {
    const { clientId } = await context.params;
    const decodedClientId = decodeURIComponent(clientId);

    const record = await getLatestInterrogatory(decodedClientId);

    if (!record) {
      return NextResponse.json(
        { error: "Client not found" },
        { status: 404 },
      );
    }

    if (!record.interrogatory) {
      return NextResponse.json(
        { error: "No interrogatories found for this client" },
        { status: 404 },
      );
    }

    // Always expose current clientType data to the UI.
    const metadata = buildCaseMetadata(
      record,
      record.interrogatory.metadata,
    );

    return NextResponse.json({
      ...record.interrogatory,
      caseNumber: metadata.caseNumber,
      metadata,
    });
  } catch (error: unknown) {
    console.error("LOAD INTERROGATORY ERROR", error);

    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 500 },
    );
  }
}

// LOAD/REPLACE QUESTIONS FOR CLIENT'S LATEST INTERROGATORY.
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ clientId: string }> },
) {
  try {
    const { clientId } = await context.params;
    const decodedClientId = decodeURIComponent(clientId);

    const formData = await req.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "No PDF uploaded" },
        { status: 400 },
      );
    }

    const buffer = await file.arrayBuffer();

    // The uploaded PDF is only the master question source.
    const interrogatoryType = await detectInterrogatoryType(buffer);

    const result =
      interrogatoryType === "form"
        ? await loadFormInterrogatoryPdfQuestions(buffer)
        : await loadSpecialInterrogatoryPdfQuestions(buffer);

    // Resolve the current client.
    const clientRecord = await findClientByIdentifier(decodedClientId);

    if (!clientRecord) {
      return NextResponse.json(
        { error: "Client not found" },
        { status: 404 },
      );
    }

    // Load existing responses so reloading the master template does not erase attorney/client responses.
    const existingRecord = await getLatestInterrogatory(
      clientRecord.clientId || clientRecord.clientName || decodedClientId,
    );

    const existing = existingRecord?.interrogatory;

    const existingResponses = new Map<string, SavedInterrogatory>(
      (existing?.interrogatories || []).map(
        (question: SavedInterrogatory) => [question.number, question],
      ),
    );

    // Use only questions extracted from the master template.
    const interrogatories: SavedInterrogatory[] =
      result.interrogatories.map((question: Interrogatory) => {
        const existingQuestion = existingResponses.get(question.number);

        return {
          _key: existingQuestion?._key || crypto.randomUUID(),
          number: question.number,
          question: question.question,
          questionLines: question.questionLines || [],
          plaintiffAttorneyResponse:
            existingQuestion?.plaintiffAttorneyResponse || "",
          plaintiffClientResponse:
            existingQuestion?.plaintiffClientResponse || "",
        };
      });

    // ClientType is the authoritative source for all client/case information.
    const metadata: CaseMetadata = buildCaseMetadata(
      clientRecord,
      result.metadata,
    );

    const payload = {
      caseNumber: metadata.caseNumber,
      metadata,
      interrogatoryType:
        interrogatoryType === "form" ? "form" : "special",
      interrogatories,
      updatedAt: new Date().toISOString(),
    };

    if (existing?._id) {
      // Replace the existing interrogatory for this client.
      await serverClient
        .patch(existing._id)
        .set({
          client: {
            _type: "reference",
            _ref: clientRecord._id,
          },
          ...payload,
        })
        .commit();
    } else {
      // Create the interrogatory only when this client has none.
      await serverClient.create({
        _type: "interrogatory",
        client: {
          _type: "reference",
          _ref: clientRecord._id,
        },
        ...payload,
        status: "draft",
        createdAt: new Date().toISOString(),
      });
    }

    return NextResponse.json({
      interrogatories,
      caseNumber: metadata.caseNumber,
      metadata,
      interrogatoryType: payload.interrogatoryType,
      client: {
        _id: clientRecord._id,
        clientId: clientRecord.clientId,
        clientName: clientRecord.clientName,
        caseNumber: clientRecord.caseNumber,
        clientAccessToken: clientRecord.clientAccessToken,
        clientPronoun: clientRecord.clientPronoun,
        defendantName: clientRecord.defendantName,
        defendantAttorney: clientRecord.defendantAttorney,
        defendantAttorneyAddress:
          clientRecord.defendantAttorneyAddress,
        defendantAttorneyEmail:
          clientRecord.defendantAttorneyEmail,
      },
    });
  } catch (error: unknown) {
    console.error("LOAD QUESTIONS ERROR", error);

    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 500 },
    );
  }
}

// AUTOSAVE LATEST CLIENT INTERROGATORY.
export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ clientId: string }> },
) {
  try {
    const { clientId } = await context.params;
    const decodedClientId = decodeURIComponent(clientId);

    const body: unknown = await req.json();

    if (
      typeof body !== "object" ||
      body === null ||
      !Array.isArray(
        (body as { interrogatories?: unknown }).interrogatories,
      )
    ) {
      return NextResponse.json(
        { error: "Invalid interrogatories" },
        { status: 400 },
      );
    }

    const interrogatories = (
      body as {
        interrogatories: Array<
          SavedInterrogatory & Record<string, unknown>
        >;
      }
    ).interrogatories;

    // Resolve the current client.
    const clientRecord = await findClientByIdentifier(decodedClientId);

    if (!clientRecord) {
      return NextResponse.json(
        { error: "Client not found" },
        { status: 404 },
      );
    }

    const existingRecord = await getLatestInterrogatory(
      clientRecord.clientId || clientRecord.clientName || decodedClientId,
    );

    const existing = existingRecord?.interrogatory;

    if (!existing?._id) {
      return NextResponse.json(
        { error: "Interrogatories not found" },
        { status: 404 },
      );
    }

    await serverClient
      .patch(existing._id)
      .set({
        client: {
          _type: "reference",
          _ref: clientRecord._id,
        },
        interrogatories: interrogatories.map((question) => ({
          _key: question._key || crypto.randomUUID(),
          number: question.number,
          question: question.question,
          questionLines: question.questionLines || [],
          plaintiffAttorneyResponse:
            question.plaintiffAttorneyResponse || "",
          plaintiffClientResponse:
            question.plaintiffClientResponse || "",
        })),
        updatedAt: new Date().toISOString(),
      })
      .commit();

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    console.error("AUTOSAVE INTERROGATORY ERROR", error);

    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 500 },
    );
  }
}

// GENERATE DOCX USING CURRENT CLIENT PROFILE DATA.
export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ clientId: string }> },
) {
  try {
    await req.json().catch(() => null);

    const { clientId } = await context.params;
    const decodedClientId = decodeURIComponent(clientId);

    // Resolve the current client directly from clientType.
    const clientRecord = await findClientByIdentifier(decodedClientId);

    if (!clientRecord) {
      return NextResponse.json(
        { error: "Client not found" },
        { status: 404 },
      );
    }

    const record = await getLatestInterrogatory(decodedClientId);
    const existing = record?.interrogatory;

    if (!existing?.interrogatories?.length) {
      return NextResponse.json(
        {
          error:
            "No saved interrogatories found. Please load questions first.",
        },
        { status: 404 },
      );
    }

    // Rebuild metadata from the current clientType profile at download time.
    const metadata = buildCaseMetadata(
      clientRecord,
      existing.metadata,
    );

    const buffer =
      existing.interrogatoryType === "form"
        ? await buildFormInterrogatoryDocx(
          existing.interrogatories,
          metadata,
        )
        : await buildSpecialInterrogatoryDocx(
          existing.interrogatories,
          metadata,
        );

    const filenameBase =
      clientRecord.caseNumber ||
      clientRecord.clientName ||
      "interrogatories";

    const filename = `${filenameBase
      .replace(/[\\/:*?"<>|]/g, "_")
      .trim()}.docx`;

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error: unknown) {
    console.error("GENERATE INTERROGATORY ERROR", error);

    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 500 },
    );
  }
}