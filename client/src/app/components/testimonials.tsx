import { client } from "@/sanity/client"
import { groq } from "next-sanity"
import Slider from "./slider"

const TESTIMONIALS_PAGE_QUERY = groq`*[_type == "slider" && slug.current == "testimonials"][0]{title, description, slides}`

export type Slide = {
    image: Record<string, string>
    paragraph: string
    label: string
}
type TestimonialsPage = {
    title: string
    description: string
    slides: Slide[]
}

export default async function Testimonials() {
    const testimonialsPage = await client.fetch<TestimonialsPage>(TESTIMONIALS_PAGE_QUERY)
    const {title, description, slides} = testimonialsPage


    return (
        <div className="w-full h-full bg-[#e3dfd6] px-5 py-[20px] lg:py-[150px]">
            <div className="max-w-[1200px] m-auto text-center">
                <h2 className="text-[36px] lg:text-[48px] leading-tight lg:leading-normal font-bold">{title}</h2>
                <p className="font-montserrat text-[18px] lg:text-[24px] pb-6 lg:pb-12">{description}</p>
                <Slider {...{slides}} />
            </div>
        </div>
    )
}