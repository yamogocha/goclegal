import { client } from "@/sanity/client";
import { groq } from "next-sanity";
import Navigation from "../navigation/page";
import Footer from "../footer/page";
import { buildPageMetadata } from "@/lib/schema";
import SmsMessagingProgramComponent, { SmsMessagingProgramPage } from "../components/smsMessagingProgram";

const SMS_MESSAGING_PROGRAM_QUERY = groq`*[_type == "page" && slug.current == "sms-messaging-program"][0]{headline, "image": image.asset->url, body, "photo": photo.asset->url}`;

export async function generateMetadata() {
  const pageParams = await client.fetch(`*[_type == "page" && slug.current == "sms-messaging-program"][0]{title, description, "image": image.asset->url, "slug": slug.current}`);
  return buildPageMetadata(pageParams);
}

export default async function SmsMessagingProgram() {
  const smsMessagingProgramPage = await client.fetch<SmsMessagingProgramPage>(SMS_MESSAGING_PROGRAM_QUERY);
  return (
    <div className="relative min-h-screen">
      <Navigation />
      <SmsMessagingProgramComponent {...smsMessagingProgramPage} />
      <Footer />
    </div>
  );
}
