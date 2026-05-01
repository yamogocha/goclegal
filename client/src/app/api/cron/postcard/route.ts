import { NextRequest, NextResponse } from "next/server";
import {
  generatePostcardCreative,
  sendPostcard,
  createTestCSV,
} from "@/lib/postcard";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const dryRun = url.searchParams.get("dryRun") === "true";

    // 1. Generate creative
    await generatePostcardCreative();

    // 2. CSV (replace later with real list)
    const csvPath = createTestCSV();

    // 3. Send postcard
    let result = null;

    if (!dryRun) {
      result = await sendPostcard({
        csvPath,
        testMode: true, // IMPORTANT: test first
      });
    }

    return NextResponse.json({
      success: true,
      preview: {
        csvPath,
      },
      sent: !dryRun,
      result,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message },
      { status: 500 }
    );
  }
}