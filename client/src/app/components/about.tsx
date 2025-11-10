"use client"
import { PortableText, PortableTextBlock } from "next-sanity"
import Image from "next/image"
import Link from "next/link"
import { useState } from "react"
import MotionWrapper from "./motionWraper"


export type AboutPage = {
    headline: string,
    subHeadline: string,
    image: string,
    photo: string
    body: PortableTextBlock[]
}
export default function AboutComponent(aboutPage: AboutPage) {
    const {headline, subHeadline, image, photo, body} = aboutPage
    const [readMore, setReadMore] = useState(false)
    const lessContent = body.slice(0, 8)

    const portableContent = (body: PortableTextBlock[]) => {
        return (
            <PortableText 
                value={body}
                components={{
                    block: {
                        h3: ({children}) => <h3 className="font-bold text-[24px] lg:text-[30px] text-[#00305b] pb-6">{children}</h3>,
                        h4: ({children}) => <h4 className="font-bold text-[22px] lg:text-[24px] text-[#00305b] pb-3">{children}</h4>,
                        normal: ({children}) => <p className="font-montserrat text-[16px] lg:text-[18px] pb-6">{children}</p>,
                    },
                    listItem: {
                        bullet: ({children}) => <li className="relative pl-6 pb-3 font-montserrat text-[16px] lg:text-[18px] before:content-['*'] before:absolute before:left-0 before:top-0">{children}</li>
                    },
                    marks: {
                        link: ({ value, children }) => <Link href={value.href} className="underlinetext-[#00305b] text-[#00305b] hover:text-[#0f4c85] underline underline-offset-2">{children}</Link>
                    }
                }} 
            />
        )
    }
    const toggleReadMore = () => {
        setReadMore(!readMore)
        if (readMore) {
            const element = document.getElementById("greg-photo")
            element?.scrollIntoView({ behavior: "auto" })
        }
    }

    return (
        <div className="bg-[#00305bcf] w-full h-full">
            <Image id="greg-photo" src={image} alt="About page background image" fill className="object-cover -z-5" />
            <MotionWrapper className="w-full lg:w-2/3 m-auto h-[400px] px-5 flex flex-col justify-center item-center text-center text-white">
                <h1 className='text-[36px] lg:text-[48px] leading-tight lg:leading-normal font-bold pb-6'>{headline}</h1>
                <p className="font-montserrat font-medium text-[18px] lg:text-[22px]">{subHeadline}</p>
            </MotionWrapper>
            <div className="bg-white px-5 py-10 lg:py-[120px]">
                <div className="max-w-[1200px] m-auto flex flex-col lg:flex-row justify-between items-start">
                    <Image src={photo} alt="Gregory OConnel attorney photo" width={300} height={300} className="w-full lg:w-[48%] object-contain"/>
                    <div className="w-full lg:w-[48%] pt-6 lg:pt-0">
                        {portableContent(readMore ? body : lessContent)}
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