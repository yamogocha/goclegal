import { NextRequest, NextResponse } from "next/server";
import { client } from "@/sanity/client";
import { serverClient } from "@/sanity/serverClient";
import {
  buildSpecialInterrogatoryDocx,
  createFinalResponse,
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
  finalResponse?: string;
};

type ClientRecord = {
  _id: string;
  clientId?: string;
  clientName?: string;
  clientAccessToken?: string;
  defendantName?: string;
  defendantAttorney?: string;
  defendantAttorneyAddress?: string;
  defendantAttorneyEmail?: string;
};

type InterrogatoryMetadata = {
  serviceDate?: string;
  caseNumber?: string;
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

type RequestBody = {
  action?: string;
  question?: string;
  attorneyResponse?: string;
  clientResponse?: string;
  interrogatories?: Array<SavedInterrogatory & Record<string, unknown>>;
};

function getServiceDate(): string {
  return new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

// Find the existing client by clientId or exact client name.
async function findClientByIdentifier(
  identifier: string,
): Promise<ClientRecord | null> {
  const decodedIdentifier = decodeURIComponent(identifier).trim();

  if (!decodedIdentifier) {
    return null;
  }

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
      clientAccessToken,
      defendantName,
      defendantAttorney,
      defendantAttorneyAddress,
      defendantAttorneyEmail
    }`,
    { identifier: decodedIdentifier },
  );
}

// Get the latest interrogatory through the client's reference.
async function getLatestInterrogatory(
  identifier: string,
): Promise<ClientWithInterrogatory | null> {
  const decodedIdentifier = decodeURIComponent(identifier).trim();
  const currentServiceDate = getServiceDate();

  if (!decodedIdentifier) {
    return null;
  }

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
      clientAccessToken,
      defendantName,
      defendantAttorney,
      defendantAttorneyAddress,
      defendantAttorneyEmail,
      "interrogatory": *[
        _type == "interrogatory" &&
        references(^._id)
      ] | order(_createdAt desc)[0]{
        _id,
        caseNumber,
        "clientAccessToken": client->clientAccessToken,
        "metadata": {
          "serviceDate": $serviceDate,
          "caseNumber": caseNumber,
          "setNumber": metadata.setNumber,
          "title": metadata.title,
          "plaintiffName": coalesce(metadata.plaintiffName, client->clientName),
          "defendantName": coalesce(metadata.defendantName, client->defendantName),
          "defendantAttorney": client->defendantAttorney,
          "defendantAttorneyAddress": client->defendantAttorneyAddress,
          "defendantAttorneyEmail": client->defendantAttorneyEmail
        },
        interrogatoryType,
        interrogatories,
        status,
        createdAt,
        updatedAt
      }
    }`,
    {
      identifier: decodedIdentifier,
      serviceDate: currentServiceDate,
    },
  );
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Server error";
}

function buildCaseMetadata(
  metadata?: InterrogatoryMetadata,
): CaseMetadata {
  return {
    serviceDate: metadata?.serviceDate || "",
    caseNumber: metadata?.caseNumber || "",
    setNumber: metadata?.setNumber || "",
    title: metadata?.title || "",
    plaintiffName: metadata?.plaintiffName || "",
    defendantName: metadata?.defendantName || "",
    defendantAttorney: metadata?.defendantAttorney || "",
    defendantAttorneyAddress: metadata?.defendantAttorneyAddress || "",
    defendantAttorneyEmail: metadata?.defendantAttorneyEmail || "",
  };
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

    return NextResponse.json(record.interrogatory);
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

    const interrogatoryType = await detectInterrogatoryType(buffer);

    const result =
      interrogatoryType === "form"
        ? await loadFormInterrogatoryPdfQuestions(buffer)
        : await loadSpecialInterrogatoryPdfQuestions(buffer);

    // Resolve the existing client.
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

    const existingResponses = new Map<string, SavedInterrogatory>(
      (existing?.interrogatories || []).map(
        (question: SavedInterrogatory) => [question.number, question],
      ),
    );

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
          finalResponse: existingQuestion?.finalResponse || "",
        };
      });

    // Client information is the source of truth.
    const metadata: CaseMetadata = {
      serviceDate: getServiceDate(),
      caseNumber: result.metadata.caseNumber || "",
      setNumber: result.metadata.setNumber || "",
      title: result.metadata.title || "",
      plaintiffName: clientRecord.clientName || "",
      defendantName: clientRecord.defendantName || "",
      defendantAttorney: clientRecord.defendantAttorney || "",
      defendantAttorneyAddress:
        clientRecord.defendantAttorneyAddress || "",
      defendantAttorneyEmail:
        clientRecord.defendantAttorneyEmail || "",
    };

    const payload = {
      caseNumber: metadata.caseNumber,
      metadata,
      interrogatoryType:
        interrogatoryType === "form" ? "form" : "special",
      interrogatories,
      updatedAt: new Date().toISOString(),
    };

    if (existing?._id) {
      // Existing interrogatory: make sure it references the correct client.
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
      // New interrogatory: automatically reference the existing client.
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
      client: {
        _id: clientRecord._id,
        clientName: clientRecord.clientName,
        clientAccessToken: clientRecord.clientAccessToken,
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

    // Resolve the client first so the interrogatory always stays linked.
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
        // Keep the client reference authoritative.
        client: {
          _type: "reference",
          _ref: clientRecord._id,
        },
        interrogatories: interrogatories.map((question) => ({
          _key: question._key || crypto.randomUUID(),
          ...question,
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

// GENERATE FINAL RESPONSES OR DOCX.
export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ clientId: string }> },
) {
  try {
    const rawBody: unknown = await req.json().catch(() => null);

    const body: RequestBody =
      typeof rawBody === "object" && rawBody !== null
        ? (rawBody as RequestBody)
        : {};

    if (body.action === "generateFinalResponse") {
      const finalResponse = await createFinalResponse({
        question: body.question || "",
        attorneyResponse: body.attorneyResponse || "",
        clientResponse: body.clientResponse || "",
      });

      return NextResponse.json({ finalResponse });
    }

    const { clientId } = await context.params;
    const decodedClientId = decodeURIComponent(clientId);

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

    // Convert optional metadata into the required CaseMetadata type.
    const metadata = buildCaseMetadata(existing.metadata);

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

    const filename = `${existing.caseNumber || "interrogatories"
      }.docx`;

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