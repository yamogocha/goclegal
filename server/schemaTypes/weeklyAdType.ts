import { defineField, defineType } from "sanity";

export const weeklyAdType = defineType({
    name: "weeklyAd",
    title: "Weekly Ad",
    type: "document",

    fields: [
        defineField({
            name: "status",
            title: "Status",
            type: "string",
            initialValue: "pending",
            options: {
                list: [
                    { title: "Pending", value: "pending" },
                    { title: "Completed", value: "completed" },
                    { title: "Failed", value: "failed" },
                ],
            },
            validation: Rule => Rule.required(),
        }),

        defineField({
            name: "title",
            title: "Blog Title",
            type: "string",
            validation: Rule => Rule.required(),
        }),

        defineField({
            name: "slug",
            title: "Slug",
            type: "string",
            validation: Rule => Rule.required(),
        }),

        defineField({
            name: "script",
            title: "HeyGen Script",
            type: "text",
            rows: 8,
            validation: Rule => Rule.required().max(840),
        }),

        defineField({
            name: "message",
            title: "Caption",
            type: "text",
            validation: Rule => Rule.required(),
        }),

        defineField({
            name: "hashtags",
            title: "Hashtags",
            type: "array",
            of: [{ type: "string" }],
        }),

        defineField({
            name: "imageUrl",
            title: "Image URL",
            type: "url",
            validation: Rule => Rule.required(),
        }),

        defineField({
            name: "heygenVideoId",
            title: "HeyGen Video ID",
            type: "string",
        }),

        defineField({
            name: "videoUrl",
            title: "Blob Video URL",
            type: "url",
        }),

        defineField({
            name: "instagramPostId",
            title: "Instagram Post ID",
            type: "string",
        }),

        defineField({
            name: "facebookPostId",
            title: "Facebook Post ID",
            type: "string",
        }),
        defineField({
            name: "instagramReelId",
            title: "Instagram Reel ID",
            type: "string",
        }),

        defineField({
            name: "facebookReelId",
            title: "Facebook Reel ID",
            type: "string",
        }),

        defineField({
            name: "youtubeVideoId",
            title: "YouTube Video ID",
            type: "string",
        }),

        defineField({
            name: "gbpMediaName",
            title: "GBP Media Name",
            type: "string",
        }),

        defineField({
            name: "error",
            title: "Error",
            type: "text",
        }),

        defineField({
            name: "createdAt",
            title: "Created At",
            type: "datetime",
            initialValue: () => new Date().toISOString(),
        }),

        defineField({
            name: "completedAt",
            title: "Completed At",
            type: "datetime",
        }),
    ],

    preview: {
        select: {
            title: "title",
            status: "status",
            subtitle: "slug",
        },
        prepare({ title, status, subtitle }) {
            return {
                title,
                subtitle: `${status} • ${subtitle}`,
            };
        },
    },
});