import { PortableTextBlock } from "next-sanity"
import MotionWrapper from "./motionWraper"
import Image from "next/image"
import PortableTextComponent from "./portableText"


export type PrivacyPolicyPage = {
    headline: string
    image: string
    body: PortableTextBlock[]
}
export default function PrivacyPolicyComponent(privacyPolicyPage: PrivacyPolicyPage) {
    const {headline, image, body} = privacyPolicyPage
    return(
        <div className="bg-[#00305bcf] w-full h-full">
            <Image src={image} alt="About page background image" fill className="object-cover -z-5" />
            <MotionWrapper className="w-full lg:w-2/3 m-auto h-[400px] px-5 flex flex-col justify-center item-center text-center text-white">
                <h1 className='text-[36px] lg:text-[48px] leading-tight lg:leading-normal font-bold pb-6'>{headline}</h1>
            </MotionWrapper>
            <div className="bg-white px-5 py-10 lg:py-[120px]">
                <div className="max-w-[1200px] m-auto flex flex-col">
                    <PortableTextComponent {...{ body }} />
                </div>
            </div>
        </div>
    )
}