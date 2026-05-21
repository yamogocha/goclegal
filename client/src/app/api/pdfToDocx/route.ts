// API supports:
// 1. JSON interrogatories extraction
// 2. DOCX reconstruction download

import {
  NextRequest,
  NextResponse,
} from "next/server";

import { pdfToDocx } from "@/lib/pdfToDocx";

export const runtime =
  "nodejs";

export async function POST(
  req: NextRequest
) {
  try {
    const formData =
      await req.formData();

    const file = formData.get(
      "file"
    ) as File;

    const mode =
      formData.get(
        "mode"
      ) as string;

    // ======================================
    // GET RESPONSES FROM UI
    // ======================================

    const responsesRaw =
      formData.get(
        "responses"
      ) as string;

    const responses =
      responsesRaw
        ? JSON.parse(
            responsesRaw
          )
        : {};

    if (!file) {
      return NextResponse.json(
        {
          error:
            "No file uploaded",
        },
        {
          status: 400,
        }
      );
    }

    const buffer =
      await file.arrayBuffer();

    // ======================================
    // PASS RESPONSES INTO DOCX GENERATOR
    // ======================================

    const result =
      await pdfToDocx(
        buffer,
        responses
      );

    if (mode === "json") {
      return NextResponse.json({
        interrogatories:
          result.interrogatories ||
          [],
      });
    }

    return new NextResponse(
      new Uint8Array(
        result.docxBuffer
      ),
      {
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",

          "Content-Disposition":
            'attachment; filename="interrogatories.docx"',
        },
      }
    );
  } catch (e: any) {
    return NextResponse.json(
      {
        error:
          e.message ||
          "Server error",
      },
      {
        status: 500,
      }
    );
  }
}