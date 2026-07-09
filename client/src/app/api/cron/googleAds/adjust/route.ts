// no change needed except naming consistency
import { getErrorMessage } from "@/lib";
import {
  weeklyAdjustments,
} from "@/lib/googleAds/adjust";

import { verifyCronAuth } from "@/lib/oauth";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const unauthorized = verifyCronAuth(req);

  if (unauthorized) {
    return unauthorized;
  }

  const { searchParams } = new URL(req.url);

  const dryRun =
    searchParams.get("dryRun") === "true";

  try {
    const result =
      await weeklyAdjustments({
        dryRun,
      });

    const failed =
      !result.ok ||
      (result.errors?.length ?? 0) > 0;

    if (failed) {
      console.error(
        "[GOOGLE ADS ADJUST FAILED]",
        JSON.stringify(result, null, 2)
      );

      return Response.json(
        {
          ok: false,
          dryRun,
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
        dryRun,
        result,
      },
      {
        status: 200,
      }
    );

  } catch (err) {
    const error = getErrorMessage(err);

    console.error(
      "[GOOGLE ADS ADJUST ROUTE ERROR]"
    );

    console.error(error);

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
