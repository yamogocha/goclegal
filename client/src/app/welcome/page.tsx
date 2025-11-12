import { client } from "@/sanity/client";
import { groq } from "next-sanity";
import WelcomeCompnent, { WelcomePage } from "../components/welcome";


const WELCOME_PAGE_QUERY = groq`*[_type == "page" && slug.current == "welcome"][0]`;


export default async function Welcome() {
    const welcomePage = await client.fetch<WelcomePage>(WELCOME_PAGE_QUERY);

    return <WelcomeCompnent {...welcomePage} />
}