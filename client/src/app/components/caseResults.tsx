"use client"
import { PortableTextBlock } from "next-sanity"
import Image from "next/image"
import PortableTextComponent from "./portableText"
import { CardSwiper } from "./slider"
import { SwiperSlide } from "swiper/react"
import AnimatedCTA from "./animatedCTA"
import MotionWrapper from "./motionWraper"


export type CaseResultPage = {
    headline: string
    image: string
    body: PortableTextBlock[]
    buttonText: string
    phoneNumber: string
}
type Slide = {
    label: string
    paragraph: string
}
export type CaseResultsSlider = {
    headline: string
    subHeadline: string
    slides: Slide[]
}
type Combined = {
    caseResultsPage: CaseResultPage, 
    caseResultsSlider: CaseResultsSlider
}

export default function CaseResultComponent({ caseResultsPage, caseResultsSlider }: Combined) {
    const { headline: pageHeadline, image, body, buttonText, phoneNumber } = caseResultsPage
    const { headline, subHeadline, slides } = caseResultsSlider
    const topContent = body.slice(0, 2)
    const bottomContent = body.slice(2) 
    
    const cards = slides.map(({label, paragraph}, index) => (
        <SwiperSlide key={index} className="mt-6 mb-20 lg:mb-14">
            <div className="bg-white border border-[#00305b] rounded lg:w-[85%] m-auto h-[450px] lg:h-[300px] p-10 flex flex-col items-center justify-center">
                <div className="text-[#00305b] font-montserrat font-medium leading-tight lg:leading-normal text-center text-[22px] pb-6">{label}</div>
                <p className="text-[#00305b] font-montserrat text-[16px] lg:text-[18px] text-center">{paragraph}</p>
            </div>
        </SwiperSlide>
    ))


    return (
        <div className="bg-[#00305bcf] w-full h-full">
            <div className="relative w-full h-[200px] lg:h-[400px]">
                <Image src={image} alt="Case Results page background image" fill className="object-cover -z-5" />
                <MotionWrapper className="max-w-[1200px] m-auto w-full h-[200px] lg:h-[400px] px-5 text-white text-center flex justify-center items-center">
                    <h1 className="font-bold text-[36px] lg:text-[48px] leading-tight lg:leading-normal pb-6">{pageHeadline}</h1>
                </MotionWrapper>
            </div>
            <div className="bg-white px-5 py-10 lg:py-[80px]">
                <div className="max-w-[1200px] m-auto">
                    <PortableTextComponent {...{ body: topContent }}/>
                    <div className="py-6 lg:py-20">
                        <div className="w-full lg:w-3/4 m-auto font-bold leading-tight lg:leading-normal text-[#00305b] text-[24px] lg:text-[30px] text-center pb-6 lg:pb-12">{headline}</div>
                        <div className="font-montserrat font-medium text-[#00305b] text-[22px] lg:text-[24px] text-center">{subHeadline}</div>
                        <CardSwiper {...{ cards }} />
                    </div>
                    <PortableTextComponent {...{ body: bottomContent }}/>
                    <AnimatedCTA {...{ buttonText, phoneNumber }} />
                </div>
            </div>
        </div>
    )

}