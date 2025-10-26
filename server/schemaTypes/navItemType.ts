import { defineField, defineType } from "sanity";

export const navItemType = defineType({
    name: 'navigationItem',
    title: 'Navigation Item',
    type: 'object',
    fields: [
      defineField({
        name: 'title',
        type: 'string',
        title: 'Title',
      }),
      defineField({
        name: 'link',
        type: 'url',
        title: 'Link URL',
        description: 'The URL this navigation item links to.',
      }),
      defineField({
        name: 'reference',
        type: 'reference',
        title: 'Reference',
        to: [{ type: 'page' }, { type: 'post' }], // Example: Link to 'page' or 'post' documents
        description: 'Alternatively, link to a Sanity document.',
      }),
      defineField({
        name: 'children',
        type: 'array',
        title: 'Sub-navigation Items',
        of: [{ type: 'navigationItem' }], // Allow nested navigation
      }),
    ],
  });