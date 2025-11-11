import Link from "next/link"
import Location from "../assets/location"
import Mail from "../assets/mail"
import Phone from "../assets/phone"
import Facebook from "../assets/facebook"
import LinkedIn from "../assets/linkedIn"
import Instagram from "../assets/instagram"

type FirmInformation = {
    label: string
    detail: string
}
type Link = {
    label: string
    slug: string
}
export type FooterType = {
    firmInformationTitle: string
    firmInformation: FirmInformation[]
    resourcesTitle: string
    resourcesLinks: Link[]
    servicesTitle: string
    servicesLinks: Link[]
    copyright: string
}
export default function FooterComponent(footerQuery: FooterType) {
    const { firmInformationTitle, firmInformation, resourcesTitle, resourcesLinks, servicesTitle, servicesLinks, copyright } = footerQuery

    const renderIcon = (label: string) => {
        switch(label) {
            case "Address":
                return <Location className="size-6 fill-[#B8860B]"/>;
            case "Phone":
                return <Phone className="size-5 fill-[#B8860B]"/>;
            case "Email":
                return <Mail className="size-5 fill-[#B8860B]"/>;
            default:
                return <></>;
        }
    }

    const renderHref = (label: string) => {
        switch(label) {
            case "Address":
                return "https://www.google.com/maps/place/10+Villanova+Dr,+Oakland,+CA+94611/@37.8413599,-122.2150532,15z/data=!3m1!4b1!4m6!3m5!1s0x80857d5fe63209f7:0xfafdf712a2c54c46!8m2!3d37.8413613!4d-122.1966209!16s%2Fg%2F11cpb80wl9?entry=ttu";
            case "Phone":
                return "tel:+15108460928";
            case "Email":
                return "mailto:greg@goclegal.com";
            default:
                return "/";
        }
    }
    
    return (
        <div className="bg-white w-full h-full">
            <div className="max-w-[1200px] m-auto flex flex-wrap justify-between px-5 py-10 lg:py-[80px]">
                <div className="flex flex-col gap-3 pb-6">
                    <span className="text-[24px] lg:text-[30px] font-medium">{firmInformationTitle}</span>
                    {firmInformation.map(({label, detail}, index) => (
                        <div key={index} className="font-montserrat flex items-center gap-3">
                            {renderIcon(label)}
                            <Link href={renderHref(label)} target="_blank" className={`text-[16px] lg:text-[18px] hover:text-[#00305b] ${label == "Name" ? "font-medium text-[22px] lg:text-[24px]" : "underline"}`}>{detail}</Link>
                        </div>
                    ))}
                    <div className="flex items-center space-x-6 pt-6">
                        <Link href="https://www.facebook.com/GOCLegalPC/" target="_blank"><Facebook className="size-9 fill-[#B8860B]"/></Link>
                        <Link href="https://www.linkedin.com/company/goclegal/" target="_blank"><LinkedIn className="size-9 fill-[#B8860B]"/></Link>
                        <Link href="https://www.instagram.com/goclegalpc/" target="_blank"><Instagram className="size-9 fill-[#B8860B]"/></Link>
                    </div>
                </div>
                <div className="flex flex-col gap-3 pb-6">
                    <span className="text-[24px] lg:text-[30px] font-medium">{resourcesTitle}</span>
                    {resourcesLinks.map(({label, slug}, index) => (
                        <Link key={index} href={`/${slug}`} className="font-montserrat text-[16px] lg:text-[18px] underline">{label}</Link>
                    ))}
                </div>
                <div className="flex flex-col gap-3 pb-6">
                    <span className="text-[24px] lg:text-[30px] font-medium">{servicesTitle}</span>
                    {servicesLinks.map(({label, slug}, index) => (
                        <Link key={index} href={`/${slug}`} className="font-montserrat text-[16px] lg:text-[18px] hover:text-[#00305b] underline">{label}</Link>
                    ))}
                </div>
                <div className="basis-full text-[22px] font-medium pt-12 lg:pt-30">{copyright}</div>
            </div>
        </div>
    )
}