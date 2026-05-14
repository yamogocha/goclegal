// client/src/app/api/cron/weeklyAd/route.ts

import { getErrorMessage } from "@/lib";
import { verifyCronAuth } from "@/lib/oauth";
import {
  generateWeeklyAd,
} from "@/lib/weeklyAd";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const unauthorized = verifyCronAuth(req);

  if (unauthorized) {
    return unauthorized;
  }

  const { searchParams } = new URL(req.url);

  const preview =
    searchParams.get("preview") === "true";

  const dryRun =
    searchParams.get("dryRun") === "true";

  try {
    const result = await generateWeeklyAd({
      preview,
      dryRun,
    });

    const failed =
      !result?.ok ||
      result?.igError ||
      result?.youtubeError ||
      result?.gbpError;

    if (failed) {
      console.error(
        "[WEEKLY AD ROUTE FAILED]",
        JSON.stringify(result, null, 2)
      );

      return Response.json(
        {
          ok: false,
          result,
        },
        {
          status: 500,
        }
      );
    }

    return Response.json(
      {
        ok: true,
        result,
      },
      {
        status: 200,
      }
    );
  } catch (err) {
    const error = getErrorMessage(err);

    console.error("[WEEKLY AD ROUTE ERROR]", error);

    return Response.json(
      {
        ok: false,
        error,
      },
      {
        status: 500,
      }
    );
  }
}