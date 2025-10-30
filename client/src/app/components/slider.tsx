"use client"
import { Swiper } from "swiper/react";
import { Pagination, Autoplay } from "swiper/modules";

type SwiperType = {
    children: JSX.Element[]
}
export default function Slider({ children }: SwiperType) {

    return (
        <Swiper
            className="h-[465px] lg:h-[550px]"
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
            <>{children}</>
        </Swiper>
    )
}