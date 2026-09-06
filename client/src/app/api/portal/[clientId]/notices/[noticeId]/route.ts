import { NextRequest, NextResponse } from "next/server";
import { groq } from "next-sanity";
import { serverClient } from "@/sanity/serverClient";
import { buildNoticeDocx, NOTICE_TYPES, type NoticeId } from "@/lib/notices";

type RouteContext = {
    params: Promise<{
        clientId: string;
        noticeId: string;
    }>;
};

export async function GET(
    request: NextRequest,
    { params }: RouteContext,
) {
    try {
        const { clientId, noticeId } = await params;
        const mode = request.nextUrl.searchParams.get("mode") || "download";

        if (!(noticeId in NOTICE_TYPES)) {
            return NextResponse.json(
                { error: "Invalid notice type." },
                { status: 400 },
            );
        }

        const client = await serverClient.fetch(
            groq`*[
        _type == "clientType" &&
        (_id == $clientId || clientId == $clientId)
      ][0]{
        clientName,
        clientPronoun,
        clientEmail,
        clientPhone,
        collisionDate,
        collisionTime,
        collisionLocation,
        collisionDescription,
        injuries,
        defendantName,
        defendantInsurance,
        defendantAdjuster,
        defendantPolicyNumber,
        defendantClaimNumber,
        defendantCdl,
        defendantDob,
        defendantEmail,
        defendantAddress,
        defendantInsuranceEmail,
        defendantInsuranceAddress,
        uberReferenceNumber
      }`,
            { clientId },
        );

        if (!client) {
            return NextResponse.json(
                { error: "Client not found." },
                { status: 404 },
            );
        }

        const docx = await buildNoticeDocx(
            noticeId as NoticeId,
            client,
            request.url,
        );

        const filename = NOTICE_TYPES[noticeId as NoticeId].filename;
        const disposition = mode === "view" ? "inline" : "attachment";

        return new NextResponse(docx as BodyInit, {
            status: 200,
            headers: {
                "Content-Type":
                    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                "Content-Disposition": `${disposition}; filename="${filename}"`,
                "Content-Length": String(docx.length),
                "Cache-Control": "no-store",
            },
        });
    } catch (error) {
        console.error("Notice generation error:", error);

        return NextResponse.json(
            {
                error:
                    error instanceof Error
                        ? error.message
                        : "Unable to generate notice.",
            },
            { status: 500 },
        );
    }
}