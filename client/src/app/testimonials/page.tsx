import { client } from "@/sanity/client"
import { groq } from "next-sanity"
import TestimonialsComponent, { TestimonialsPage } from "../components/testimonials"

const TESTIMONIALS_PAGE_QUERY = groq`*[_type == "slider" && slug.current == "testimonials"][0]{title, "slug": slug.current, description, slides}`



export default async function Testimonials() {
    const testimonialsPage = await client.fetch<TestimonialsPage>(TESTIMONIALS_PAGE_QUERY)

    return <TestimonialsComponent {...testimonialsPage}/>

}