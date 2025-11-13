"use client"
import Image from "next/image";
import MotionWrapper from "./motionWraper";
import { urlFor } from "../util";
import AnimatedCTA from "./animatedCTA";

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
  const { image, headline, subHeadline, buttonText } = welcomePage

    return (
        <main id="home" className="scroll-mt-20 relative overflow-hidden">
          <Image src={urlFor(image).url()} alt={"Welcome page background image"} fill className="object-cover" priority sizes="100vw" />
          <MotionWrapper className="relative z-5 max-w-[1200px] m-auto w-full h-[calc(100vh-119px)] p-5 flex flex-col justify-center items-start">
              <h1 className="w-full lg:w-[800px] text-[48px] lg:text-[64px] leading-tight lg:leading-normal font-bold pb-6 lg:pb-12">{headline}</h1>
              {/* <h2 className="text-[24px] lg:text-[30px] font-bold text-center lg:text-left pb-4">{h2}</h2> */}
              <div className="flex flex-col lg:flex-row items-center justify-end w-full">
                  <MotionWrapper type={Motions.FADEUP}>
                    <p className="font-montserrat font-medium w-full lg:w-[600px] text-[18px] lg:text-[24px] pb-6">{subHeadline}</p>
                  </MotionWrapper>
                  <AnimatedCTA {...{ buttonText }} />
              </div>
          </MotionWrapper>
        </main>
    )
}