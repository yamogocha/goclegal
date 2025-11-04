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
      name: 'mainImage',
      title: 'Main image',
      type: 'image',
      options: {
        hotspot: true, // Allows cropping and positioning of the image
      },
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'h1',
      title: 'Title one',
      type: 'string',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'paragraph',
      title: 'Paragraph',
      type: 'string',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'btnNumber',
      title: 'Phone number button',
      type: 'string',
    }),
    defineField({
      name: 'btnText',
      title: 'Call now button',
      type: 'string',
    })
  ],
});

