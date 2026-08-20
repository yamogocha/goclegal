import twilio from "twilio";

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

export async function sendSms(to: string, body: string) {
    if (!process.env.TWILIO_PHONE_NUMBER) throw new Error("TWILIO_PHONE_NUMBER is not configured");
    return client.messages.create({ body, from: process.env.TWILIO_PHONE_NUMBER, to });
}