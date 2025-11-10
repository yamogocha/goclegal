"use client"
import Image from "next/image"
import Slider from "./slider"
import { SwiperSlide } from "swiper/react"
import MotionWrapper from "./motionWraper"

type Slide = {
    paragraph: string
    image?: string
    label: string
}
export type AwardsAndHonorsPage = {
    headline: string
    subHeadline: string
    slug: string
    slides: Slide[]
}
export default function AwardsAndHonorsComponent(awardsAndHonorsPage: AwardsAndHonorsPage) {
    const { headline, subHeadline, slug, slides: awardsAndHonorsSlides} = awardsAndHonorsPage

    const renderImage = (label: string, image?: string) => {
        if (image) {
            return <Image src={image} alt="Award bage" width={200} height={200} className="object-contain mx-auto" />
        } else {
            if (label.includes("Selected in 2023")) {
                return (
                    <div className="w-[180px] h-[150px] rounded text-[#808080] text-center my-[25px] mx-auto" data-slbadge="v2-slbadge-gray"
                        data-text1="Selected in 2023" data-text2="Thomson Reuters" style={{ fontFamily: "arial, sans-serif" }}>
                        <script async type="text/javascript"
                            src="https://www.superlawyers.com/static/sl-badge/v2/load.min.js">
                            </script>
                        <a className="slbadge_profileurl"
                            title="View the profile of Northern California Personal Injury - General Attorney Gregory J. O&amp;#039;Connell"
                            href="https://profiles.superlawyers.com/california/oakland/lawyer/gregory-j-oconnell/1719201a-ffd6-41e3-8ec8-2970004dbb1e.html?npcmp=slb:badge:sl_badge:1719201a-ffd6-41e3-8ec8-2970004dbb1e:year&utm_source=1719201a-ffd6-41e3-8ec8-2970004dbb1e&utm_campaign=v2-slbadge-gray&utm_content=profile">Gregory
                            J. O&#039;Connell</a>
                        {/* <div className="mt-[6px]">Rated by Super Lawyers<br /><br /><br />loading ...</div> */}
                    </div>
                )
            }
             if (label.includes("Rising Stars")) {
                return (
                    <div className="w-[180px] h-[150px] rounded text-[#808080] text-center my-[25px] mx-auto" data-slbadge="v2-rsbadge-blue"
                        style={{ fontFamily: "arial, sans-serif" }}>
                        <script async type="text/javascript"
                            src="https://www.superlawyers.com/static/sl-badge/v2/load.min.js">
                            </script>
                        <a className="slbadge_profileurl"
                            title="View the profile of Northern California Personal Injury - General Attorney Gregory J. O&amp;#039;Connell"
                            href="https://profiles.superlawyers.com/california/oakland/lawyer/gregory-j-oconnell/1719201a-ffd6-41e3-8ec8-2970004dbb1e.html?npcmp=rsb:badge:sl_badge:1719201a-ffd6-41e3-8ec8-2970004dbb1e:main&utm_source=1719201a-ffd6-41e3-8ec8-2970004dbb1e&utm_campaign=v2-rsbadge-blue&utm_content=profile">Gregory
                            J. O&#039;Connell</a>
                        {/* <div className="mt-[6px]">Rated by Super Lawyers<br /><br /><br />loading ...</div> */}
                    </div>
                )
            }
        }
    }

    const slides = awardsAndHonorsSlides.map(({label, paragraph, image}, index) => {
        return (
            <SwiperSlide key={index} className="flex flex-col items-center mb-14 lg:my-14">
                <div className="m-auto font-bold text-[24px] lg:[30px] pb-6">{label}</div>
                <div className="pb-6">{renderImage(label, image)}</div>
                <p className="font-montserrat text-[16px] lg:text-[18px]">{paragraph}</p>
            </SwiperSlide>
        )
    })

    return (
        <div id={slug} className="scroll-mt-20 w-full h-full px-5 py-10 lg:pb-[50px] bg-white">
            <MotionWrapper className="max-w-[1200px] m-auto text-center">
                <h2 className="text-[36px] lg:text-[48px] leading-tight lg:leading-normal font-bold pb-6">{headline}</h2>
                {/* <p className="font-montserrat w-full lg:w-2/3 m-auto text-[18px] lg:text-[24px] pb-6 lg:pb-12">{subHeadline}</p> */}
                <Slider {...{ slides }}/>
            </MotionWrapper>
        </div>
    )
} 