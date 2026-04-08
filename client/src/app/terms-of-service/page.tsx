import { client } from "@/sanity/client";
import { groq } from "next-sanity";
import TermsOfServiceComponent, { TermsOfServicePage } from "../components/termsOfService";
import Navigation from "../navigation/page";
import Footer from "../footer/page";
import { buildPageMetadata } from "@/lib/schema";

const TERMS_OF_SERVICE_QUERY = groq`*[_type == "page" && slug.current == "terms-of-service"][0]{headline, "image": image.asset->url, body}`

export async function generateMetadata() {
    const pageParams = await client.fetch(`*[_type == "page" && slug.current == "terms-of-service"][0]{title, description, "image": image.asset->url, "slug": slug.current}`)
    return buildPageMetadata(pageParams)
}

export default async function TermsOfService() {
    const TermsOfServicePage = await client.fetch<TermsOfServicePage>(TERMS_OF_SERVICE_QUERY)

   return (
    <div className="relative min-h-screen">
        <Navigation />
        <TermsOfServiceComponent {...TermsOfServicePage} />
        <Footer />
    </div>
    )
}