import { defineField, defineType } from "sanity";

export const interrogatoryType = defineType({
  name: "interrogatory",
  title: "Interrogatory",
  type: "document",
  fields: [
    defineField({ name: "clientAccessToken", title: "Client Access Token", type: "string" }),
    defineField({ name: "caseNumber", title: "Case Number", type: "string", validation: (Rule) => Rule.required() }),
    defineField({
      name: "metadata",
      title: "Metadata",
      type: "object",
      fields: [
        defineField({ name: "caseNumber", type: "string" }),
        defineField({ name: "caseTitle", type: "string" }),
        defineField({ name: "plaintiff", type: "string" }),
        defineField({ name: "defendant", type: "string" }),
        defineField({ name: "respondingParty", type: "string" }),
        defineField({ name: "setNumber", type: "string" }),
        defineField({ name: "uploadedPdfName", type: "string" }),
      ],
    }),
    defineField({
      name: "interrogatoryType",
      title: "Interrogatory Type",
      type: "string",
      options: { list: [{ title: "Special", value: "special" }, { title: "Form", value: "form" }] },
    }),
    defineField({
      name: "interrogatories",
      title: "Interrogatories",
      type: "array",
      of: [{
        type: "object",
        fields: [
          defineField({ name: "number", type: "string" }),
          defineField({ name: "question", type: "text" }),
          defineField({ name: "questionLines", type: "array", of: [{ type: "string" }] }),
          defineField({ name: "plaintiffAttorneyResponse", type: "text" }),
          defineField({ name: "plaintiffClientResponse", type: "text" }),
          defineField({ name: "finalResponse", type: "text" }),
        ],
      }],
    }),
    defineField({
      name: "status",
      type: "string",
      initialValue: "draft",
      options: {
        list: [
          { title: "Draft", value: "draft" },
          { title: "Attorney Review", value: "attorney-review" },
          { title: "Ready To File", value: "ready-to-file" },
          { title: "Filed", value: "filed" },
        ],
      },
    }),
    defineField({ name: "createdAt", type: "datetime" }),
    defineField({ name: "updatedAt", type: "datetime" }),
  ],
});