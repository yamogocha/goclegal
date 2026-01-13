import {defineField, defineType} from 'sanity'

export const postType = defineType({
  name: 'post',
  title: 'Post',
  type: 'document',
  fields: [
    defineField({
      name: 'title',
      title: "Title",
      type: 'string',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'headline',
      title: "Headline",
      type: 'string',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "subHeadline",
      title: "Sub Headline",
      type: "string",
    }),
    defineField({
      name: 'description',
      title: 'Description',
      type: 'string',
    }),
    defineField({
      name: "date",
      title: "Date",
      type: "datetime"
    }),
    defineField({
      name: 'slug',
      title: "Slug",
      type: 'slug',
      options: {source: 'title'},
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'image',
      title: "Image",
      type: 'image',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'columnLeft',
      title: "Column Left",
      type: 'array',
      of: [{type: 'block'}],
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'columnRight',
      title: "Column Right",
      type: 'array',
      of: [{type: 'block'}],
    }),
    defineField({
      name: 'buttonText',
      title: "Button Text",
      type: 'string',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'phoneNumber',
      title: "Phone Number",
      type: 'string',
      validation: (rule) => rule.required(),
    }),
  ],
})