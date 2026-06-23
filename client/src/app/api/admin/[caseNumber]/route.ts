import { NextRequest, NextResponse } from "next/server";
import { groq } from "next-sanity";
import { client } from "@/sanity/client";

// LOAD CASE
export async function GET(
    req: NextRequest,
    context: { params: Promise<{ caseNumber: string }> }
) {
    try {
        const { caseNumber } = await context.params;
        const decoded = decodeURIComponent(caseNumber); const data = await client.fetch(
            groq`
          *[
            _type == "interrogatory" &&
            caseNumber == $caseNumber
          ][0]
        `,
            { caseNumber: decoded }
        ); return NextResponse.json(data || {});
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

