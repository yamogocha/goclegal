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
    title: string
    description: string
    slides: Slide[]
}

export default function TestimonialsComponent(testimonialsPage: TestimonialsPage) {
    
    const {title, description, slides} = testimonialsPage

    const children = slides.map(({image, paragraph, label}, index) => (
        <SwiperSlide key={index}>
            <div className="bg-white p-10 h-[410px] lg:h-[480px]">
                <div className="flex justify-center pb-5">
                    <Image src={urlFor(image).url()} alt="Slider icon" width={25} height={25}/>
                </div>
                <MotionWrapper type={Motions.FADEUP}>
                    <p className="font-montserrat text-[16px] lg:text-[18px] h-[250px] lg:h-[320px]">{paragraph}</p>
                    <div className="font-montserrat text-[22px] pt-5 border-t-2 border-[#e3dfd6]">{label}</div>
                </MotionWrapper>
            </div>
        </SwiperSlide>
    ))


    return (
        <div className="w-full h-full lg:h-screen bg-[#e3dfd6] px-5 py-[20px] lg:py-[120px]">
            <div className="max-w-[1200px] m-auto text-center">
                <h2 className="text-[36px] lg:text-[48px] leading-tight lg:leading-normal font-bold">{title}</h2>
                <p className="font-montserrat text-[18px] lg:text-[24px] pb-6 lg:pb-12">{description}</p>
                <Slider {...{ children }} />
            </div>
        </div>
    )
}