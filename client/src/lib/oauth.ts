import "server-only";

import { OAuth2Client } from "google-auth-library";

export const oauth2Client = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID!,
  process.env.GOOGLE_CLIENT_SECRET!,
  process.env.GOOGLE_REDIRECT_URI! // e.g. http://localhost:3000/api/oauth/callback
);

export function getAuthUrl() {
  return oauth2Client.generateAuthUrl({
    access_type: "offline", // REQUIRED for refresh token
    prompt: "consent",      // FORCE refresh token
    scope: [
      "https://www.googleapis.com/auth/adwords",
      "https://www.googleapis.com/auth/youtube.upload",
      "https://www.googleapis.com/auth/business.manage",
    ],
  });
}

export async function getGoogleAccessToken() {
    oauth2Client.setCredentials({
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN!,
    });
  
    const { token } = await oauth2Client.getAccessToken();
  
    return token;
  }


  export function verifyCronAuth(req: Request) {
    const auth = req.headers.get("authorization");
  
    if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
      return new Response("Unauthorized", { status: 401 });
    }
  
    return;
  }