import { defineArrayMember, defineField, defineType } from "sanity";

export const sliderType = defineType({
    name: "slider",
    title: "slider",
    type: "document",
    fields: [
        defineField({
            name: "title",
            title: "title",
            type: "string",
            validation: (rule) => rule.required(),
        }),
        defineField({
            name: "slug",
            title: "slug",
            type: "slug",
            validation: (rule) => rule.required(),
        }),
        defineField({
            name: "description",
            title: "description",
            type: "string",
        }),
        defineField({
            name: "slides",
            title: "slides",
            type: "array",
            of: [
                defineArrayMember({
                    type: "slide"
                })
            ]
        })
    ]
})