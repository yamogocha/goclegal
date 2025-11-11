import { client } from "@/sanity/client"
import { groq } from "next-sanity"
import FAQsComponent, { FAQsPage } from "../components/faqs"
import Navigation from "../navigation/page"
import Contact from "../contact/page"


const FAQS_QUERY = groq`*[_type == "page" && slug.current == "faqs"][0]{headline, subHeadline, "image": image.asset->url, body, buttonText, phoneNumber}`

export default async function FAQs() {
    const faqsPage = await client.fetch<FAQsPage>(FAQS_QUERY)

    return (
        <div className="relative min-h-screen">
            <Navigation />
            <FAQsComponent {...faqsPage} />
            <Contact />
        </div>
    )
}