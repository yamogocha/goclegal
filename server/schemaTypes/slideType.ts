import { defineField, defineType } from "sanity";

export const slideType = defineType({
    name: "slide",
    title: "slide",
    type: "object",
    fields: [
        defineField({
            name: "paragraph",
            title: "paragraph",
            type: "string",
        }),
        defineField({
            name: "image",
            title: "image",
            type: "image",
            options: {
                hotspot: true, //be able to crop and position
            }
        }),
        defineField({
            name: "label",
            title: "label",
            type: "string",
        }),
    ]
})