import { defineField, defineType } from "sanity";

export const storyAssetType = defineType({
    name: "storyAsset",
    title: "Story Asset",
    type: "document",

    fields: [
        defineField({
            name: "title",
            type: "string",
            validation: Rule => Rule.required(),
        }),

        defineField({
            name: "slug",
            type: "slug",
            options: {
                source: "title",
            },
        }),

        defineField({
            name: "category",
            type: "string",
            options: {
                list: [
                    { title: "Accident", value: "accident" },
                    { title: "Insurance", value: "insurance" },
                    { title: "Medical", value: "medical" },
                    { title: "Evidence", value: "evidence" },
                ],
            },
        }),

        defineField({
            name: "tags",
            type: "array",
            of: [{ type: "string" }],
        }),

        defineField({
            name: "image",
            type: "image",
            options: {
                hotspot: true,
            },
        }),

        defineField({
            name: "prompt",
            type: "text",
        }),

        defineField({
            name: "orientation",
            type: "string",
            initialValue: "9:16",
        }),

        defineField({
            name: "isReusable",
            type: "boolean",
            initialValue: true,
        }),
    ],
});