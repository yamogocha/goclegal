import { NextRequest, NextResponse } from "next/server";
import { groq } from "next-sanity";
import { client } from "@/sanity/client";
import { serverClient } from "@/sanity/serverClient";
import { getClientAccess } from "@/lib/oauth";

const scalarFields = [
    "clientName", "clientPhone", "clientDob", "clientEmail", "clientSsnLast4",
    "clientAutoInsurance", "clientPolicyNumber", "clientClaimNumber",
    "clientHealthInsurance", "clientHealthInsuranceMemberNumber",
    "injuries", "medicalCare", "medicalProvider",
    "collisionLocation", "collisionDate", "collisionDescription",
    "policeDepartment", "policeReportNumber",
    "defendantName", "defendantInsurance", "defendantAdjuster", "defendantPolicyNumber", "defendantClaimNumber"
] as const;

const fileFields = ["driverLicense", "healthInsuranceCards", "declarationPage"] as const;

export async function GET(req: NextRequest, { params }: { params: Promise<{ clientId: string }> }) {
    try {
        const { clientId } = await params;
        const token = req.nextUrl.searchParams.get("token") || undefined;
        const access = await getClientAccess(clientId, token);
        if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const record = await client.fetch(
            groq`*[_type=="clientType" && (_id==$clientId || clientId==$clientId)][0]{
        clientName,clientPhone,clientDob,clientEmail,clientSsnLast4,
        clientAutoInsurance,clientPolicyNumber,clientClaimNumber,
        clientHealthInsurance,clientHealthInsuranceMemberNumber,
        injuries,medicalCare,medicalProvider,
        collisionLocation,collisionDate,collisionDescription,
        policeDepartment,policeReportNumber,
        defendantName,defendantInsurance,defendantAdjuster,defendantPolicyNumber,defendantClaimNumber,
        intakeStatus
      }`,
            { clientId },
            { cache: "no-store" }
        );

        if (!record) return NextResponse.json({ error: "Client not found" }, { status: 404 });
        return NextResponse.json({ mode: access.mode, client: record });
    } catch (error) {
        console.error("LOAD SIGNUP ERROR", error);
        return NextResponse.json({ error: "Unable to load intake" }, { status: 500 });
    }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ clientId: string }> }) {
    try {
        const { clientId } = await params;
        const formData = await req.formData();
        const tokenValue = formData.get("token");
        const token = typeof tokenValue === "string" ? tokenValue : undefined;
        const access = await getClientAccess(clientId, token);
        if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const existing = await serverClient.fetch(
            groq`*[_type=="clientType" && (_id==$clientId || clientId==$clientId)][0]{_id}`,
            { clientId }
        );
        if (!existing?._id) return NextResponse.json({ error: "Client not found" }, { status: 404 });

        // Patch all scalar intake fields.
        const patchData: Record<string, unknown> = {};
        for (const field of scalarFields) {
            const value = formData.get(field);
            patchData[field] = typeof value === "string" ? value : "";
        }

        // Upload and replace Sanity file assets when provided.
        for (const field of fileFields) {
            const value = formData.get(field);
            if (value instanceof File && value.size > 0) {
                const buffer = Buffer.from(await value.arrayBuffer());
                const asset = await serverClient.assets.upload("file", buffer, {
                    filename: value.name,
                    contentType: value.type || "application/octet-stream"
                });
                patchData[field] = {
                    _type: "file",
                    asset: { _type: "reference", _ref: asset._id }
                };
            }
        }

        const now = new Date().toISOString();

        // Preserve optional fields and update intake state.
        patchData.intakeStatus = "submitted";
        patchData.intakeSubmittedAt = now;
        patchData.updatedAt = now;

        await serverClient.patch(existing._id).set(patchData).commit();

        return NextResponse.json({ success: true, clientId: access.clientId, intakeStatus: "submitted" });
    } catch (error) {
        console.error("SUBMIT SIGNUP ERROR", error);
        return NextResponse.json({ error: "Unable to submit intake" }, { status: 500 });
    }
}