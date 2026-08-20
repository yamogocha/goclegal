import { NextRequest, NextResponse } from "next/server";
import { groq } from "next-sanity";
import { detectInterrogatoryType, loadFormInterrogatoryPdfQuestions, loadSpecialInterrogatoryPdfQuestions } from "@/lib/pdfToDocx";
import crypto from "crypto";
import { serverClient } from "@/sanity/serverClient";

// Load client and its interrogatory.
export async function GET(req: NextRequest, context: { params: Promise<{ clientId: string }> }) {
    try {
        const { clientId } = await context.params;
        const decodedClientId = decodeURIComponent(clientId);
        const data = await serverClient.fetch(
            groq`*[_type == "clientType" && (_id == $clientId || clientId == $clientId)][0]{
        _id,
        clientId,
        clientName,
        clientPhone,
        clientEmail,
        clientAccessToken,
        intakeStatus,
        clientAutoInsurance,
        clientPolicyNumber,
        clientClaimNumber,
        clientHealthInsurance,
        clientHealthInsuranceMemberNumber,
        injuries,
        medicalCare,
        medicalProvider,
        collisionLocation,
        collisionDate,
        collisionDescription,
        policeDepartment,
        policeReportNumber,
        defendantName,
        defendantInsurance,
        defendantAdjuster,
        defendantPolicyNumber,
        defendantClaimNumber,
        "interrogatory": *[_type == "interrogatory" && client._ref == ^._id][0]{
          _id,
          caseNumber,
          status,
          interrogatoryType,
          "clientId": client._ref
        }
      }`,
            { clientId: decodedClientId },
            { perspective: "published" }
        );
        if (!data) return NextResponse.json({ error: "Client not found" }, { status: 404 });
        return NextResponse.json(data);
    } catch (e: any) {
        console.error("LOAD CLIENT ERROR", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

// Add interrogatories to an existing client.
export async function POST(req: NextRequest, context: { params: Promise<{ clientId: string }> }) {
    try {
        const { clientId } = await context.params;
        const decodedClientId = decodeURIComponent(clientId);

        const existingClient = await serverClient.fetch(
            groq`*[_type == "clientType" && (_id == $clientId || clientId == $clientId)][0]{
        _id,
        clientId,
        clientName,
        clientAccessToken
      }`,
            { clientId: decodedClientId }
        );

        if (!existingClient) return NextResponse.json({ error: "Client not found" }, { status: 404 });
        if (!existingClient.clientAccessToken) return NextResponse.json({ error: "Client access token is missing" }, { status: 400 });

        const formData = await req.formData();
        const file = formData.get("file") as File | null;
        if (!file) return NextResponse.json({ error: "No PDF uploaded" }, { status: 400 });

        const buffer = await file.arrayBuffer();
        const interrogatoryType = await detectInterrogatoryType(buffer);
        const result = interrogatoryType === "form" ? await loadFormInterrogatoryPdfQuestions(buffer) : await loadSpecialInterrogatoryPdfQuestions(buffer);

        const existing = await serverClient.fetch(
            groq`*[_type == "interrogatory" && caseNumber == $caseNumber][0]{_id}`,
            { caseNumber: result.metadata.caseNumber }
        );

        if (existing) return NextResponse.json({ error: "Case already exists" }, { status: 409 });

        const payload = {
            client: { _type: "reference", _ref: existingClient._id },
            clientAccessToken: existingClient.clientAccessToken,
            caseNumber: result.metadata.caseNumber,
            metadata: result.metadata,
            interrogatoryType: interrogatoryType === "form" ? "form" : "special",
            interrogatories: result.interrogatories.map(q => ({
                _key: crypto.randomUUID(),
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

        await serverClient.create({ _type: "interrogatory", ...payload });

        return NextResponse.json({
            clientId: existingClient.clientId || existingClient._id,
            caseNumber: payload.caseNumber,
            redirectTo: `/admin/${encodeURIComponent(existingClient.clientId || existingClient._id)}/interrogatories`,
        });
    } catch (e: any) {
        console.error("ADD INTERROGATORIES ERROR", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}