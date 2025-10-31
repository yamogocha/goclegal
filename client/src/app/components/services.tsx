"use client"
import Image from "next/image";
import { urlFor } from "../util";
import Link from "next/link";
import { useState } from "react";
import RightArrow from "./arrowRight";
import MotionWrapper from "./motionWraper";
import { Motions } from "./welcome";

type Slide = {
    paragraph?: string
    image?: Record<string, string>
    backgroundColor?: string
    label?: string
    slug?: string
}
export type ServicesPage = {
    title: string
    slides: Slide[]
}

export default function Component({ title, slides }: ServicesPage) {
    const [index, setIndex] = useState<number>(4)
    const [servie, setService] = useState<Slide[]>(slides.slice(0, 4))
    const [animate, setAnimate] = useState<number>(0)

    const swapServices = (size = 4) => {
        setIndex((prev) => (prev + size) % slides.length)
        setService(slides.slice(index, index + size))
        setAnimate((prev) => prev + 1)
    }

    return (
        <div className="w-full h-full lg:h-screen bg-[#323232] px-5 py-[20px] lg:py-[80px]">
            <div className="max-w-[1200px] m-auto flex flex-col lg:flex-row">
                <h2 className="w-full text-[#e3dfd6] text-[36px] lg:text-[48px] leading-tight lg:leading-normal font-bold text-center lg:text-left pb-6 lg:pb-0"><MotionWrapper>{title}</MotionWrapper></h2>
                <div className="relative flex flex-wrap gap-10 justify-end">
                    {servie.map(({paragraph, image, backgroundColor, label, slug}, index) => {
                        const textColor = backgroundColor == "#00305b" ? "#ffffff" : "#323232"
                        return (
                            <div key={index} className="w-[45%]">
                                {image ? 
                                <MotionWrapper key={`${animate}1`} className="relative w-full h-full">
                                   <Image src={urlFor(image).url()} alt="Service image" fill className="object-cover" />
                                </MotionWrapper> :
                                <MotionWrapper key={`${animate}2`} className={`w-full h-full p-10 flex flex-col justify-between 
                                    ${backgroundColor == "#00305b" ? "bg-[#00305b] text-white" : backgroundColor == "#e3dfd6" ? "bg-[#e3dfd6] text-[#323232]" : "bg-[#ffffff] text-[#323232]"}`}>
                                    <MotionWrapper key={`${animate}3`} type={Motions.FADELEFT} className="text-[24px] lg:text-[30px] pb-6" >{label}</MotionWrapper>
                                    <MotionWrapper key={`${animate}4`} type={Motions.FADELEFT} className="font-montserrat text-[16px] lg:text-[18px] pb-6">{paragraph}</MotionWrapper>
                                    <Link href={`/${slug}`} className="w-fit font-montserrat text-[16px] lg:text-[18px] p-2 border-1"
                                        style={{color: textColor, borderColor: textColor}}>Learn More</Link>
                                </MotionWrapper>}
                            </div>
                    )})}
                    <span 
                        className="absolute right-0 top-1/2 -translate-y-1/2 bg-[#00305b] hover:bg-[#0f4c85] px-5 py-10 cursor"
                        onClick={() => swapServices()}>
                        <RightArrow />
                    </span>
                </div>
            </div>
        </div>
    )
}