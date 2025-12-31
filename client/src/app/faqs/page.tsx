import { client } from "@/sanity/client"
import { groq } from "next-sanity"
import FAQsComponent, { FAQsPage } from "../components/faqs"
import Navigation from "../navigation/page"
import Contact from "../contact/page"
import Footer from "../footer/page"
import Script from "next/script"
import { buildPageMetadata, faqSchema } from "@/lib/schema"

const FAQS_QUERY = groq`*[_type == "page" && slug.current == "faqs"][0]{headline, subHeadline, "image": image.asset->url, body, buttonText, phoneNumber}`

export async function generateMetadata() {
    const pageParams = await client.fetch(`*[_type == "page" && slug.current == "faqs"][0]{title, description, "image": image.asset->url, "slug": slug.current}`)
    return buildPageMetadata(pageParams)
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