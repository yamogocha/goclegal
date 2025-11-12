import { client } from "@/sanity/client"
import { groq } from "next-sanity"
import NavigationComponent, { NavigationType } from "../components/navigation"

const NAVIGATION_QUERY = groq`*[_type == "navigation" && slug.current == "navigation"][0]{"logo": logo.asset->url,items[]{label, "slug": reference->slug.current, subNavItems[]{label, "slug": reference->slug.current}}}`

export default async function Navigation() {
    const navigation = await client.fetch<NavigationType>(NAVIGATION_QUERY)

    return <NavigationComponent {...navigation}/>
}