import { groq } from "next-sanity";
import crypto from "crypto";
import { sendSms } from "@/lib/communication";
import { serverClient } from "@/sanity/serverClient";

const REQUIRED_SIGNUP_FIELDS = ["clientDob", "clientEmail", "clientSsnLast4", "clientVehicle", "clientAutoInsurance", "clientPolicyNumber", "clientClaimNumber", "clientHealthInsurance", "clientHealthInsuranceMemberNumber", "injuries", "medicalCare", "medicalProvider", "healthInsuranceCards", "collisionLocation", "collisionDate", "defendantVehicle"];

const isFilled = (value: any) => Array.isArray(value) ? value.length > 0 : value !== undefined && value !== null && String(value).trim() !== "";
const signUpComplete = (client: any) => REQUIRED_SIGNUP_FIELDS.every(field => isFilled(client[field]));
const interrogatoriesComplete = (interrogatory: any) => !!interrogatory?.interrogatories?.length && interrogatory.interrogatories.every((q: any) => isFilled(q.plaintiffClientResponse));
const latestCommunication = (communications: any[] = [], types: string[]) => communications.filter(c => c.direction === "outbound" && c.channel === "sms" && types.includes(c.type) && c.status === "sent").sort((a, b) => new Date(b.sentAt || 0).getTime() - new Date(a.sentAt || 0).getTime())[0];

async function main() {
    const clients = await serverClient.fetch(groq`*[_type == "clientType" && defined(clientPhone) && smsConsent.consented == true && communicationPreferences.smsEnabled != false]{
        _id, clientId, clientName, clientPhone, clientAccessToken,
        clientDob, clientEmail, clientSsnLast4, clientVehicle, clientAutoInsurance, clientPolicyNumber, clientClaimNumber,
        clientHealthInsurance, clientHealthInsuranceMemberNumber, injuries, medicalCare, medicalProvider, healthInsuranceCards,
        collisionLocation, collisionDate, defendantVehicle, communications,
        "interrogatory": *[_type == "interrogatory" && client._ref == ^._id][0]{ _id, status, interrogatoryType, interrogatories[]{ plaintiffClientResponse } }
    }`);

    const now = new Date();
    const sevenDaysAgo = now.getTime() - 7 * 24 * 60 * 60 * 1000;
    const results = { scanned: clients.length, sent: 0, skipped: 0, failed: 0 };

    for (const client of clients) {
        const initial = latestCommunication(client.communications, ["signUp_link", "interrogatories_link"]);
        if (!initial) { results.skipped++; continue; }

        const isSignUp = initial.type === "signUp_link";
        const complete = isSignUp ? signUpComplete(client) : interrogatoriesComplete(client.interrogatory);
        if (complete) { results.skipped++; continue; }

        const reminderType = isSignUp ? "signUp_reminder" : "interrogatories_reminder";
        const lastReminder = latestCommunication(client.communications, [reminderType]);
        if (lastReminder && new Date(lastReminder.sentAt).getTime() > sevenDaysAgo) { results.skipped++; continue; }

        const baseUrl = process.env.BASE_URL;
        if (!baseUrl) throw new Error("BASE_URL is not configured");

        const url = isSignUp
            ? `${baseUrl}/signUp/${encodeURIComponent(client.clientPortalCode)}`
            : `${baseUrl}/interrogatories/${encodeURIComponent(client.clientPortalCode)}`;

        const message = isSignUp
            ? `Hi ${client.clientName || "there"}, this is GOC Legal. We’re still waiting for your client signUp form. Please complete it through our secure portal: ${url}`
            : `Hi ${client.clientName || "there"}, this is GOC Legal. We’re still waiting for your interrogatories. Please complete them through our secure portal: ${url}`;

        try {
            const sms = await sendSms(client.clientPhone, message);
            await serverClient.patch(client._id).set({
                lastCommunicationAt: now.toISOString(),
                lastOutboundMessageAt: now.toISOString(),
                communications: [
                    ...(client.communications || []),
                    {
                        _key: crypto.randomUUID(),
                        direction: "outbound",
                        channel: "sms",
                        type: reminderType,
                        message,
                        status: "sent",
                        providerMessageId: sms.sid,
                        sentAt: now.toISOString(),
                    },
                ],
                updatedAt: now.toISOString(),
            }).commit();
            results.sent++;
            console.log(`✅ ${reminderType}: ${client.clientName || client.clientId}`);
        } catch (error) {
            results.failed++;
            console.error(`❌ ${reminderType}: ${client.clientName || client.clientId}`, error);
        }
    }

    console.log("Client reminder results:", results);
}

main().catch(error => {
    console.error("❌ CLIENT REMINDER JOB FAILED", error);
    process.exit(1);
});