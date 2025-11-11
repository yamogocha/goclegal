import { defineField, defineType } from "sanity";

export const information = defineType({
    name: "information",
    title: "Information",
    type: "object",
    fields: [
        defineField({
            name: "label",
            title: "Label",
            type: "string",
            validation: (rule) => rule.required(),
        }),
        defineField({
            name: "detail",
            title: "Detail",
            type: "string",
            validation: (rule) => rule.required(),
        }),
    ]
})

export const footerType = defineType({
    name: "footer",
    title: "Footer",
    type: "document",
    fields:[
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
            options: {
                source: "title",
            },
            validation: (rule) => rule.required(),
        }),
        defineField({
            name: "firmInformationTitle",
            title: "Firm Information Title",
            type: "string",
            validation: (rule) => rule.required(),
        }),
        defineField({
            name: "firmInformation",
            title: "Firm Information",
            type: "array",
            of: [{ type: "information" }],
            validation: (rule) => rule.required(),
        }),
        defineField({
            name: "resourcesTitle",
            title: "Resources Legal Guides",
            type: "string",
            validation: (rule) => rule.required(),
        }),
        defineField({
            name: "resourcesLinks",
            title: "Resources Links",
            type: "array",
            of: [{ type: "navigationItem" }],
            validation: (rule) => rule.required(),
        }),
        defineField({
            name: "servicesTitle",
            title: "Services Title",
            type: "string",
            validation: (rule) => rule.required(),
        }),
        defineField({
            name: "servicesLinks",
            title: "Services Links",
            type: "array",
            of: [{ type: "navigationItem" }]
        }),
        defineField({
            name: "copyright",
            title: "Copyright",
            type: "string",
        }),
    ]
})