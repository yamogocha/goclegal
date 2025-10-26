

export default async function Nav() {
    return(
        <header className="z-10 sticky top-0 bg-white shadow-md shadow-[#14365c1a]">
          <nav className="max-w-[1200px] m-auto flex justify-between items-center p-5 lg:px-0">
              <a href="" hrefLang="en"
                  className="bg-[url('https://res.cloudinary.com/dre1b2zmh/image/upload/v1705944655/goclegal/cropped-horizontal-logo.png')] bg-cover bg-center w-[280px] h-[75px] lg:w-[300px] lg:h-[80px]"></a>
              <ul className="bg-white hidden lg:flex flex-row list-none">
                  <li><a href="#home" className="p-5 cursor-pointer text-[16px] text-[#0f4c85] hover:text-[#028695]">HOME</a>
                  </li>
                  <li><a href="#about-us"
                          className="p-5 cursor-pointer text-[16px] text-[#0f4c85] hover:text-[#028695]">ABOUT US
                      </a></li>
                  <li><a href="#practice-areas"
                          className="p-5 cursor-pointer text-[16px] text-[#0f4c85] hover:text-[#028695]">PRACTICE AREAS</a>
                  </li>
                  <li><a href="#our-mission"
                          className="p-5 cursor-pointer text-[16px] text-[#0f4c85] hover:text-[#028695]">OUR
                          MISSION & VALUES
                      </a></li>
                  <li><a href="#attorneys"
                          className="p-5 cursor-pointer text-[16px] text-[#0f4c85] hover:text-[#028695]">ATTORNEYS
                      </a></li>
                  <li><a href="#contact" className="p-5 cursor-pointer text-[16px] text-[#0f4c85] hover:text-[#028695]"
                          >CONTACT
                      </a></li>
              </ul>
              {/* <div id="mobile-menu" className="cursor-pointer block z-10 py-3 lg:hidden" onClick="toggleMobileMenu()">
                  <span id="bar-one"
                      className="transition duration-500 ease-in-out w-[35px] h-[3px] m-1 bg-[#00305B] rounded block"></span>
                  <span id="bar-two"
                      className="transition duration-500 ease-in-out w-[35px] h-[3px] m-1 bg-[#00305B] rounded block"></span>
                  <span id="bar-three"
                      className="transition duration-500 ease-in-out w-[35px] h-[3px] m-1 bg-[#00305B] rounded block"></span>
              </div>
              <div id="mobile-overlay" className="w-full h-screen z-5 absolute top-0 right-0 p-5 bg-[#000000b5] hidden" />
              <ul id="mobile-nav"
                  className="transition duration-500 ease-in-out list-none bg-white rounded-bl-md flex flex-col absolute top-0 right-0 opacity-0 block p-10 lg:hidden">
                  <li onClick="toggleMobileMenu()"><a href="#home"
                          className="inline-block p-5 py-3 cursor-pointer text-[14px] text-[#0f4c85] hover:text-[#028695]">HOME</a>
                  </li>
                  <li onClick="toggleMobileMenu()"><a href="#about-us"
                          className="inline-block p-5 py-3 cursor-pointer text-[14px] text-[#0f4c85] hover:text-[#028695]">ABOUT
                          US
                      </a></li>
                  <li onClick="toggleMobileMenu()"><a href="#practice-areas"
                          className="inline-block p-5 py-3 cursor-pointer text-[14px] text-[#0f4c85] hover:text-[#028695]">PRACTICE
                          AREAS</a></li>
                  <li onClick="toggleMobileMenu()"><a href="#our-mission"
                          className="inline-block p-5 py-3 cursor-pointer text-[14px] text-[#0f4c85] hover:text-[#028695]">OUR
                          MISSION &
                          VALUES
                      </a></li>
                  <li onClick="toggleMobileMenu()"><a href="#attorneys"
                          className="inline-block p-5 py-3 cursor-pointer text-[14px] text-[#0f4c85] hover:text-[#028695]">ATTORNEYS
                      </a></li>
                  <li onClick="toggleMobileMenu()"><a href="#contact"
                          className="inline-block p-5 py-3 cursor-pointer text-[14px] text-[#0f4c85] hover:text-[#028695]">CONTACT
                      </a></li>
              </ul> */}
          </nav>
      </header>
    )
}