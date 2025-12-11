import { client } from "@/sanity/client";
import { groq } from "next-sanity";
import PrivacyPolicyComponent, { PrivacyPolicyPage } from "../components/privacyPolicy";
import Navigation from "../navigation/page";
import Footer from "../footer/page";
import { buildPageMetadata } from "../util/schema";

const PRIVACY_POLICY_QUERY = groq`*[_type == "page" && slug.current == "privacy-policy"][0]{headline, "image": image.asset->url, body}`

export async function generateMetadata() {
    const pageParams = await client.fetch(`*[_type == "page" && slug.current == "privacy-policy"][0]{title, description, "image": image.asset->url, "slug": slug.current}`)
    return buildPageMetadata(pageParams)
}

export default async function PrivacyPolicy() {
    const privacyPolicyPage = await client.fetch<PrivacyPolicyPage>(PRIVACY_POLICY_QUERY)

   return (
    <div className="relative min-h-screen">
        <Navigation />
        <PrivacyPolicyComponent {...privacyPolicyPage} />
        <Footer />
    </div>
    )
}