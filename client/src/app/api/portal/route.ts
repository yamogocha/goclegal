import { auth } from "@/lib/oauth";
import { NextRequest, NextResponse } from "next/server";
import { groq } from "next-sanity";
import { client } from "@/sanity/client";
import { sendSms } from "@/lib/communication";
import { serverClient } from "@/sanity/serverClient";
import crypto from "crypto";

// Search and load clients.
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const query = req.nextUrl.searchParams.get("q") || "";
  const recent = req.nextUrl.searchParams.get("recent");

  if (recent === "true") {
    const clients = await client.fetch(groq`*[_type == "clientType"] | order(_createdAt desc)[0...10]{_id,clientId,clientName,clientPhone}`);
    return NextResponse.json(clients.map((c: any) => ({ clientId: c.clientId || c._id, clientName: c.clientName, clientPhone: c.clientPhone })));
  }

  if (!query.trim()) return NextResponse.json([]);

  const clients = await client.fetch(
    groq`*[_type == "clientType" && (clientName match $search || clientPhone match $search)]{_id,clientId,clientName,clientPhone} | order(clientName asc)[0...20]`,
    { search: `${query}*` }
  );

  return NextResponse.json(clients.map((c: any) => ({ clientId: c.clientId || c._id, clientName: c.clientName, clientPhone: c.clientPhone })));
}

// Create client, record consent, and send intake link.
export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { clientName, clientPhone, smsConsent } = await req.json();
    const normalizedClientName = clientName?.trim().toUpperCase();
    const normalizedClientPhone = clientPhone?.trim();


    if (!normalizedClientName || !normalizedClientPhone) {
      return NextResponse.json({ error: "Client name and phone are required" }, { status: 400 });
    }

    if (!smsConsent?.consented) {
      return NextResponse.json({ error: "SMS consent must be recorded before sending the intake link" }, { status: 400 });
    }

    if (!smsConsent.consentText?.trim()) {
      return NextResponse.json({ error: "Consent language is required" }, { status: 400 });
    }

    const existingClient = await serverClient.fetch(
      groq`*[_type == "clientType" && clientPhone == $clientPhone][0]{_id,clientName}`,
      { clientPhone: normalizedClientPhone }
    );

    if (existingClient) {
      return NextResponse.json({ error: "A client with this phone number already exists" }, { status: 409 });
    }

    const clientId = crypto.randomUUID();
    const clientAccessToken = crypto.randomBytes(32).toString("hex");
    const now = new Date().toISOString();
    const baseUrl = process.env.BASE_URL;

    if (!baseUrl) return NextResponse.json({ error: "BASE_URL is not configured" }, { status: 500 });

    const consentedAt = smsConsent.consentedAt || now;
    const collectedBy = smsConsent.collectedBy || session.user?.email || session.user?.name || "GOC Legal Staff";
    const signupUrl = `${baseUrl}/portal/${encodeURIComponent(clientId)}/signUp?token=${encodeURIComponent(clientAccessToken)}`;
    const message = `Hi ${normalizedClientName}, GOC Legal needs some information from you to help with your case. Please complete your secure client intake form here: ${signupUrl}`;

    const doc = await serverClient.create({
      _id: clientId,
      _type: "clientType",
      clientId,
      clientAccessToken,
      clientName: normalizedClientName,
      clientPhone: normalizedClientPhone,
      intakeStatus: "link_sent",
      communicationPreferences: {
        smsEnabled: true,
        emailEnabled: true,
        preferredMethod: "sms",
      },
      smsConsent: {
        consented: true,
        consentedAt,
        method: smsConsent.method || "phone",
        source: smsConsent.source || "attorney_phone_call",
        collectedBy,
        consentText: smsConsent.consentText.trim(),
      },
      createdAt: now,
      updatedAt: now,
    });

    const sms = await sendSms(normalizedClientPhone, message);

    await serverClient.patch(doc._id).set({
      lastCommunicationAt: now,
      lastOutboundMessageAt: now,
      communications: [{
        _key: crypto.randomUUID(),
        direction: "outbound",
        channel: "sms",
        type: "intake_link",
        message,
        status: "sent",
        providerMessageId: sms.sid,
        sentAt: now,
      }],
      updatedAt: new Date().toISOString(),
    }).commit();

    return NextResponse.json({
      success: true,
      clientId,
      signupUrl,
      smsConsent: {
        consented: true,
        consentedAt,
        method: smsConsent.method || "phone",
        source: smsConsent.source || "attorney_phone_call",
        collectedBy,
      },
    });
  } catch (error) {
    console.error("CREATE CLIENT ERROR", error);
    return NextResponse.json({ error: "Unable to create client" }, { status: 500 });
  }
}