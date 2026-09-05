import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
    try {
        const url = req.nextUrl.searchParams.get("url");
        if (!url) return NextResponse.json({ error: "Missing file URL" }, { status: 400 });

        const response = await fetch(url);
        if (!response.ok) return NextResponse.json({ error: "Unable to load file" }, { status: response.status });

        const contentType = response.headers.get("content-type") || "application/octet-stream";
        const buffer = await response.arrayBuffer();

        return new NextResponse(buffer, {
            headers: {
                "Content-Type": contentType,
                "Content-Disposition": "inline",
                "Cache-Control": "private, max-age=300",
            },
        });
    } catch (error) {
        return NextResponse.json({
            error: error instanceof Error ? error.message : "Unable to load file",
        }, { status: 500 });
    }
}