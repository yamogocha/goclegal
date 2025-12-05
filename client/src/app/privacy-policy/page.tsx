import { client } from "@/sanity/client";
import { groq } from "next-sanity";
import PrivacyPolicyComponent, { PrivacyPolicyPage } from "../components/privacyPolicy";
import Navigation from "../navigation/page";
import Footer from "../footer/page";
import { buildPageMetadata } from "../util/schema";

type Params = {
    params: Promise<{
        slug: string
    }>
}

export async function generateStaticParams() {
    const slugs = await client.fetch(`*[_type=="post"].slug.current`);
    return slugs.map((slug: string) => ({ slug }));
}

const PRIVACY_POLICY_QUERY = groq`*[_type == "page" && slug.current == "privacy-policy"][0]{headline, "image": image.asset->url, body}`

export async function generateMetadata({ params }: Params) {
    const { slug } = await params
    return buildPageMetadata(slug)
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