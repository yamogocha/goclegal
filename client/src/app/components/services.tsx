"use client"
import Image from "next/image";
import { urlFor } from "../util";
import Link from "next/link";
import { useState } from "react";

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

export default function ServicesComponent({ title, slides }: ServicesPage) {
    const [servie, setService] = useState<Slide[]>(slides.slice(0, 4))

    return (
        <div className="w-full h-full lg:h-screen bg-[#323232] px-5 py-[20px] lg:py-[60px]">
            <div className="max-w-[1200px] m-auto flex flex-col lg:flex-row items-center">
                <h2 className="w-full text-[#e3dfd6] text-[36px] lg:text-[48px] leading-tight lg:leading-normal font-bold text-center lg:text-left pb-6 lg:pb-0">{title}</h2>
                <div className="flex flex-col lg:flex-row flex-wrap gap-10 justify-end">
                    {servie.map(({paragraph, image, backgroundColor, label, slug}, index) => {
                        const textColor = backgroundColor == "#003c64" ? "#ffffff" : "#323232"
                        return (
                            <div key={index} className="w-full lg:w-[40%]">
                                {image ? 
                                <div className="relative w-full h-full">
                                    <Image src={urlFor(image).url()} alt="Service image" fill className="object-cover" />
                                </div> :
                                <div className="w-full h-full p-10 flex flex-col justify-between" 
                                    style={{backgroundColor: backgroundColor, color: textColor}}>
                                    <div className="text-[24px] lg:text-[30px] pb-6">{label}</div>
                                    <p className="font-montserrat text-[16px] lg:text-[18px] pb-6">{paragraph}</p>
                                    <Link href={`/${slug}`} className="w-fit font-montserrat text-[16px] lg:text-[18px] p-2 border-1"
                                        style={{color: textColor, borderColor: textColor}}>Learn More</Link>
                                </div>}
                            </div>
                    )})}
                </div>
            </div>
        </div>
    )
}