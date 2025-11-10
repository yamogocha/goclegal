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
            name: "officeInformation",
            title: "Office Information",
            type: "array",
            of: [{ type: "information" }],
            validation: (rule) => rule.required(),
        }),
        defineField({
            name: "legalLinks",
            title: "Legal Links",
            type: "array",
            of: [{ type: "navigationItem" }],
            validation: (rule) => rule.required(),
        }),
        defineField({
            name: "trustLinks",
            title: "Trust Links",
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