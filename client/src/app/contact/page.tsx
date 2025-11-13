import { client } from "@/sanity/client";
import { groq } from "next-sanity";
import ContactComponent, { ContactType } from "../components/contact";

const CONTACT_QUERY = groq`*[_type == "contact" && slug.current == "contact"][0]{headline, subHeadlines, "slug": slug.current, name, email, phoneNumber, message, buttonText}`
 
export default async function Contact() {
    const contact = await client.fetch<ContactType>(CONTACT_QUERY)

    return <ContactComponent {...contact} />
}