"use client"
import { PortableTextBlock } from "next-sanity"
import Image from "next/image"
import { useState } from "react"
import PortableTextComponent from "./portableText"
import MotionWrapper from "./motionWraper"
import AnimatedCTA from "./animatedCTA"


export type AboutPage = {
    headline: string,
    subHeadline: string,
    image: string,
    photo: string
    body: PortableTextBlock[]
    buttonText: string
    phoneNumber: string
}
export default function AboutComponent(aboutPage: AboutPage) {
    const {headline, subHeadline, image, photo, body, buttonText, phoneNumber} = aboutPage
    const [readMore, setReadMore] = useState(false)
    const lessContent = body.slice(0, 8)

    const toggleReadMore = () => {
        setReadMore(!readMore)
        if (readMore) {
            const element = document.getElementById("greg-photo")
            element?.scrollIntoView({ behavior: "auto" })
        }
    }

    return (
        <div className="bg-[#00305bcf] w-full h-full">
            <div className="relative w-full h-[300px] lg:h-[400px]">
                <Image id="greg-photo" src={image} alt="About page background image" fill className="object-cover -z-5" />
                <MotionWrapper className="relative w-full lg:w-2/3 m-auto h-[300px] lg:h-[400px] px-5 flex flex-col justify-center item-center text-center text-white">
                    <h1 className='text-[36px] lg:text-[48px] leading-tight lg:leading-normal font-bold pb-6'>{headline}</h1>
                    <p className="font-montserrat font-medium text-[18px] lg:text-[22px]">{subHeadline}</p>
                </MotionWrapper>
            </div>
            <div className="bg-white px-5 pt-10 lg:py-[80px]">
                <div className="max-w-[1200px] m-auto flex flex-col lg:flex-row justify-between items-start">
                    <Image src={photo} alt="Gregory OConnel attorney photo" width={300} height={300} className="w-full lg:w-[48%] object-contain"/>
                    <div className="w-full lg:w-[48%] pt-6 lg:pt-0">
                        {readMore ? <PortableTextComponent {...{ body }} /> : <PortableTextComponent {...{ body: lessContent }} />}
                        <AnimatedCTA {...{ buttonText, phoneNumber}} />
                        <div className="flex items-center space-x-2 cursor-pointer" onClick={toggleReadMore}>
                            <span className="w-full border border-t border-[#32323240]"/>
                            <span className="text-[#00305b] hover:text-[#0f4c85] text-[18px] lg:text-[20px] font-bold whitespace-nowrap">{readMore ?  "Read Less" : "Read More"}</span>
                            <span className="w-full border border-t border-[#32323240]"/>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}