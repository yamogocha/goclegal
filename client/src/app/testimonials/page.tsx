import { client } from "@/sanity/client"
import { groq } from "next-sanity"
import TestimonialsComponent, { TestimonialsPage } from "../components/testimonials"
import Script from "next/script"
import { testimonialSchema } from "@/lib/schema"

const TESTIMONIALS_PAGE_QUERY = groq`*[_type == "slider" && slug.current == "testimonials"][0]{headline, "slug": slug.current, subHeadline, strip, slides}`



export default async function Testimonials() {
    const testimonialsPage = await client.fetch<TestimonialsPage>(TESTIMONIALS_PAGE_QUERY)

    return (
        <>
        <Script id="testimonial-schema" type="application/ld+json">
            {JSON.stringify(testimonialSchema)}
        </Script>
        <TestimonialsComponent {...testimonialsPage}/>
        </>
        
    )

}