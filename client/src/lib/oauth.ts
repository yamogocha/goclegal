import { OAuth2Client } from "google-auth-library";
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { NextResponse } from "next/server";
import { client } from "@/sanity/client";
import { groq } from "next-sanity";

export const oauth2Client = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID!,
  process.env.GOOGLE_CLIENT_SECRET!,
  process.env.GOOGLE_API_REDIRECT_URI!
);

export function getAuthUrl() {
  return oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: [
      "https://www.googleapis.com/auth/adwords",
      "https://www.googleapis.com/auth/youtube.upload",
      "https://www.googleapis.com/auth/business.manage",
    ],
  });
}

export async function getGoogleAccessToken() {
  oauth2Client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN! });
  const { token } = await oauth2Client.getAccessToken();
  return token;
}

export function verifyCronAuth(req: Request) {
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${process.env.CRON_SECRET}` ? null : new Response("Unauthorized", { status: 401 });
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Google({
    clientId: process.env.GOOGLE_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
  })],
  callbacks: {
    async signIn({ profile }) {
      const allowedEmails = ["greg@goclegal.com", "angel@goclegal.com", "angeltamyamen@gmail.com", "oconnell.gregory@gmail.com"];
      return allowedEmails.includes(profile?.email || "");
    },
  },
});

export default auth((req) => {
  if (!req.auth) return NextResponse.redirect(new URL(`/api/auth/signin?callbackUrl=${encodeURIComponent(req.url)}`, req.url));
});

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};

export type ClientAccess = {
  clientId: string;
  clientName: string;
  clientAccessToken: string;
  mode: "admin" | "client";
};

// Admin session wins; otherwise require the exact client access token.
export async function getClientAccess(clientId: string, token?: string): Promise<ClientAccess | null> {
  const record = await client.fetch(
    groq`*[_type=="clientType" && (_id==$clientId || clientId==$clientId)][0]{_id,clientId,clientName,clientAccessToken}`,
    { clientId },
    { cache: "no-store" }
  );
  if (!record) return null;
  const session = await auth();
  if (session) return {
    clientId: record._id,
    clientName: record.clientName,
    clientAccessToken: record.clientAccessToken,
    mode: "admin",
  };
  if (token && record.clientAccessToken && token === record.clientAccessToken) return {
    clientId: record._id,
    clientName: record.clientName,
    clientAccessToken: record.clientAccessToken,
    mode: "client",
  };
  return null;
}