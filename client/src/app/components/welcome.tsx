"use client"
import Image from "next/image";
import Link from "next/link";
import MotionWrapper from "./motionWraper";
import { urlFor } from "../util";

export type WelcomePage = {
  description: string;
  mainImage: Record<string, string>;
  h1: string;
  h2: string;
  paragraph: string;
  btnText: string;
  btnNumber: string | number;
};
export enum Motions {
  FADEUP = "fadeUp",
  FADEIN = "fadeIn",
  FADERIGHT = "fadeRight",
  FADELEFT = "fadeLeft"
}

export default function WelcomeCompnent(welcomePage: WelcomePage) {
  const { description, mainImage, h1, h2, paragraph, btnText, btnNumber } = welcomePage
    
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
          <Image src={urlFor(mainImage).url()} alt={"Background image"} fill className="object-cover" priority sizes="100vw" />
          {/* blue overlay */}
          {/* <span className="absolute inset-x-1 inset-y-1 lg:inset-y-0 lg:left-0 lg:right-auto lg:w-[35%] lg:h-full rounded-md lg:rounded-none bg-[#00305bc7] m-2 lg:m-0"></span> */}
          <div className="relative z-5 max-w-[1200px] m-auto w-full h-screen p-5 flex flex-col justify-center items-start">          
              <MotionWrapper>
                <h1 className="w-full lg:w-[800px] text-[48px] lg:text-[64px] leading-tight lg:leading-normal font-bold pb-6 lg:pb-12">{h1}</h1>
              </MotionWrapper>
              {/* <h2 className="text-[24px] lg:text-[30px] font-bold text-center lg:text-left pb-4">{h2}</h2> */}
              <div className="flex flex-col lg:flex-row items-center justify-end w-full">
                  <MotionWrapper type={Motions.FADEUP}>
                    <p className="font-montserrat w-full lg:w-[600px] text-[18px] lg:text-[24px] pb-6">{paragraph}</p>
                  </MotionWrapper>
                  <Link href="tel:+15108460928" className="font-montserrat mb-4 w-full lg:w-[250px] text-white text-center text-[18px] lg:text-[20px] font-bold p-4 bg-[#00305b] hover:bg-[#0f4c85] transition duration-300 ease-out">{btnText}</Link>
              </div>
          </div>
        </main>
    )
}