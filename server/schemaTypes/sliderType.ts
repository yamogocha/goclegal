import { defineArrayMember, defineField, defineType } from "sanity";

export const slideType = defineType({
    name: "slide",
    title: "slide",
    type: "object",
    fields: [
        defineField({
            name: "reference",
            title: "Reference",
            type: "reference",
            to: [{ type: "post" }, { type: "page" },{ type: "slider" }]
        }),
        defineField({
            name: "label",
            title: "Label",
            type: "string",
        }),
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
    ]
})

export const sliderType = defineType({
    name: "slider",
    title: "slider",
    type: "document",
    fields: [
        defineField({
            name: "title",
            title: "Title",
            type: "string",
            validation: (rule) => rule.required(),
        }),
        defineField({
            name: "slug",
            title: "Slug",
            type: "slug",
            options: { source: "title" },
            validation: (rule) => rule.required(),
        }),
        defineField({
            name: "headline",
            title: "Headline",
            type: "string",
            validation: (rule) => rule.required(),
        }),
        defineField({
            name: "subHeadline",
            title: "Sub Headline",
            type: "string",
        }),
        defineField({
            name: "slides",
            title: "Slides",
            type: "array",
            of: [
                defineArrayMember({
                    type: "slide"
                })
            ]
        }),
        defineField({
            name: "strip",
            title: "Recognition Strip",
            type: "string",
        }),
    ]
})