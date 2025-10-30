"use client"
import { Swiper, SwiperSlide } from "swiper/react";
import { Slide } from "./testimonials";
import { Pagination, Autoplay } from "swiper/modules";
import Image from "next/image";
import { urlFor } from "../util";
import MotionWrapper from "./motionWraper";
import { Motions } from "./welcome";

type SwiperType = {
    slides: Slide[]
}
export default function Slider({ slides }: SwiperType) {

    const slidesContent = slides.map(({image, paragraph, label}, index) => (
        <SwiperSlide key={index}>
            <div className="bg-white p-10 h-[410px]">
                <div className="flex justify-center pb-5">
                    <Image src={urlFor(image).url()} alt="" width={25} height={25}/>
                </div>
                <MotionWrapper type={Motions.FADEUP}>
                    <p className="font-montserrat text-[16px] h-[250px]">{paragraph}</p>
                    <div className="font-montserrat text-[22px] pt-5 border-t-2 border-[#e3dfd6]">{label}</div>
                </MotionWrapper>
            </div>
        </SwiperSlide>
    ))

    return (
        <Swiper
            className="h-[465px] lg:h-[480px]"
            modules={[Pagination, Autoplay]}
            pagination={{ clickable: true }}
            autoplay={{
                delay: 10000, // 3 seconds
                disableOnInteraction: false, // continue autoplay after user interacts
                reverseDirection: true,
            }}
            spaceBetween={50}
            slidesPerView={1}
            onSlideChange={() => console.log("slide change")}
            // Add breakpoints for responsiveness if needed
            breakpoints={{
                640: { slidesPerView: 2, spaceBetween: 20 },
                1024: { slidesPerView: 3, spaceBetween: 40 },
                }}
            >
            <>{slidesContent}</>
        </Swiper>
    )
}