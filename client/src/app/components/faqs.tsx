"use client"
import { PortableTextBlock } from "next-sanity"
import Image from "next/image"
import MotionWrapper from "./motionWraper"
import PortableTextComponent from "./portableText"
import Link from "next/link"


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
            <Image src={image} alt="FAQs page background image" fill className="object-cover -z-5" />
            <MotionWrapper className="w-full lg:w-2/3 m-auto h-[400px] px-5 text-center text-white flex flex-col justify-center">
                <h1 className='text-[36px] lg:text-[48px] leading-tight lg:leading-normal font-bold pb-6'>{headline}</h1>
                <p className="font-montserrat font-medium text-[18px] lg:text-[22px]">{subHeadline}</p>
            </MotionWrapper>
            <div className="bg-white px-5 py-10 lg:py-[80px]">
                <div className="max-w-[1200px] m-auto flex justify-between">
                    <div className="w-full lg:w-[48%]">
                        <PortableTextComponent {...{ body: leftColumn }} />
                    </div>
                    <div className="w-full lg:w-[48%]">
                        <PortableTextComponent {...{ body: rightColumn }} />
                        <Link href="tel:+15108460928" className="block font-montserrat font-medium mb-6 lg:w-[400px] m-auto p-5 space-y-3 text-center text-[18px] lg:text-[20px] text-white 
                            bg-[#00305b] hover:bg-gradient-to-r hover:from-[#00305b] hover:to-[#004c8f] cursor-pointer transition duration-300 ease-out">
                            <p>{buttonText}</p>
                            <strong>{phoneNumber}</strong>
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    )
}