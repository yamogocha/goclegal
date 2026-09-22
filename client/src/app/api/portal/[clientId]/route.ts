import { NextRequest, NextResponse } from "next/server";
import { groq } from "next-sanity";
import { detectInterrogatoryType, loadFormInterrogatoryPdfQuestions, loadSpecialInterrogatoryPdfQuestions } from "@/lib/pdfToDocx";
import { sendSms } from "@/lib/communication";
import { serverClient } from "@/sanity/serverClient";
import crypto from "crypto";

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
        clientPortalCode,
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
        clientPronoun,
        collisionTime,
        defendantCdl,
        defendantDob,
        defendantEmail,
        defendantAddress,
        defendantInsuranceEmail,
        defendantInsuranceAddress,
        uberReferenceNumber,
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

// Add interrogatories and send the client a secure questionnaire link.
export async function POST(req: Request, context: { params: Promise<{ clientId: string }> }) {
    try {
        const { clientId } = await context.params;
        const decodedClientId = decodeURIComponent(clientId);
        const existingClient = await serverClient.fetch(
            groq`*[_type == "clientType" && (_id == $clientId || clientId == $clientId)][0]{_id,clientId,clientName,clientPhone,clientAccessToken,clientPortalCode}`,
            { clientId: decodedClientId }
        );

        if (!existingClient) return NextResponse.json({ error: "Client not found" }, { status: 404 });
        if (!existingClient.clientAccessToken) return NextResponse.json({ error: "Client access token is missing" }, { status: 400 });
        if (!existingClient.clientPortalCode) return NextResponse.json({ error: "Client portal code is missing" }, { status: 400 });
        if (!existingClient.clientPhone) return NextResponse.json({ error: "Client phone number is missing" }, { status: 400 });

        const formData = await req.formData();
        const file = formData.get("file") as File | null;
        if (!file) return NextResponse.json({ error: "No PDF uploaded" }, { status: 400 });
        if (file.type !== "application/pdf") return NextResponse.json({ error: "Only PDF interrogatories are supported" }, { status: 400 });

        const buffer = await file.arrayBuffer();
        const interrogatoryType = await detectInterrogatoryType(buffer);
        const result = interrogatoryType === "form" ? await loadFormInterrogatoryPdfQuestions(buffer) : await loadSpecialInterrogatoryPdfQuestions(buffer);

        const existing = await serverClient.fetch(
            groq`*[_type == "interrogatory" && caseNumber == $caseNumber][0]{_id}`,
            { caseNumber: result.metadata.caseNumber }
        );

        if (existing) return NextResponse.json({ error: "Case already exists" }, { status: 409 });

        const now = new Date().toISOString();
        const payload = {
            client: { _type: "reference", _ref: existingClient._id },
            caseNumber: result.metadata.caseNumber,
            metadata: result.metadata,
            interrogatoryType: interrogatoryType === "form" ? "form" : "special",
            interrogatories: result.interrogatories.map((q) => ({
                _key: crypto.randomUUID(),
                number: q.number,
                question: q.question,
                questionLines: q.questionLines || [],
                plaintiffAttorneyResponse: "",
                plaintiffClientResponse: "",
                finalResponse: "",
            })),
            createdAt: now,
            updatedAt: now,
        };

        const interrogatory = await serverClient.create({ _type: "interrogatory", ...payload });
        const baseUrl = process.env.BASE_URL;

        if (!baseUrl) return NextResponse.json({ error: "BASE_URL is not configured" }, { status: 500 });

        const clientUrl = `${baseUrl}/interrogatories/${encodeURIComponent(existingClient.clientPortalCode)}`;
        const secureUrl = `${baseUrl}/portal/${encodeURIComponent(existingClient.clientId || existingClient._id)}/interrogatories?token=${encodeURIComponent(existingClient.clientAccessToken)}`;
        const message = `Hi ${existingClient.clientName}, this is GOC Legal. Please complete your interrogatories through our secure portal: ${clientUrl}`;

        try {
            const sms = await sendSms(existingClient.clientPhone, message);
            await serverClient.patch(existingClient._id).set({
                lastCommunicationAt: now,
                lastOutboundMessageAt: now,
                communications: [
                    {
                        _key: crypto.randomUUID(),
                        direction: "outbound",
                        channel: "sms",
                        type: "interrogatories_link",
                        message,
                        status: "sent",
                        providerMessageId: sms.sid,
                        sentAt: now,
                    },
                ],
                updatedAt: new Date().toISOString(),
            }).commit();
        } catch (smsError) {
            console.error("INTERROGATORY SMS ERROR", smsError);
            return NextResponse.json({
                error: "Interrogatories were uploaded, but the client text could not be sent.",
                interrogatoryId: interrogatory._id,
            }, { status: 502 });
        }

        return NextResponse.json({
            success: true,
            clientId: existingClient.clientId || existingClient._id,
            caseNumber: payload.caseNumber,
            interrogatoryUrl: secureUrl,
            shortUrl: clientUrl,
            messageSent: true,
            redirectTo: `/portal/${encodeURIComponent(existingClient.clientId || existingClient._id)}/interrogatories`,
        });
    } catch (e: any) {
        console.error("ADD INTERROGATORIES ERROR", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}