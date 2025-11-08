import { client } from "@/sanity/client";
import { groq } from "next-sanity";
import AwardsAndHonorsComponent, { AwardsAndHonorsPage } from "../components/awardAndHonors";

const AWARDS_AND_HONORS_PAGE_QUERY = groq`*[_type == "slider" && slug.current == "awards-and-honors"][0]{headline, subHeadline, "slug": slug.current, slides[]{"slug": reference->slug.current, paragraph, label, backgroundColor, "image": image.asset->url}}`

export default async function AwardsAndHonors() {
    const awardsAndHonorsPage = await client.fetch<AwardsAndHonorsPage>(AWARDS_AND_HONORS_PAGE_QUERY)
    return <AwardsAndHonorsComponent {...awardsAndHonorsPage}/>
}