import { NextRequest, NextResponse } from "next/server";
import { groq } from "next-sanity";
import { client } from "@/sanity/client";
import { serverClient } from "@/sanity/serverClient";
import { getClientAccess } from "@/lib/oauth";

const scalarFields = [
    "clientName", "clientPhone", "clientDob", "clientEmail", "clientSsnLast4",
    "clientAutoInsurance", "clientPolicyNumber", "clientClaimNumber",
    "clientHealthInsurance", "clientHealthInsuranceMemberNumber", "injuries",
    "medicalCare", "medicalProvider", "collisionLocation", "collisionDate",
    "collisionDescription", "policeDepartment", "policeReportNumber",
    "defendantName", "defendantInsurance", "defendantAdjuster",
    "defendantPolicyNumber", "defendantClaimNumber",
] as const;

const fileFields = ["driverLicense", "healthInsuranceCards", "declarationPage"] as const;

const getRecord = async (clientId: string) => serverClient.fetch(
    groq`*[_type=="clientType" && (_id==$clientId || clientId==$clientId)][0]{_id}`,
    { clientId },
    { cache: "no-store" }
);

// Validate access before every operation.
async function authorize(clientId: string, token?: string) {
    return getClientAccess(clientId, token);
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ clientId: string }> }) {
    try {
        const { clientId } = await params;
        const token = req.nextUrl.searchParams.get("token") || undefined;
        const access = await authorize(clientId, token);
        if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        const record = await client.fetch(
            groq`*[_type=="clientType" && (_id==$clientId || clientId==$clientId)][0]{
        clientName,clientPhone,clientDob,clientEmail,clientSsnLast4,
        clientAutoInsurance,clientPolicyNumber,clientClaimNumber,
        clientHealthInsurance,clientHealthInsuranceMemberNumber,
        injuries,medicalCare,medicalProvider,collisionLocation,collisionDate,
        collisionDescription,policeDepartment,policeReportNumber,
        defendantName,defendantInsurance,defendantAdjuster,
        defendantPolicyNumber,defendantClaimNumber,intakeStatus
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

// Autosave scalar fields without changing intakeStatus.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ clientId: string }> }) {
    try {
        const { clientId } = await params;
        const token = req.nextUrl.searchParams.get("token") || undefined;
        const access = await authorize(clientId, token);
        if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        const existing = await getRecord(clientId);
        if (!existing?._id) return NextResponse.json({ error: "Client not found" }, { status: 404 });
        const data = await req.json();
        const patchData: Record<string, string> = {};
        for (const field of scalarFields) if (field in data) patchData[field] = typeof data[field] === "string" ? data[field] : "";
        patchData.updatedAt = new Date().toISOString();
        if (Object.keys(patchData).length > 1) await serverClient.patch(existing._id).set(patchData).commit();
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("AUTOSAVE SIGNUP ERROR", error);
        return NextResponse.json({ error: "Unable to autosave intake" }, { status: 500 });
    }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ clientId: string }> }) {
    try {
        const { clientId } = await params;
        const formData = await req.formData();
        const tokenValue = formData.get("token");
        const token = typeof tokenValue === "string" ? tokenValue : undefined;
        const access = await authorize(clientId, token);
        if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        const existing = await getRecord(clientId);
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
                    contentType: value.type || "application/octet-stream",
                });
                patchData[field] = { _type: "file", asset: { _type: "reference", _ref: asset._id } };
            }
        }

        // Final submission state.
        const now = new Date().toISOString();
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