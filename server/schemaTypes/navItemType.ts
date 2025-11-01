import { defineField, defineType } from "sanity";

export const navItemType = defineType({
    name: 'navigationItem',
    title: 'Navigation Item',
    type: 'object',
    fields: [
      defineField({
        name: 'label',
        type: 'string',
        title: 'Label',
      }),
      defineField({
        name: 'reference',
        type: 'reference',
        title: 'Reference',
        to: [{ type: 'page' }, { type: 'slider' }, { type: 'post' }], // Example: Link to 'page' or 'post' documents
        description: 'Alternatively, link to a Sanity document.',
      }),
      defineField({
        name: 'subNavItems',
        type: 'array',
        title: 'Sub-navigation Items',
        of: [{ type: 'navigationItem' }], // Allow nested navigation
      }),
    ],
  });