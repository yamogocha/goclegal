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

const arrayFileFields = ["driverLicense", "healthInsuranceCards", "medicalRecords"] as const;

const getRecord = async (clientId: string) => serverClient.fetch(
    groq`*[_type=="clientType" && (_id==$clientId || clientId==$clientId)][0]{
        _id,
        driverLicense,
        healthInsuranceCards,
        medicalRecords,
        declarationPage
    }`,
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
                defendantPolicyNumber,defendantClaimNumber,intakeStatus,
                "driverLicense": driverLicense[]{asset->{_id,url,originalFilename,filename}},
                "healthInsuranceCards": healthInsuranceCards[]{asset->{_id,url,originalFilename,filename}},
                "medicalRecords": medicalRecords[]{asset->{_id,url,originalFilename,filename}},
                "declarationPage": declarationPage{asset->{_id,url,originalFilename,filename}}
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

        const existing = await serverClient.fetch(
            groq`*[_type=="clientType" && (_id==$clientId || clientId==$clientId)][0]{
                _id,
                driverLicense,
                healthInsuranceCards,
                medicalRecords,
                declarationPage
            }`,
            { clientId },
            { cache: "no-store" }
        );

        if (!existing?._id) return NextResponse.json({ error: "Client not found" }, { status: 404 });

        // Patch scalar intake fields.
        const patchData: Record<string, unknown> = {};

        for (const field of scalarFields) {
            const value = formData.get(field);
            patchData[field] = typeof value === "string" ? value : "";
        }

        // Upload files and build complete arrays.
        for (const field of arrayFileFields) {
            const files = formData.getAll(field).filter(
                (value): value is File => value instanceof File && value.size > 0
            );

            if (!files.length) continue;

            const uploaded = [];

            for (const file of files) {
                console.log(`Uploading ${field}: ${file.name} (${file.size} bytes)`);

                const asset = await serverClient.assets.upload(
                    "file",
                    Buffer.from(await file.arrayBuffer()),
                    {
                        filename: file.name,
                        contentType: file.type || "application/octet-stream",
                    }
                );

                console.log(`Sanity asset created: ${asset._id}`);

                uploaded.push({
                    _key: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
                    _type: "file",
                    asset: {
                        _type: "reference",
                        _ref: asset._id,
                    },
                });
            }

            patchData[field] = [...(existing[field] || []), ...uploaded];

            console.log(`${field}: saving ${uploaded.length} new file(s), ${existing[field]?.length || 0} existing file(s)`);
        }

        // Keep declarationPage as a single file.
        const declarationPage = formData.get("declarationPage");

        if (declarationPage instanceof File && declarationPage.size > 0) {
            console.log(`Uploading declarationPage: ${declarationPage.name}`);

            const asset = await serverClient.assets.upload(
                "file",
                Buffer.from(await declarationPage.arrayBuffer()),
                {
                    filename: declarationPage.name,
                    contentType: declarationPage.type || "application/octet-stream",
                }
            );

            console.log(`Sanity declaration asset created: ${asset._id}`);

            patchData.declarationPage = {
                _type: "file",
                asset: {
                    _type: "reference",
                    _ref: asset._id,
                },
            };
        }

        // Final submission state.
        const now = new Date().toISOString();

        patchData.intakeStatus = "submitted";
        patchData.intakeSubmittedAt = now;
        patchData.updatedAt = now;

        console.log("Saving client document:", existing._id);
        console.log("File fields:", {
            driverLicense: Array.isArray(patchData.driverLicense) ? patchData.driverLicense.length : 0,
            healthInsuranceCards: Array.isArray(patchData.healthInsuranceCards) ? patchData.healthInsuranceCards.length : 0,
            medicalRecords: Array.isArray(patchData.medicalRecords) ? patchData.medicalRecords.length : 0,
            declarationPage: !!patchData.declarationPage,
        });

        const result = await serverClient
            .patch(existing._id)
            .set(patchData)
            .commit();

        console.log("Sanity document saved:", result._id);

        return NextResponse.json({
            success: true,
            clientId: access.clientId,
            intakeStatus: "submitted",
        });
    } catch (error) {
        console.error("SUBMIT SIGNUP ERROR", error);

        return NextResponse.json({
            error: error instanceof Error ? error.message : "Unable to submit intake",
        }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ clientId: string }> }) {
    try {
        const { clientId } = await params;
        const token = req.nextUrl.searchParams.get("token") || undefined;
        const access = await authorize(clientId, token);
        if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const existing = await getRecord(clientId);
        if (!existing?._id) return NextResponse.json({ error: "Client not found" }, { status: 404 });

        const { field, assetId } = await req.json();

        if (!["driverLicense", "healthInsuranceCards", "medicalRecords", "declarationPage"].includes(field)) {
            return NextResponse.json({ error: "Invalid file field" }, { status: 400 });
        }

        if (!assetId) return NextResponse.json({ error: "Missing asset ID" }, { status: 400 });

        if (field === "declarationPage") {
            await serverClient.patch(existing._id).unset([field]).commit();
        } else {
            await serverClient.patch(existing._id).set({
                [field]: (existing[field] || []).filter((file: any) => file?.asset?._ref !== assetId),
            }).commit();
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("DELETE SIGNUP FILE ERROR", error);
        return NextResponse.json({
            error: error instanceof Error ? error.message : "Unable to remove file",
        }, { status: 500 });
    }
}