// api route (single execution)
import { getErrorMessage } from "@/lib/error";
import {
  runCoreOptimization,
} from "@/lib/googleAds/optimize";

import { verifyCronAuth } from "@/lib/oauth";

export const runtime = "nodejs";

export async function POST(
  req: Request
): Promise<Response> {
  const unauthorized = verifyCronAuth(req);

  if (unauthorized) {
    return unauthorized;
  }

  const { searchParams } = new URL(req.url);

  const dryRun =
    searchParams.get("dryRun") === "true";

  try {
    const result =
      await runCoreOptimization({
        dryRun,
      });

    const failed =
      !result.ok ||
      (result.errors?.length ?? 0) > 0;

    if (failed) {
      console.error(
        "[GOOGLE ADS OPTIMIZE FAILED]",
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
      "[GOOGLE ADS OPTIMIZE ROUTE ERROR]"
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