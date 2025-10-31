// schemas/documents/navigation.ts
// import { GrNavigate } from "react-icons/gr";
import { defineField, defineType } from 'sanity';


export const navType = defineType({
  name: 'navigation',
  title: 'Navigation',
  type: 'document',
//   icon: GrNavigate,
  fields: [
    defineField({
      name: "title",
      type: "string",
      title: "Title",
      description: "A descriptive title for this navigation menu (e.g., 'Main Navigation', 'Footer Navigation')",
    }),
    defineField({
      name: 'slug',
      type: 'slug',
      title: "Slug",
      options: {
        source: 'title',
        maxLength: 96,
      },
      description: "A unique identifier for this navigation menu (e.g., 'mainNav', 'footerNav')",
    }),
    defineField({
      name: "logo",
      title: "Logo",
      type: "image",
      options: {
        hotspot: true,
      }
    }),
    defineField({
      name: "items",
      type: "array",
      title: "Navigation Items",
      of: [{ type: 'navigationItem' }], // Reference to a 'navigationItem' object type
    }),
  ],
});

