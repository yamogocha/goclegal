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
      name: 'description',
      title: 'Description',
      type: 'text',
      rows: 3,
    }),
    defineField({
      name: 'mainImage',
      title: 'Main image',
      type: 'image',
      options: {
        hotspot: true, // Allows cropping and positioning of the image
      },
      fields: [
        defineField({
          name: 'alt',
          title: 'Alternative text',
          type: 'string',
        }),
      ],
    }),
    defineField({
      name: 'h1',
      title: 'Title one',
      type: 'string',
    }),
    defineField({
      name: 'h2',
      title: 'Title two',
      type: 'string',
    }),
    defineField({
      name: 'paragraph',
      title: 'Paragraph',
      type: 'string',
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

