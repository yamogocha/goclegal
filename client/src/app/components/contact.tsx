"use client"
import Link from "next/link"
import ScalesOfJustice from "../assets/scalesOfJustice"
import Trophy from "../assets/trophy"
import SheildCheck from "../assets/sheildCheck"
import MotionWrapper from "./motionWraper"

export type ContactType = {
    headline: string,
    subHeadlines: string[],
    slug: string
    name: string,
    email: string,
    phoneNumber: string,
    message: string
    callUs: string
}
export default function ContactComponent(contact: ContactType) {
    const {headline, subHeadlines, slug, name, email, phoneNumber, message, callUs} = contact
    const trustBadges = [
      {text: subHeadlines[0], icon: <ScalesOfJustice className="size-9 stroke-[#B8860B]"/>},
      {text: subHeadlines[1], icon: <Trophy className="size-8 stroke-[#B8860B]"/>},
      {text: subHeadlines[2], icon: <SheildCheck className="size-9 stroke-[#B8860B]"/>},
    ]

    const handleClick = () => {
        if (typeof window !== "undefined" && window.gtag) {
          window.gtag("event", "conversion", {
            send_to: "AW-17444498530/h7lsCID3woYbEOLYl_5A",
          });
          console.log("Google conversion event sent ✅");
        } else {
          console.warn("gtag not available yet");
        }
      };

    return (
        <form id={slug} action="https://formspree.io/f/mpwydejv" method="post" className="scroll-mt-20 bg-[#323232] w-full h-full px-5 py-10 lg:pt-[80px] lg:pb-[100]">
            <MotionWrapper className="grid grid-cols-2 gap-6 w-full lg:w-1/2 m-auto">
                <h2 className="col-span-2 text-[36px] lg:text-[48px] leading-tight lg:leading-normal font-bold text-center text-[#e3dfd6]">{headline}</h2>
                <div className="col-span-2 flex flex-col lg:flex-row justify-center gap-3 pb-6 lg:pb-18">
                  {trustBadges.map(({text, icon}, index) => (
                    <div key={index} className="flex items-center">
                      {icon}
                      <span className="whitespace-nowrap font-montserrat text-[16px] lg:text-[18px] text-[#e3dfd6] pl-3">{text}</span>
                    </div>
                  ))}
                </div>
                <input name="name" type="text" placeholder={name} className="col-span-2 font-montserrat font-medium p-5 bg-white border-none focus:outline-none placeholder:text-[#323232]" required />
                <input name="email" type="email" placeholder={email} className="col-span-2 lg:col-span-1 font-montserrat font-medium p-5 bg-white border-none focus:outline-none placeholder:text-[#323232]" required />
                <input name="phoneNumber" type="tel" placeholder={phoneNumber} className="col-span-2 lg:col-span-1 font-montserrat font-medium p-5 bg-white border-none focus:outline-none placeholder:text-[#323232]" required />
                <textarea name="message" placeholder={message} className="col-span-2 h-[300px] font-montserrat font-medium p-5 bg-white border-none focus:outline-none placeholder:text-[#323232]" />
                <input onClick={handleClick} type="submit" className="col-span-2 font-montserrat mb-6  text-white text-center text-[18px] lg:text-[20px] font-bold p-4 bg-gradient-to-l from-[#00305b] to-[#004c8f] hover:bg-gradient-to-r hover:from-[#00305b] hover:to-[#004c8f] shadow-[0_0px_10px_rgba(0,0,0,0.3)] cursor-pointer transition duration-300 ease-out" />
                <Link href="tel:+15108460928" className="col-span-2 font-montserrat text-[#e3dfd6] text-[18px] lg:text-[20px] text-center underline">{callUs}</Link>
            </MotionWrapper>
        </form>
    )   
}