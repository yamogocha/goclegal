import { client } from "@/sanity/client";
import { groq } from "next-sanity";
import ServicesComponent, { ServicesPage } from "../components/services";

const SERVICES_PAGE_QUERY = groq`*[_type == "slider" && slug.current == "services"][0]`

export default async function Services() {
    const servicesPage = await client.fetch<ServicesPage>(SERVICES_PAGE_QUERY)
    return <ServicesComponent {...servicesPage}/>
}