"use client"
import Image from "next/image"
import { useState } from "react"

type NavigationItem = {
    label: string
    slug: string
}
export type NavigationType = {
    logo: string
    items: NavigationItem[]
}
export default function NavigationComponent(navigation: NavigationType) {
    const {logo, items} = navigation
    const hamburger = ["one", "two", "three"]
    const [showMobileNav, setShowMobileNav] = useState<boolean>(false)

    const toggleMobileMenu = () => setShowMobileNav(!showMobileNav)
    return(
        <header className="z-10 sticky top-0 bg-white shadow-md shadow-[#14365c1a]">
          <nav className="max-w-[1200px] m-auto flex justify-between items-center p-5 lg:px-0">
              <a href={"/"}><Image src={logo} alt="GOC Legal logo" width={300} height={80} className="w-auto h-[60px] lg:h-[80px]" /></a>
              <ul className="bg-white hidden lg:flex flex-row list-none">
                  {items.map(({label, slug}, index) => (
                    <li key={index}><a href={`/#${slug}`} className="font-montserrat font-medium p-5 cursor-pointer text-[18px] text-[#0f4c85] hover:text-[#028695]">{label}</a></li>
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
                    {items.map(({label, slug}, index) => (
                    <li key={index} onClick={toggleMobileMenu}><a href={`/#${slug}`} className="font-montserrat font-medium inline-block pb-5 cursor-pointer text-[16px] text-[#0f4c85] hover:text-[#028695]">{label}</a></li>
                  ))}
                </ul>
              </>
          </nav>
      </header>
    )
}