import { client } from "@/sanity/client"
import { groq } from "next-sanity"
import FooterComponent, { FooterType } from "../components/footer"

const FOOTER_QUERY = groq`*[_type == "footer" && slug.current == "footer"][0]
{firmInformationTitle, firmInformation[]{label, detail}, resourcesTitle, resourcesLinks[]{label, "slug": reference->slug.current}, servicesTitle, servicesLinks[]{label, "slug": reference->slug.current}, copyright}`

export default async function Footer() {
    const footerQuery = await client.fetch<FooterType>(FOOTER_QUERY)

    return <FooterComponent {...footerQuery} />
}