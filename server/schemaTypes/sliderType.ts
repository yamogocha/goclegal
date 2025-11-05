import { defineArrayMember, defineField, defineType } from "sanity";

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
            validation: (rule) => rule.required(),
        }),
        defineField({
            name: "description",
            title: "Description",
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