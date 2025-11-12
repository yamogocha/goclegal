"use client"
import Image from "next/image";
import { useIsMobile } from "../util";
import Link from "next/link";
import { useEffect, useState } from "react";
import Arrow from "./arrow";
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
    headline: string
    slug: string
    slides: Slide[]
}

export default function ServicesComponent({ headline, slug, slides }: ServicesPage) {
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
        setIndex(isMobile ? 1 : 4)
        setService(slides.slice(0, isMobile ? 1 : 4))
    }, [isMobile, slides])

    return (
        <div id={slug} className="scroll-mt-20 lg:scroll-mt-5 w-full h-full bg-[#323232] px-5 py-10 lg:py-[120px]">
            <MotionWrapper className="max-w-[1200px] m-auto flex flex-col lg:flex-row lg:items-center">
                <h2 className="w-full text-[#e3dfd6] text-[36px] lg:text-[48px] leading-tight lg:leading-normal font-bold text-center lg:text-left pb-6 lg:pb-0">{headline}</h2>
                <div className="relative flex flex-wrap gap-10 justify-end">
                    {servie.map(({slug, paragraph, image, backgroundColor, label}, index) => {
                        // const textColor = backgroundColor == "#00305b" ? "#ffffff" : "#323232"
                        return (
                            <div key={index} className="w-full lg:w-[45%] h-[400px]">
                                {image ? 
                                <div className="relative w-full h-full">
                                    <Image src={image} alt="Services image" fill className="object-cover" />
                                </div> :
                                <div className={`w-full h-full p-10 flex flex-col justify-between 
                                    ${backgroundColor == "#00305b" ? "bg-[#00305b] text-white" : backgroundColor == "#e3dfd6" ? "bg-[#e3dfd6] text-[#323232]" : "bg-[#ffffff] text-[#323232]"}`}>
                                    <MotionWrapper key={animate} type={Motions.FADELEFT}>
                                        <div className="font-bold text-[24px] lg:text-[30px] pb-6" >{label}</div>
                                        <p className="font-montserrat text-[16px] lg:text-[18px] pb-6">{paragraph}</p>
                                    </MotionWrapper>
                                    <Link href={`/${slug}`} className={`w-fit font-montserrat font-medium text-[16px] lg:text-[18px] p-2 border-1 transition duration-300 ease-out
                                         ${backgroundColor == "#00305b" ? "hover:text-[#00305b] hover:bg-white" : backgroundColor == "#e3dfd6" ? "hover:text-[#e3dfd6] hover:bg-[#323232]" : "hover:text-[#ffffff] hover:bg-[#323232]"}`}>
                                        Learn More
                                    </Link>
                                </div>}
                            </div>
                    )})}
                    <div className="relative w-full lg:w-[45%] h-[400px] block lg:hidden">
                        <Image src={"https://cdn.sanity.io/images/3zonvthd/production/811d964414f183b4aa64129e1984cd0eedfc276f-2400x1108.webp"} alt="Services image" fill className="object-cover" />
                    </div>
                    <span 
                        className="absolute right-0 top-[200px] lg:top-1/2 -translate-y-1/2 bg-gradient-to-l from-[#00305b] to-[#004c8f] lg:bg-[#00305b] hover:bg-gradient-to-r hover:from-[#00305b] hover:to-[#004c8f] px-2 py-5 lg:px-5 lg:py-10 cursor-pointer transition duration-300 ease-out shadow-[0_0px_10px_rgba(0,0,0,0.3)]"
                        onClick={() => swapServices(isMobile ? 1 : 4)}>
                        <Arrow />
                    </span>
                </div>
                
            </MotionWrapper>
        </div>
    )
}