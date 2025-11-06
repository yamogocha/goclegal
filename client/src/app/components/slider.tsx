"use client"
import { Swiper } from "swiper/react";
import { Pagination, Autoplay } from "swiper/modules";
import { JSX } from "react";

type SwiperType = {
    slides: JSX.Element[]
}
export default function Slider({ slides }: SwiperType) {

    return (
        <Swiper
            modules={[Pagination, Autoplay]}
            pagination={{ clickable: true }}
            autoplay={{
                delay: 10000, // 3 seconds
                disableOnInteraction: false, // continue autoplay after user interacts
                reverseDirection: true,
            }}
            spaceBetween={50}
            slidesPerView={1}
            // onSlideChange={() => console.log("slide change")}
            // Add breakpoints for responsiveness if needed
            breakpoints={{
                640: { slidesPerView: 2, spaceBetween: 20 },
                1024: { slidesPerView: 3, spaceBetween: 40 },
                }}
            >
            <>{slides}</>
        </Swiper>
    )
}