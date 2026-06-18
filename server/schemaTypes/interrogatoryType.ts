import {
    defineField,
    defineType,
  } from "sanity";
  
  export const interrogatoryType = defineType({
    name:
      "interrogatory",
  
    title:
      "interrogatory",
  
    type: "document",
  
    fields: [
      defineField({
        name: "caseNumber",
        title: "Case Number",
        type: "string",
  
        validation: (Rule) =>
          Rule.required(),
      }),
  
      defineField({
        name: "caseTitle",
        title: "Case Title",
        type: "string",
      }),
  
      defineField({
        name: "plaintiff",
        title: "Plaintiff",
        type: "string",
      }),
  
      defineField({
        name: "defendant",
        title: "Defendant",
        type: "string",
      }),
  
      defineField({
        name:
          "uploadedPdfName",
  
        title:
          "Uploaded PDF Name",
  
        type: "string",
      }),
  
      defineField({
        name:
          "interrogatories",
  
        title:
          "Interrogatories",
  
        type: "array",
  
        of: [
          {
            type: "object",
  
            fields: [
              defineField({
                name: "number",
                type: "string",
              }),
  
              defineField({
                name: "question",
                type: "text",
              }),
  
              defineField({
                name:
                  "plaintiffAttorneyResponse",
  
                type: "text",
              }),
  
              defineField({
                name:
                  "plaintiffClientResponse",
  
                type: "text",
              }),
  
              defineField({
                name:
                  "finalResponse",
  
                type: "text",
              }),
            ],
          },
        ],
      }),
  
      defineField({
        name: "status",
        type: "string",
  
        initialValue:
          "draft",
  
        options: {
          list: [
            {
              title: "Draft",
              value: "draft",
            },
  
            {
              title:
                "Attorney Review",
  
              value:
                "attorney-review",
            },
  
            {
              title:
                "Ready To File",
  
              value:
                "ready-to-file",
            },
  
            {
              title: "Filed",
              value: "filed",
            },
          ],
        },
      }),
  
      defineField({
        name: "createdAt",
        type: "datetime",
      }),
  
      defineField({
        name: "updatedAt",
        type: "datetime",
      }),
    ],
  });