import { oauth2Client } from "@/lib/oauth";

export const runtime = "nodejs";
export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get("code");
  
    if (!code) {
      return Response.json({ error: "Missing code" }, { status: 400 });
    }
  
    const { tokens } = await oauth2Client.getToken(code);
  
    console.log("ACCESS TOKEN:", tokens.access_token);
    console.log("REFRESH TOKEN:", tokens.refresh_token); // 🔥 THIS is what you need
  
    return Response.json(tokens);
  }