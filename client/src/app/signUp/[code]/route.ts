import { NextRequest, NextResponse } from "next/server";
import { groq } from "next-sanity";
import { serverClient } from "@/sanity/serverClient";

// Redirect short intake URL to the existing secure portal URL.
export async function GET(req: NextRequest, context: { params: Promise<{ code: string }> }) {
    try {
        const { code } = await context.params;
        const client = await serverClient.fetch(
            groq`*[_type == "clientType" && clientPortalCode == $code][0]{clientId, clientAccessToken}`,
            { code }
        );

        if (!client?.clientAccessToken) return new NextResponse("Link not found or expired.", { status: 404 });

        const baseUrl = process.env.BASE_URL;
        if (!baseUrl) return new NextResponse("BASE_URL is not configured.", { status: 500 });

        const url = `${baseUrl}/portal/${encodeURIComponent(client.clientId)}/signUp?token=${encodeURIComponent(client.clientAccessToken)}`;
        return NextResponse.redirect(url);
    } catch (error) {
        console.error("INTAKE SHORT LINK ERROR", error);
        return new NextResponse("Unable to open link.", { status: 500 });
    }
}