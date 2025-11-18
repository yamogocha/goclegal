import { client } from "@/sanity/client"
import { groq } from "next-sanity"
import FAQsComponent, { FAQsPage } from "../components/faqs"
import Navigation from "../navigation/page"
import Contact from "../contact/page"
import Footer from "../footer/page"
import Script from "next/script"
import { buildPageMetadata, faqSchema } from "../util/schema"


const FAQS_QUERY = groq`*[_type == "page" && slug.current == "faqs"][0]{headline, subHeadline, "image": image.asset->url, body, buttonText, phoneNumber}`

export function generateMetadata() {
    return buildPageMetadata({
        title: "FAQS | GOC Legal",
        description: "Answers to common personal injury questions. Learn what to expect after an accident, how claims work, and how GOC Legal can help you.",
        path: "faqs"
    })
}

export default async function FAQs() {
    const faqsPage = await client.fetch<FAQsPage>(FAQS_QUERY)

    return (
        <div className="relative min-h-screen">
            <Script id="faq-schema" type="application/ld+json">
                {JSON.stringify(faqSchema)}
            </Script>
            <Navigation />
            <FAQsComponent {...faqsPage} />
            <Contact />
            <Footer />
        </div>
    )
}