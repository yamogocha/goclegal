"use client"
import { PortableTextBlock } from 'next-sanity';
import Image from 'next/image';
import PortableTextComponent from './portableText';
import MotionWrapper from './motionWraper';
import AnimatedCTA from './animatedCTA';


export type Post = {
    headline: string
    subHeadline: string
    image: string
    imageId: string
    columnLeft: PortableTextBlock[]
    columnRight: PortableTextBlock[]
    buttonText: string
    phoneNumber: string
}
export default function PostComponent(postQuery: Post) {
    const { headline, subHeadline, image, imageId, columnLeft, columnRight, buttonText, phoneNumber } = postQuery

    return(
        <div className="bg-[#00305bcf] w-full h-full">
            <div className="relative w-full h-[300px] lg:h-[400px]">
                <Image src={`${image}?v=${imageId}`} alt="Auto Accidents background image" fill className='object-cover -z-5'/>
                <MotionWrapper className="w-full lg:w-2/3 m-auto h-[300px] lg:h-[400px] px-5 flex flex-col justify-center item-center text-center text-white">
                    <h1 className='text-[36px] lg:text-[48px] leading-tight lg:leading-normal font-bold pb-6'>{headline}</h1>
                    <p className="font-montserrat font-medium text-[18px] lg:text-[22px]">{subHeadline}</p>
                </MotionWrapper>
            </div>
            <div className="bg-white px-5 py-10 lg:py-[80px]">
                <div className="max-w-[1200px] m-auto flex flex-wrap justify-between">
                    <div className="w-full lg:w-[48%]">
                        <PortableTextComponent {...{ body: columnLeft }}/>
                    </div> 
                    <div className="w-full lg:w-[48%]">
                        <PortableTextComponent {...{ body: columnRight }}/> 
                        <AnimatedCTA {...{buttonText, phoneNumber}} /> 
                    </div>
                </div>
            </div>
        </div>
    )
}