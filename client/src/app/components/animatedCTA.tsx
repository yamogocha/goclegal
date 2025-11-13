"use client"
import Link from "next/link";
import { animate, motion, useMotionValue, useTransform } from "framer-motion"


export const handleGTagClick = () => {
    if (typeof window !== "undefined" && window.gtag) {
      window.gtag("event", "conversion", {
        send_to: "AW-17444498530/h7lsCID3woYbEOLYl_5A",
      });
      console.log("Google conversion event sent ✅");
    } else {
      console.warn("gtag not available yet");
    }
  };


type CTAType = {
    buttonText: string
    phoneNumber?: string
}
export default function AnimatedCTA({ buttonText, phoneNumber }:CTAType) {
  const angle = useMotionValue(0)
  const background = useTransform(
    angle,
    [0, 90],
    [
      'linear-gradient(0deg, #00305b, #004c8f)',
      'linear-gradient(90deg, #00305b, #00a2ff)'
    ]
  )

    return (
      <motion.div
        className="mb-12 p-5 w-full lg:w-[400px] m-auto rounded text-center"
        style={{ background }}
        onHoverStart={() => animate(angle, 90, { duration: 1})}
        onHoverEnd={() => animate(angle, 0, { duration: 1 })}
        >
        <Link onClick={handleGTagClick} href="tel:+15108460928" className="space-y-3 font-montserrat font-medium text-[18px] lg:text-[20px] text-white">
            <p>{buttonText}</p>
            {phoneNumber && <strong>{phoneNumber}</strong>}
        </Link>
      </motion.div>
    )
}