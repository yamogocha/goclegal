import { NextRequest, NextResponse } from "next/server";
import { groq } from "next-sanity";
import { client } from "@/sanity/client";
import { serverClient } from "@/sanity/serverClient";
import { getClientAccess } from "@/lib/oauth";
const scalarFields = ["clientName", "clientPhone", "clientDob", "clientEmail", "clientSsnLast4", "clientPronoun", "clientVehicle", "clientAutoInsurance", "clientPolicyNumber", "clientClaimNumber", "clientHealthInsurance", "clientHealthInsuranceMemberNumber", "injuries", "medicalCare", "medicalProvider", "collisionLocation", "collisionDate", "collisionTime", "collisionDescription", "policeDepartment", "policeReportNumber", "defendantVehicle", "defendantName", "defendantInsurance", "defendantAdjuster", "defendantPolicyNumber", "defendantClaimNumber", "defendantCdl", "defendantDob", "defendantEmail", "defendantAddress", "defendantInsuranceEmail", "defendantInsuranceAddress", "uberReferenceNumber", "caseNumber"] as const;
const arrayFileFields = ["driverLicense", "healthInsuranceCards", "medicalRecords", "vehicleDamagePhotos"] as const;
const fileFields = [...arrayFileFields, "declarationPage"] as const;
const getRecord = async (clientId: string) => serverClient.fetch(groq`*[_type=="clientType" && (_id==$clientId || clientId==$clientId)][0]{_id,driverLicense,healthInsuranceCards,medicalRecords,vehicleDamagePhotos,declarationPage}`, { clientId }, { cache: "no-store" });
async function authorize(clientId: string, token?: string) { return getClientAccess(clientId, token); }
export async function GET(req: NextRequest, { params }: { params: Promise<{ clientId: string }> }) {
    try {
        const { clientId } = await params, token = req.nextUrl.searchParams.get("token") || undefined, access = await authorize(clientId, token);
        if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        const record = await client.fetch(groq`*[_type=="clientType" && (_id==$clientId || clientId==$clientId)][0]{clientName,clientPhone,clientDob,clientEmail,clientSsnLast4,clientPronoun,clientVehicle,clientAutoInsurance,clientPolicyNumber,clientClaimNumber,clientHealthInsurance,clientHealthInsuranceMemberNumber,injuries,medicalCare,medicalProvider,collisionLocation,collisionDate,collisionTime,collisionDescription,policeDepartment,policeReportNumber,defendantVehicle,defendantName,defendantInsurance,defendantAdjuster,defendantPolicyNumber,defendantClaimNumber,defendantCdl,defendantDob,defendantEmail,defendantAddress,defendantInsuranceEmail,defendantInsuranceAddress,uberReferenceNumber,caseNumber,intakeStatus,"driverLicense":driverLicense[]{asset->{_id,url,originalFilename,filename}},"healthInsuranceCards":healthInsuranceCards[]{asset->{_id,url,originalFilename,filename}},"medicalRecords":medicalRecords[]{asset->{_id,url,originalFilename,filename}},"vehicleDamagePhotos":vehicleDamagePhotos[]{asset->{_id,url,originalFilename,filename}},"declarationPage":declarationPage{asset->{_id,url,originalFilename,filename}}}`, { clientId }, { cache: "no-store" });
        if (!record) return NextResponse.json({ error: "Client not found" }, { status: 404 });
        return NextResponse.json({ mode: access.mode, client: record });
    } catch (error) { console.error("LOAD SIGNUP ERROR", error); return NextResponse.json({ error: "Unable to load intake" }, { status: 500 }); }
}
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ clientId: string }> }) {
    try {
        const { clientId } = await params, token = req.nextUrl.searchParams.get("token") || undefined, access = await authorize(clientId, token);
        if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        const existing = await getRecord(clientId);
        if (!existing?._id) return NextResponse.json({ error: "Client not found" }, { status: 404 });
        const data: unknown = await req.json();
        if (!data || typeof data !== "object" || Array.isArray(data)) return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
        const input = data as Record<string, unknown>, patchData: Record<string, unknown> = {};
        for (const field of scalarFields) if (field in input) patchData[field] = typeof input[field] === "string" ? input[field] : "";
        patchData.updatedAt = new Date().toISOString();
        if (Object.keys(patchData).length > 1) await serverClient.patch(existing._id).set(patchData).commit();
        return NextResponse.json({ success: true });
    } catch (error) { console.error("AUTOSAVE SIGNUP ERROR", error); return NextResponse.json({ error: "Unable to autosave intake" }, { status: 500 }); }
}
export async function POST(req: NextRequest, { params }: { params: Promise<{ clientId: string }> }) {
    try {
        const { clientId } = await params, formData = await req.formData(), tokenValue = formData.get("token"), token = typeof tokenValue === "string" ? tokenValue : undefined, access = await authorize(clientId, token);
        if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        const existing = await serverClient.fetch(groq`*[_type=="clientType" && (_id==$clientId || clientId==$clientId)][0]{_id,driverLicense,healthInsuranceCards,medicalRecords,vehicleDamagePhotos,declarationPage}`, { clientId }, { cache: "no-store" });
        if (!existing?._id) return NextResponse.json({ error: "Client not found" }, { status: 404 });
        const patchData: Record<string, unknown> = {};
        for (const field of scalarFields) { const value = formData.get(field); patchData[field] = typeof value === "string" ? value : ""; }
        for (const field of arrayFileFields) {
            const files = formData.getAll(field).filter((value): value is File => value instanceof File && value.size > 0);
            if (!files.length) continue;
            const uploaded = [];
            for (const file of files) {
                const asset = await serverClient.assets.upload("file", Buffer.from(await file.arrayBuffer()), { filename: file.name, contentType: file.type || "application/octet-stream" });
                uploaded.push({ _key: `${Date.now()}-${Math.random().toString(36).slice(2)}`, _type: "file", asset: { _type: "reference", _ref: asset._id } });
            }
            const oldFiles = (existing as Record<string, any>)[field];
            patchData[field] = [...(Array.isArray(oldFiles) ? oldFiles : []), ...uploaded];
        }
        const declarationPage = formData.get("declarationPage");
        if (declarationPage instanceof File && declarationPage.size > 0) {
            const asset = await serverClient.assets.upload("file", Buffer.from(await declarationPage.arrayBuffer()), { filename: declarationPage.name, contentType: declarationPage.type || "application/octet-stream" });
            patchData.declarationPage = { _type: "file", asset: { _type: "reference", _ref: asset._id } };
        }
        const now = new Date().toISOString();
        patchData.intakeStatus = "submitted"; patchData.intakeSubmittedAt = now; patchData.updatedAt = now;
        const result = await serverClient.patch(existing._id).set(patchData).commit();
        return NextResponse.json({ success: true, clientId: access.clientId, intakeStatus: "submitted", savedId: result._id });
    } catch (error) { console.error("SUBMIT SIGNUP ERROR", error); return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to submit intake" }, { status: 500 }); }
}
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ clientId: string }> }) {
    try {
        const { clientId } = await params, token = req.nextUrl.searchParams.get("token") || undefined, access = await authorize(clientId, token);
        if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        const existing = await getRecord(clientId);
        if (!existing?._id) return NextResponse.json({ error: "Client not found" }, { status: 404 });
        const body = await req.json() as { field?: string; assetId?: string }, field = body.field, assetId = body.assetId;
        if (!field || !(fileFields as readonly string[]).includes(field)) return NextResponse.json({ error: "Invalid file field" }, { status: 400 });
        if (!assetId) return NextResponse.json({ error: "Missing asset ID" }, { status: 400 });
        if (field === "declarationPage") await serverClient.patch(existing._id).unset([field]).commit();
        else {
            const current = (existing as Record<string, any>)[field];
            await serverClient.patch(existing._id).set({ [field]: (Array.isArray(current) ? current : []).filter((file: any) => file?.asset?._ref !== assetId) }).commit();
        }
        return NextResponse.json({ success: true });
    } catch (error) { console.error("DELETE SIGNUP FILE ERROR", error); return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to remove file" }, { status: 500 }); }
}
