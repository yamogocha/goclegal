import { defineField, defineType } from "sanity";

export const slideType = defineType({
    name: "slide",
    title: "slide",
    type: "object",
    fields: [
        defineField({
            name: "paragraph",
            title: "Paragraph",
            type: "string",
        }),
        defineField({
            name: "backgroundColor",
            title: "Background Color",
            type: "string",
        }),
        defineField({
            name: "image",
            title: "Image",
            type: "image",
            options: {
                hotspot: true, //be able to crop and position
            }
        }),
        defineField({
            name: "label",
            title: "Label",
            type: "string",
        }),
    ]
})