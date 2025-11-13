import { defineField, defineType } from "sanity";

export const contactType = defineType({
    name: "contact",
    title: "Contact",
    type: "document",
    fields: [
        defineField({
            name: "title",
            title: "Title",
            type: "string",
            validation: rule => rule.required()
        }),
        defineField({
            name: "headline",
            title: "Headline",
            type: "string",
            validation: rule => rule.required()
        }),
        defineField({
            name: "subHeadlines",
            title: "Sub Headlines",
            type: "array",
            of: [{ type: "string" }],
            validation: rule => rule.required()
        }),
        defineField({
            name: "slug",
            title: "Slug",
            type: "slug",
            options: { source: "title" },
            validation: rule => rule.required()
        }),
        defineField({
            name: "name",
            title: "Name",
            type: "string",
            validation: rule => rule.required()
        }),
        defineField({
            name: "email",
            title: "Email",
            type: "string",
            validation: rule => rule.required()
        }),
        defineField({
            name: "buttonText",
            title: "Button Text",
            type: "string",
            validation: rule => rule.required()
        }),
        defineField({
            name: "phoneNumber",
            title: "Phone Number",
            type: "string",
            validation: rule => rule.required()
        }),
        defineField({
            name: "message",
            title: "Message",
            type: "text",
            validation: rule => rule.required().min(10)
        }),
    ]
})