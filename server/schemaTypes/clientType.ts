import { defineField, defineType } from "sanity";

export const clientType = defineType({
    name: "clientType",
    title: "Client",
    type: "document",
    fields: [
        // Client identity
        defineField({ name: "clientId", title: "Client ID", type: "string", readOnly: true, hidden: true, validation: Rule => Rule.required() }),
        defineField({ name: "clientAccessToken", title: "Client Access Token", type: "string", hidden: true, validation: Rule => Rule.required() }),
        defineField({ name: "clientName", title: "Client Name", type: "string", validation: Rule => Rule.required() }),
        defineField({ name: "clientPhone", title: "Client Phone", type: "string", validation: Rule => Rule.required() }),
        defineField({ name: "clientDob", title: "Date of Birth", type: "date", validation: Rule => Rule.required() }),
        defineField({ name: "clientEmail", title: "Client Email", type: "string", validation: Rule => Rule.required() }),
        defineField({ name: "clientSsnLast4", title: "Last 4 of SSN", type: "string", validation: Rule => Rule.required().length(4) }),

        // Auto insurance
        defineField({ name: "clientAutoInsurance", title: "Auto Insurance", type: "string", validation: Rule => Rule.required() }),
        defineField({ name: "clientPolicyNumber", title: "Auto Policy Number", type: "string", validation: Rule => Rule.required() }),
        defineField({ name: "clientClaimNumber", title: "Auto Claim Number", type: "string", validation: Rule => Rule.required() }),

        // Health insurance
        defineField({ name: "clientHealthInsurance", title: "Health Insurance", type: "string", validation: Rule => Rule.required() }),
        defineField({ name: "clientHealthInsuranceMemberNumber", title: "Health Insurance Member Number", type: "string", validation: Rule => Rule.required() }),

        // Medical
        defineField({ name: "injuries", title: "Description of Injuries", type: "text", validation: Rule => Rule.required() }),
        defineField({ name: "medicalCare", title: "Description of Medical Care Received", type: "text", validation: Rule => Rule.required() }),
        defineField({ name: "medicalProvider", title: "Name and Address of Medical Provider", type: "text", validation: Rule => Rule.required() }),

        // Documents
        defineField({ name: "driverLicense", title: "California Driver License", type: "file", options: { accept: "image/*,.pdf" }, validation: Rule => Rule.required() }),
        defineField({ name: "healthInsuranceCards", title: "Health Insurance Cards", type: "file", options: { accept: "image/*,.pdf" }, validation: Rule => Rule.required() }),
        defineField({ name: "declarationPage", title: "Client’s Declaration Page", type: "file", options: { accept: "image/*,.pdf" } }),

        // Collision
        defineField({ name: "collisionLocation", title: "Collision Location", type: "string", validation: Rule => Rule.required() }),
        defineField({ name: "collisionDate", title: "Collision Date", type: "date", validation: Rule => Rule.required() }),
        defineField({ name: "collisionDescription", title: "Collision Description", type: "text" }),
        defineField({ name: "policeDepartment", title: "Police Department", type: "string" }),
        defineField({ name: "policeReportNumber", title: "Police Report Number", type: "string" }),

        // Defendant
        defineField({ name: "defendantName", title: "Defendant Name", type: "string" }),
        defineField({ name: "defendantInsurance", title: "Defendant Insurance", type: "string" }),
        defineField({ name: "defendantAdjuster", title: "Defendant Adjuster", type: "string" }),
        defineField({ name: "defendantPolicyNumber", title: "Defendant Policy Number", type: "string" }),
        defineField({ name: "defendantClaimNumber", title: "Defendant Claim Number", type: "string" }),

        // Intake
        defineField({
            name: "intakeStatus",
            title: "Intake Status",
            type: "string",
            initialValue: "not_started",
            options: {
                list: [
                    { title: "Not Started", value: "not_started" },
                    { title: "Link Sent", value: "link_sent" },
                    { title: "In Progress", value: "in_progress" },
                    { title: "Submitted", value: "submitted" },
                    { title: "Reviewed", value: "reviewed" },
                ],
            },
        }),
        defineField({ name: "intakeStartedAt", title: "Intake Started At", type: "datetime" }),
        defineField({ name: "intakeSubmittedAt", title: "Intake Submitted At", type: "datetime" }),

        // Communication preferences
        defineField({
            name: "communicationPreferences",
            title: "Communication Preferences",
            type: "object",
            fields: [
                defineField({ name: "smsEnabled", title: "SMS Enabled", type: "boolean", initialValue: true }),
                defineField({ name: "emailEnabled", title: "Email Enabled", type: "boolean", initialValue: true }),
                defineField({
                    name: "preferredMethod",
                    title: "Preferred Method",
                    type: "string",
                    initialValue: "sms",
                    options: {
                        list: [
                            { title: "SMS", value: "sms" },
                            { title: "Email", value: "email" },
                            { title: "Both", value: "both" },
                        ],
                    },
                }),
            ],
        }),

        // SMS consent
        defineField({
            name: "smsConsent",
            title: "SMS Consent",
            type: "object",
            fields: [
                defineField({ name: "consented", title: "Consented", type: "boolean", initialValue: false }),
                defineField({ name: "consentedAt", title: "Consented At", type: "datetime" }),
                defineField({
                    name: "method",
                    title: "Consent Method",
                    type: "string",
                    options: {
                        list: [
                            { title: "Phone / Verbal", value: "phone" },
                            { title: "Written", value: "written" },
                            { title: "Website", value: "website" },
                        ],
                    },
                }),
                defineField({ name: "source", title: "Consent Source", type: "string" }),
                defineField({ name: "collectedBy", title: "Collected By", type: "string" }),
                defineField({ name: "consentText", title: "Consent Language Used", type: "text" }),
            ],
        }),

        // Communication history
        defineField({
            name: "communications",
            title: "Communications",
            type: "array",
            of: [{
                type: "object",
                fields: [
                    defineField({
                        name: "direction",
                        title: "Direction",
                        type: "string",
                        options: {
                            list: [
                                { title: "Outbound", value: "outbound" },
                                { title: "Inbound", value: "inbound" },
                            ]
                        },
                    }),
                    defineField({
                        name: "channel",
                        title: "Channel",
                        type: "string",
                        options: {
                            list: [
                                { title: "SMS", value: "sms" },
                                { title: "Email", value: "email" },
                            ]
                        },
                    }),
                    defineField({
                        name: "type",
                        title: "Message Type",
                        type: "string",
                        options: {
                            list: [
                                { title: "General", value: "general" },
                                { title: "Intake Link", value: "intake_link" },
                                { title: "SMS Consent Confirmation", value: "sms_consent_confirmation" },
                                { title: "Intake Reminder", value: "intake_reminder" },
                                { title: "Attorney Message", value: "attorney_message" },
                                { title: "Document Request", value: "document_request" },
                                { title: "Contract", value: "contract" },
                                { title: "Treatment Reminder", value: "treatment_reminder" },
                                { title: "Appointment Reminder", value: "appointment_reminder" },
                                { title: "System", value: "system" },
                            ]
                        },
                    }),
                    defineField({ name: "message", title: "Message", type: "text" }),
                    defineField({
                        name: "status",
                        title: "Status",
                        type: "string",
                        options: {
                            list: [
                                { title: "Queued", value: "queued" },
                                { title: "Sent", value: "sent" },
                                { title: "Delivered", value: "delivered" },
                                { title: "Failed", value: "failed" },
                                { title: "Received", value: "received" },
                            ]
                        },
                    }),
                    defineField({ name: "providerMessageId", title: "Provider Message ID", type: "string" }),
                    defineField({ name: "sentAt", title: "Sent At", type: "datetime" }),
                    defineField({ name: "deliveredAt", title: "Delivered At", type: "datetime" }),
                ],
            }],
        }),
        defineField({ name: "lastCommunicationAt", title: "Last Communication At", type: "datetime" }),
        defineField({ name: "lastInboundMessageAt", title: "Last Inbound Message At", type: "datetime" }),
        defineField({ name: "lastOutboundMessageAt", title: "Last Outbound Message At", type: "datetime" }),

        // Metadata
        defineField({ name: "createdAt", title: "Created At", type: "datetime", initialValue: () => new Date().toISOString() }),
        defineField({ name: "updatedAt", title: "Updated At", type: "datetime" }),
    ],
    preview: {
        select: { title: "clientName", subtitle: "clientPhone" },
    },
});