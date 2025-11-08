"use client"
import { PortableText, PortableTextBlock } from 'next-sanity';
import Image from 'next/image';
import Link from 'next/link';


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
            <div className="bg-white px-5 py-10 lg:py-[120px]">
                <div className="max-w-[1200px] m-auto flex flex-wrap justify-between">
                    {[columnLeft, columnRight].map((items, index) => (
                        <div key={index} className="w-full lg:w-[48%]">
                            <PortableText 
                                value={items}
                                components={{
                                    block: {
                                        h3: ({children}) => <h3 className="font-bold text-[24px] lg:text-[30px] text-[#00305b] pb-6">{children}</h3>,
                                        normal: ({children}) => <p className="font-montserrat text-[16px] lg:text-[18px] pb-6">{children}</p>,
                                    },
                                    listItem: {
                                        bullet: ({children}) => <li className="relative pl-6 pb-3 font-montserrat text-[16px] lg:text-[18px] before:content-['*'] before:absolute before:left-0 before:top-0">{children}</li>
                                    }
                            }}/> 
                        </div>
                    ))}  
                </div>
                <div className="w-full flex justify-center">
                    <Link href="tel:+15108460928" className="font-montserrat font-medium border border-[#00305b] lg:m-10 px-5 lg:px-10 py-10 space-y-3 text-center text-[18px] lg:text-[20px] text-[#00305b] 
                        hover:bg-[#00305b] hover:text-white transition duration-300 ease-out">
                        <p>{buttonText}</p>
                        <strong>{phoneNumber}</strong>
                    </Link>
                </div>
            </div>
        </div>
    )
}