"use client"
import { PortableTextBlock } from 'next-sanity';
import Image from 'next/image';
import Link from 'next/link';
import PortableTextComponent from './portableText';


export type Post = {
    headline: string
    subHeadline: string
    image: string
    columnLeft: PortableTextBlock[]
    columnRight: PortableTextBlock[]
    buttonText: string
    phoneNumber: string
}
export default function PostComponent(postQuery: Post) {
    const { headline, subHeadline, image, columnLeft, columnRight, buttonText, phoneNumber } = postQuery

    return(
        <div className="bg-[#00305bcf] w-full h-full">
            <Image src={image} alt="Auto Accidents background image" fill className='object-cover -z-5'/>
            <div className="w-full lg:w-2/3 m-auto h-[400px] px-5 flex flex-col justify-center item-center text-center text-white">
                <h1 className='text-[36px] lg:text-[48px] leading-tight lg:leading-normal font-bold pb-6'>{headline}</h1>
                <p className="font-montserrat font-medium text-[18px] lg:text-[22px]">{subHeadline}</p>
            </div>
            <div className="bg-white px-5 py-10 lg:py-[80px]">
                <div className="max-w-[1200px] m-auto flex flex-wrap justify-between">
                    <div className="w-full lg:w-[48%]">
                        <PortableTextComponent {...{ body: columnLeft }}/>
                    </div> 
                    <div className="w-full lg:w-[48%]">
                        <PortableTextComponent {...{ body: columnRight }}/> 
                        <Link href="tel:+15108460928" className="block font-montserrat font-medium lg:w-[400px] m-auto p-5 space-y-3 text-center text-[18px] lg:text-[20px]
                            bg-[#00305b] text-white hover:bg-gradient-to-r hover:from-[#00305b] hover:to-[#004c8f] transition duration-300 ease-out">
                            <p className="">{buttonText}</p>
                            <strong>{phoneNumber}</strong>
                        </Link> 
                    </div>
                </div>
            </div>
        </div>
    )
}