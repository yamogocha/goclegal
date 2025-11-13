"use client"
import { PortableTextBlock } from "next-sanity"
import Image from "next/image"
import MotionWrapper from "./motionWraper"
import PortableTextComponent from "./portableText"
import AnimatedCTA from "./animatedCTA"


export type FAQsPage = {
    headline: string
    subHeadline: string
    image: string
    buttonText: string
    phoneNumber: string
    body: PortableTextBlock[]
}
export default function FAQsComponent(faqsPage: FAQsPage) {
    const { headline, subHeadline, image, body, buttonText, phoneNumber} = faqsPage
    const leftColumn = body.slice(0, 71)
    const rightColumn = body.slice(71)
    

    return(
        <div className="bg-[#00305bcf] w-full h-full">
            <div className="relative w-full h-[200px] lg:h-[400px]"><Image src={image} alt="FAQs page background image" fill className="object-cover -z-5" />
                <MotionWrapper className="w-full lg:w-2/3 m-auto h-[200px] lg:h-[400px] px-5 text-center text-white flex flex-col justify-center">
                    <h1 className='text-[36px] lg:text-[48px] leading-tight lg:leading-normal font-bold pb-6'>{headline}</h1>
                    <p className="font-montserrat font-medium text-[18px] lg:text-[22px]">{subHeadline}</p>
                </MotionWrapper>
            </div>
            <div className="bg-white px-5 py-10 lg:py-[80px]">
                <div className="max-w-[1200px] m-auto flex flex-wrap justify-between">
                    <div className="w-full lg:w-[46%]">
                        <PortableTextComponent {...{ body: leftColumn }} />
                    </div>
                    <div className="w-full lg:w-[46%]">
                        <PortableTextComponent {...{ body: rightColumn }} />
                        <AnimatedCTA {...{ buttonText, phoneNumber }} />
                    </div>
                </div>
            </div>
        </div>
    )
}