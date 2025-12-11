import { client } from "@/sanity/client";
import { groq } from "next-sanity";
import Navigation from "../navigation/page";
import Contact from "../contact/page";
import CaseResultComponent, { CaseResultPage, CaseResultsSlider } from "../components/caseResults";
import Footer from "../footer/page";
import { buildPageMetadata, caseResultsSchema } from "../util/schema";
import Script from "next/script";

const CASE_RESULTS_PAGE = groq`*[_type == "page" && slug.current == "case-results"][0]{headline, subHeadline, "image": image.asset->url, body, buttonText, phoneNumber}`
const CASE_RESULTS_SLIDER = groq`*[_type == "slider" && slug.current == "case-results"][0]{headline, subHeadline, slides}`

export async function generateMetadata() {
    const pageParams = await client.fetch(`*[_type == "page" && slug.current == "case-results"][0]{title, description, "image": image.asset->url, "slug": slug.current}`)
    return buildPageMetadata(pageParams)
}

export default async function CaseResults() {
    const caseResultsPage = await client.fetch<CaseResultPage>(CASE_RESULTS_PAGE)
    const caseResultsSlider = await client.fetch<CaseResultsSlider>(CASE_RESULTS_SLIDER)

    return (
        <div className="relative min-h-screen">
            <Script id="faq-schema" type="application/ld+json">
                {JSON.stringify(caseResultsSchema)}
            </Script>
            <Navigation />
            <CaseResultComponent {...{ caseResultsPage, caseResultsSlider }} />
            <Contact />
            <Footer />
        </div>
    )
}