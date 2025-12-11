// schemas/page.ts
import { defineField, defineType } from 'sanity';

export const pageType = defineType({
  name: 'page',
  title: 'Page',
  type: 'document',
  fields: [
    defineField({
      name: 'title',
      title: 'Title',
      type: 'string',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'slug',
      title: 'Slug',
      type: 'slug',
      options: {
        source: 'title',
        maxLength: 96,
      },
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'headline',
      title: 'Headline',
      type: 'string',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'subHeadline',
      title: 'Sub Headline',
      type: 'string',
    }),
    defineField({
      name: 'description',
      title: 'Description',
      type: 'string',
    }),
    defineField({
      name: 'image',
      title: 'Image',
      type: 'image',
      options: {
        hotspot: true, // Allows cropping and positioning of the image
      },
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'buttonText',
      title: "Button Text",
      type: 'string',
    }),
    defineField({
      name: 'phoneNumber',
      title: "Phone Number",
      type: 'string',
    }),
    defineField({
      name: 'photo',
      title: 'Photo',
      type: 'image',
      options: {
        hotspot: true, // Allows cropping and positioning of the image
      },
    }),
    defineField({
      name: "body",
      title: "Body Paragraphs",
      type: "array",
      of: [{ type: "block" }, { type: "table" }],
    })
  ],
});

