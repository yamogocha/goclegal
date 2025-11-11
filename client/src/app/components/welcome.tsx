"use client"
import Image from "next/image";
import Link from "next/link";
import MotionWrapper from "./motionWraper";
import { urlFor } from "../util";

export type WelcomePage = {
  image: Record<string, string>;
  headline: string;
  subHeadline: string;
  buttonText: string;
  phoneNumber: string | number;
};
export enum Motions {
  FADEUP = "fadeUp",
  FADEDOWN = "fadeDown",
  FADEIN = "fadeIn",
  FADERIGHT = "fadeRight",
  FADELEFT = "fadeLeft"
}

export default function WelcomeCompnent(welcomePage: WelcomePage) {
  const { image, headline, subHeadline, buttonText, phoneNumber } = welcomePage
    
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
        <main id="home" className="scroll-mt-20 relative overflow-hidden">
          <Image src={urlFor(image).url()} alt={"Welcome page background image"} fill className="object-cover" priority sizes="100vw" />
          {/* blue overlay */}
          {/* <span className="absolute inset-x-1 inset-y-1 lg:inset-y-0 lg:left-0 lg:right-auto lg:w-[35%] lg:h-full rounded-md lg:rounded-none bg-[#00305bc7] m-2 lg:m-0"></span> */}
          <MotionWrapper className="relative z-5 max-w-[1200px] m-auto w-full h-[calc(100vh-119px)] p-5 flex flex-col justify-center items-start">
              <h1 className="w-full lg:w-[800px] text-[48px] lg:text-[64px] leading-tight lg:leading-normal font-bold pb-6 lg:pb-12">{headline}</h1>
              {/* <h2 className="text-[24px] lg:text-[30px] font-bold text-center lg:text-left pb-4">{h2}</h2> */}
              <div className="flex flex-col lg:flex-row items-center justify-end w-full">
                  <MotionWrapper type={Motions.FADEUP}>
                    <p className="font-montserrat font-medium w-full lg:w-[600px] text-[18px] lg:text-[24px] pb-6">{subHeadline}</p>
                  </MotionWrapper>
                  <Link onClick={handleClick} href="tel:+15108460928" className="font-montserrat mb-4 w-full lg:w-[250px] text-white text-center text-[18px] lg:text-[20px] font-bold p-4 bg-[#00305b] hover:bg-gradient-to-r hover:from-[#00305b] hover:to-[#004c8f] transition duration-300 ease-out">{buttonText}</Link>
              </div>
          </MotionWrapper>
        </main>
    )
}