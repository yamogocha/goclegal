"use client"
import { Swiper } from "swiper/react";
import { Pagination, Autoplay, EffectCards } from "swiper/modules";
import { JSX } from "react";

type SwiperType = {
    slides: JSX.Element[]
}
export function Slider({ slides }: SwiperType) {

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
            breakpoints={{
                640: { slidesPerView: 2, spaceBetween: 20 },
                1024: { slidesPerView: 3, spaceBetween: 40 },
                }}
            >
            <>{slides}</>
        </Swiper>
    )
}

type CardSwiperType = {
    cards: JSX.Element[]
}
export function CardSwiper({ cards }: CardSwiperType) {
    return (
        <Swiper
            modules={[EffectCards, Autoplay, Pagination]}
            effect="cards"
            grabCursor={true}
            cardsEffect={{
                slideShadows: false,
              }}
            pagination={{ clickable: true }}
            autoplay={{
                delay: 10000, // 3 seconds
                disableOnInteraction: false, // continue autoplay after user interacts
                reverseDirection: true,
            }}
        >
            {cards}
        </Swiper>
    )
}