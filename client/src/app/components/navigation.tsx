"use client"
import Image from "next/image"
import { useState } from "react"
import Arrow from "./arrow"
import MotionWrapper from "./motionWraper"

type NavigationItem = {
    label: string
    slug: string
    subNavItems?: NavigationItem[]
}
export type NavigationType = {
    logo: string
    items: NavigationItem[]
}
export default function NavigationComponent(navigation: NavigationType) {
    const {logo, items} = navigation
    const hamburger = ["one", "two", "three"]
    const [showMobileNav, setShowMobileNav] = useState<boolean>(false)
    const [showSubNav, setShowSubNav] = useState<boolean>(false)

    const toggleMobileMenu = () => setShowMobileNav(!showMobileNav)
    const toggleSubNavMenu = () => setShowSubNav(!showSubNav)
    return(
        <header className="z-10 sticky top-0 bg-white shadow-md shadow-[#14365c1a]">
          <nav className="max-w-[1200px] m-auto flex justify-between items-center p-5 lg:px-0">
              <a href={"/"}><Image src={logo} alt="GOC Legal logo" width={300} height={80} className="w-auto h-[60px] lg:h-[80px]" /></a>
              <ul className="bg-white hidden lg:flex flex-row list-none">
                  {items.map(({label, slug, subNavItems}, index) => (
                    <li key={index} className="relative flex items-center">
                        <a href={`/#${slug}`} className="font-montserrat font-medium p-5 cursor-pointer text-[18px] text-[#0f4c85] hover:text-[#028695]">
                            {label}
                        </a>
                        {subNavItems && <Arrow onClick={toggleSubNavMenu} className={`transition duration-300 ease-out px-2 ${showSubNav ? "rotate-[-90deg]" : "rotate-[90deg]"}`} size={24} color={"#323232"}/>}
                        {showSubNav && subNavItems && 
                            <ul className="absolute top-15 -left-5 bg-white flex flex-col pb-5 rounded">
                                {subNavItems.map(({label, slug}, index) => (
                                    <li key={index}>
                                        <a href={`/${slug}`} className="font-montserrat font-medium block px-10 py-5 cursor-pointer text-[18px] text-[#0f4c85] hover:text-[#028695] whitespace-nowrap">
                                            <MotionWrapper>{label}</MotionWrapper>
                                        </a>
                                    </li>
                                ))}
                            </ul>
                        }
                    </li>
                  ))}
              </ul>
              {/* mobile nav */}
              <>
                <div onClick={toggleMobileMenu} className="cursor-pointer block z-10 py-3 lg:hidden">
                    {hamburger.map((_, index) => {
                        return (
                            <span key={index} className={`w-[35px] h-[3px] m-1 bg-[#00305B] rounded block transition duration-300 ease-out 
                                ${showMobileNav && index == 0 ? "rotate-[-45deg] translate-x-[-5px] translate-y-[2px]" : ""}
                                ${showMobileNav && index == 1 ? "hidden" : ""}
                                ${showMobileNav && index == 2 ? "rotate-[45deg] translate-x-[-5px] translate-y-[-5px]" : ""}`} />
                    )})}
                </div>
                <div onClick={toggleMobileMenu} className={`w-full h-screen z-5 absolute top-0 right-0 p-5 bg-[#000000b5] transition duration-300 ease-out ${showMobileNav ? "block" :"hidden"}`} />
                <ul className={`list-none z-5 w-4/5 bg-white rounded-bl-md flex flex-col absolute top-0 right-0 p-10 lg:hidden
                        transition duration-300 ease-out ${showMobileNav ? "block" :"hidden"}`}>
                    {items.map(({label, slug, subNavItems}, index) => (
                    <li key={index} className="flex items-start">
                        <a onClick={toggleMobileMenu} href={`/#${slug}`} className="font-montserrat font-medium pb-5 cursor-pointer text-[16px] text-[#0f4c85] hover:text-[#028695] flex">
                            {label}
                        </a>
                        {subNavItems && <Arrow onClick={toggleSubNavMenu} className={`px-2 transition duration-300 ease-out ${showSubNav ? "rotate-[-90deg]" : "rotate-[90deg]"}`} size={24} color={"#323232"}/>}
                        {showSubNav && subNavItems && 
                            <ul className="absolute top-30 right-0 bg-white flex flex-col pb-5 w-[300px] rounded">
                                {subNavItems.map(({label, slug}, index) => (
                                    <li key={index}>
                                        <a href={`/${slug}`} className="font-montserrat font-medium block pl-10 py-3 cursor-pointer text-[16px] text-[#0f4c85] hover:text-[#028695] whitespace-nowrap">
                                            <MotionWrapper>{label}</MotionWrapper>
                                        </a>
                                    </li>
                                ))}
                            </ul>
                        }
                    </li>
                  ))}
                </ul>
              </>
          </nav>
      </header>
    )
}