"use client"
import imageUrlBuilder from '@sanity/image-url'
import { client } from '@/sanity/client'
import { useEffect, useState } from 'react'

const builder = imageUrlBuilder(client)

export function urlFor(source: Record<string, unknown>){
    return builder.image(source)
}


export function useIsMobile(breakpoint = 768): boolean | null {
    const [isMobile, setIsMobile] = useState<boolean | null>(null)

    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth <= breakpoint)
        checkMobile()
        window.addEventListener("resize", checkMobile)
        return () => window.removeEventListener("resize", checkMobile)
    }, [breakpoint])

    return isMobile
}