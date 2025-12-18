"use client"
import Image from 'next/image';
import PortableTextComponent from './portableText';
import MotionWrapper from './motionWraper';
import Link from 'next/link';
import { PortableTextBlock } from 'next-sanity';


export type BlogItem = {
    title: string
    slug: string
    headline: string
    date: string
    image: string
    imageId: string
    columnLeft: PortableTextBlock[]
    buttonText: string
    phoneNumber: string
}

type Blog = {
    latestPost: BlogItem
    posts: BlogItem[]
}
export default function BlogComponent({latestPost, posts}: Blog) {
    const { title, slug, headline, date, image, imageId, columnLeft } = latestPost
    const body = columnLeft.slice(0, 3)

    return(
        <div className="bg-[#00305bcf] w-full h-full">
            <div className="relative w-full h-[300px] lg:h-[400px]">
                <Image src={`${image}?v=${imageId}`} alt={`${title} background image`} fill className='object-cover -z-5'/>
                <MotionWrapper className="w-full lg:w-2/3 m-auto h-[300px] lg:h-[400px] px-5 flex flex-col justify-center item-center text-center text-white">
                    <h1 className='text-[36px] lg:text-[48px] leading-tight lg:leading-normal font-bold pb-6'>{headline}</h1>
                </MotionWrapper>
            </div>
            <div className="bg-white px-5 py-10 lg:py-[80px]">
                <div className="max-w-[1200px] m-auto flex flex-wrap justify-between">
                    {date && <div className="w-full font-montserrat text-[16px] lg:text-[18px] pb-6">{`BY GOC LEGAL, ${date.split("T")[0]}`}</div>}
                    <PortableTextComponent {...{ body }}/>
                    <Link href={`/blog/${slug}`} className="space-x-3 text-[18px] lg:text-[20px] text-[#00305b] hover:text-[#004c8f] font-bold">
                        <strong>Read more</strong>
                        <strong>&#8594;</strong>
                    </Link>
                    <div className="w-full flex flex-wrap gap-6 py-10 lg:py-[80px]">
                        {posts.map((post, index)=> {
                            const { title, slug, headline, date, image, imageId } = post
                            return (
                                <Link href={`/blog/${slug}`} key={index} className="lg:w-[32%] group">
                                    <div className="relative w-full h-[300px]">
                                        <Image src={`${image}?v=${imageId}`} alt={`${title} background image`} fill className='object-cover shadow-md shadow-[#14365c4d]'/>
                                        <div className="opacity-100 lg:opacity-0 group-hover:opacity-100 absolute bg-[#00305bcf] w-full h-full flex items-center justify-center text-white text-[18px] lg:text-[20px] font-bold rounded space-x-3 transition east-out duration-300">
                                            <strong>Read more</strong>
                                            <strong>&#8594;</strong>
                                        </div>
                                    </div>
                                    <div className="w-full font-montserrat text-[16px] lg:text-[18px] py-3">{`BY GOC LEGAL, ${date.split("T")[0]}`}</div>
                                    <h3 className='text-[22px] lg:text-[24px] leading-tight lg:leading-normal font-bold text-[#00305b] hover:text-[#004c8f] pb-6'>{headline}</h3>
                                </Link>
                            )
                        })}
                    </div>
                </div>
            </div>
        </div>
    )
}