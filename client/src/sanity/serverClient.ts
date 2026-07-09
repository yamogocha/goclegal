import { createClient } from "next-sanity";

export const serverClient = createClient({
    projectId: process.env.SANITY_PROJECT_ID!,
    dataset: process.env.SANITY_DATASET!,
    apiVersion: "2024-01-01",
    useCdn: false, // MUST be false for mutations
    token: process.env.SANITY_API_TOKEN!, // 👈 write token
});