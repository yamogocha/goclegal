import { NextRequest, NextResponse } from "next/server";
import { runBudgetControl } from "@/lib/googleAds/budget";

// // GET route for cron
export async function GET(req: NextRequest) {
  try {
    const result = await runBudgetControl();
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}