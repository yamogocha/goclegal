import { type SanityDocument } from "next-sanity";
import { client } from "@/sanity/client";
// import Link from "next/link";
import Welcome from "./components/welcome";

const WELCOME_PAGE_QUERY = `*[_type == "page" && slug.current == "welcome"]
{ description, "imageUrl": mainImage.asset->url, "imageAlt": mainImage.alt, h1, h2, paragraph, btnText, btnNumber }`;

const options = { next: { revalidate: 30 } };

export default async function Home() {
  const welcomePage = await client.fetch<SanityDocument[]>(WELCOME_PAGE_QUERY, {}, options);

  const handleGADSClick = () => {
    if (typeof window !== "undefined" && window.gtag) {
      window.gtag("event", "conversion", {
        send_to: "AW-17444498530/h7lsCID3woYbEOLYl_5A",
      });
      console.log("Google conversion event sent ✅");
    } else {
      console.warn("gtag not available yet");
    }
  };

  return (
    <>
      <Welcome { ...{ welcomePage } }/>
    </>
  );
}