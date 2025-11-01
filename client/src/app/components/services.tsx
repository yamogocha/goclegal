"use client"
import Image from "next/image";
import { useIsMobile } from "../util";
import Link from "next/link";
import { useEffect, useState } from "react";
import RightArrow from "./arrowRight";
import MotionWrapper from "./motionWraper";
import { Motions } from "./welcome";

type Slide = {
    paragraph?: string
    image?: string
    backgroundColor?: string
    label?: string
    slug?: string
}
export type ServicesPage = {
    title: string
    slug: string
    slides: Slide[]
}

export default function Component({ title, slug, slides }: ServicesPage) {
    const isMobile = useIsMobile()
    const [index, setIndex] = useState<number>(0)
    const [servie, setService] = useState<Slide[]>([])
    const [animate, setAnimate] = useState<number>(0)

    const swapServices = (size = 4) => {
        const source = isMobile ? slides.filter(item => !item.image) : slides
        setIndex((prev) => (prev + size) % source.length)
        setService(source.slice(index, index + size))
        setAnimate((prev) => prev + 1)
    }

    useEffect(() => {
        if (isMobile == null) return
        setService(slides.slice(0, isMobile ? 1 : 4))
    }, [isMobile, slides])

    return (
        <div id={slug} className="scroll-mt-20 w-full h-full lg:h-screen bg-[#323232] p-5 lg:py-[50px]">
            <div className="max-w-[1200px] m-auto flex flex-col lg:flex-row lg:items-center">
                <h2 className="w-full text-[#e3dfd6] text-[36px] lg:text-[48px] leading-tight lg:leading-normal font-bold text-center lg:text-left pb-6 lg:pb-0"><MotionWrapper>{title}</MotionWrapper></h2>
                <div className="relative flex flex-wrap gap-10 justify-end">
                    {servie.map(({paragraph, image, backgroundColor, label, slug}, index) => {
                        const textColor = backgroundColor == "#00305b" ? "#ffffff" : "#323232"
                        return (
                            <div key={index} className="w-full lg:w-[45%] h-[400px]">
                                {image ? 
                                <MotionWrapper key={`${animate}1`} className="relative w-full h-full">
                                    <Image src={image} alt="Service image" fill className="object-cover" />
                                </MotionWrapper> :
                                <MotionWrapper key={`${animate}2`} className={`w-full h-full p-10 flex flex-col justify-between 
                                    ${backgroundColor == "#00305b" ? "bg-[#00305b] text-white" : backgroundColor == "#e3dfd6" ? "bg-[#e3dfd6] text-[#323232]" : "bg-[#ffffff] text-[#323232]"}`}>
                                    <MotionWrapper key={`${animate}3`} type={Motions.FADELEFT}>
                                        <div className="font-bold text-[24px] lg:text-[30px] pb-6" >{label}</div>
                                        <p className="font-montserrat text-[16px] lg:text-[18px] pb-6">{paragraph}</p>
                                    </MotionWrapper>
                                    <Link href={`/${slug}`} className="w-fit font-montserrat font-medium text-[16px] lg:text-[18px] p-2 border-1"
                                        style={{color: textColor, borderColor: textColor}}>Learn More</Link>
                                </MotionWrapper>}
                            </div>
                    )})}
                    <MotionWrapper className="relative w-full lg:w-[45%] h-[400px] block lg:hidden">
                        <Image src={"https://cdn.sanity.io/images/3zonvthd/production/811d964414f183b4aa64129e1984cd0eedfc276f-2400x1108.webp"} alt="Service image" fill className="object-cover" />
                    </MotionWrapper>
                    <span 
                        className="absolute right-0 top-[200px] lg:top-1/2 -translate-y-1/2 bg-[#0f4c85] lg:bg-[#00305b] hover:bg-[#0f4c85] px-2 py-5 lg:px-5 lg:py-10 cursor-pointer transition duration-300 ease-out shadow-[0_0px_10px_rgba(0,0,0,0.3)]"
                        onClick={() => swapServices(isMobile ? 1 : 4)}>
                        <RightArrow />
                    </span>
                </div>
                
            </div>
        </div>
    )
}