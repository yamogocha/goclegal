"use client"
import Slider from "./slider"
import { SwiperSlide } from "swiper/react"
import Image from "next/image"
import MotionWrapper from "./motionWraper"
import { Motions } from "./welcome"
import { urlFor } from "../util"

type Slide = {
    image: Record<string, string>
    paragraph: string
    label: string
}
export type TestimonialsPage = {
    headline: string
    slug: string
    subHeadline: string
    strip: string
    slides: Slide[]
}

export default function TestimonialsComponent(testimonialsPage: TestimonialsPage) {
    
    const {headline, slug, subHeadline, strip, slides: testimonialsSlides} = testimonialsPage

    const slides = testimonialsSlides.map(({image, paragraph, label}, index) => (
        <SwiperSlide key={index}>
            <div className="bg-white mb-14 p-10 flex flex-col justify-between">
                <div className="flex justify-center pb-6">
                    <Image src={urlFor(image).url()} alt="Slider icon" width={25} height={25}/>
                </div>
                <MotionWrapper type={Motions.FADEUP}>
                    <p className="font-montserrat text-[16px] lg:text-[18px] h-[250px] lg:h-[300]">{paragraph}</p>
                    <div className="font-montserrat text-[22px] leading-tight lg:leading-normal pt-6 border-t-2 border-[#e3dfd6]">{label}</div>
                </MotionWrapper>
            </div>
        </SwiperSlide>
    ))


    return (
        <div id={slug} className="scroll-mt-20 w-full h-full bg-[#e3dfd6] px-5 py-10 lg:pt-[80] lg:pb-[100px]">
            <MotionWrapper><div className="max-w-[1200px] m-auto text-center">
                <h2 className="text-[36px] lg:text-[48px] leading-tight lg:leading-normal font-bold pb-2">{headline}</h2>
                <p className="font-montserrat text-[18px] lg:text-[24px] pb-6 lg:pb-18">{subHeadline}</p>
                <Slider {...{ slides }} />
                <p className="font-montserrat lg:w-2/3 m-auto text-[16px] lg:text-[18px] pt-6">{strip}</p>
            </div></MotionWrapper>
        </div>
    )
}