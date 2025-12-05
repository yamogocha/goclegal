import { client } from "@/sanity/client"
import { groq } from "next-sanity"
import FAQsComponent, { FAQsPage } from "../components/faqs"
import Navigation from "../navigation/page"
import Contact from "../contact/page"
import Footer from "../footer/page"
import Script from "next/script"
import { buildPageMetadata, faqSchema } from "../util/schema"

type Params = {
    params: Promise<{
        slug: string
    }>
}

export async function generateStaticParams() {
    const slugs = await client.fetch(`*[_type=="post"].slug.current`);
    return slugs.map((slug: string) => ({ slug }));
}

const FAQS_QUERY = groq`*[_type == "page" && slug.current == "faqs"][0]{headline, subHeadline, "image": image.asset->url, body, buttonText, phoneNumber}`

export async function generateMetadata({ params }: Params) {
    const { slug } = await params
    return buildPageMetadata(slug)
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