import { client } from "@/sanity/client";
import { groq } from "next-sanity";
import Navigation from "../navigation/page";
import Contact from "../contact/page";
import CaseResultComponent, { CaseResultPage, CaseResultsSlider } from "../components/caseResults";
import Footer from "../footer/page";

const CASE_RESULTS_PAGE = groq`*[_type == "page" && slug.current == "case-results"][0]{headline, subHeadline, "image": image.asset->url, body, buttonText, phoneNumber}`
const CASE_RESULTS_SLIDER = groq`*[_type == "slider" && slug.current == "case-results"][0]{headline, subHeadline, slides}`


export default async function CaseResults() {
    const caseResultsPage = await client.fetch<CaseResultPage>(CASE_RESULTS_PAGE)
    const caseResultsSlider = await client.fetch<CaseResultsSlider>(CASE_RESULTS_SLIDER)

    return (
        <div className="relative min-h-screen">
            <Navigation />
            <CaseResultComponent {...{ caseResultsPage, caseResultsSlider }} />
            <Contact />
            <Footer />
        </div>
    )
}