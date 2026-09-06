import Docxtemplater from "docxtemplater";
import PizZip from "pizzip";

export const NOTICE_TYPES = {
    representation: { title: "Notice of Representation", filename: "notice-of-representation.docx" },
    preservation: { title: "Evidence Preservation", filename: "preservation-of-evidence.docx" },
    uberPreservation: { title: "Uber Evidence Preservation", filename: "uber-evidence-preservation.docx" }
} as const;

export type NoticeId = keyof typeof NOTICE_TYPES;

export type NoticeClient = {
    clientName?: string | null;
    clientPronoun?: string | null;
    clientEmail?: string | null;
    clientPhone?: string | null;
    collisionDate?: string | null;
    collisionTime?: string | null;
    collisionLocation?: string | null;
    collisionDescription?: string | null;
    injuries?: string | null;
    defendantName?: string | null;
    defendantInsurance?: string | null;
    defendantAdjuster?: string | null;
    defendantPolicyNumber?: string | null;
    defendantClaimNumber?: string | null;
    defendantCdl?: string | null;
    defendantDob?: string | null;
    defendantEmail?: string | null;
    defendantAddress?: string | null;
    defendantInsuranceEmail?: string | null;
    defendantInsuranceAddress?: string | null;
    uberReferenceNumber?: string | null;
};

const text = (value: unknown): string => String(value ?? "");

const formatDate = (value?: string | null): string => {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return text(value);

    return date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }).toUpperCase();
};
const getLastName = (name?: string | null): string => { if (!name) return ""; const parts = name.trim().split(/\s+/); return parts[parts.length - 1] };
export function getClientHonorific(pronoun?: string): string { return pronoun === "her" ? "Ms." : "Mr." }

const getPlaceholders = (client: NoticeClient): Record<string, string> => ({
    "CLIENT NAME": text(client.clientName),
    "CLIENT HONORIFIC": text(getClientHonorific(client.clientPronoun ?? "")),
    "CLIENT PRONOUN": text(client.clientPronoun),
    "CLIENT EMAIL": text(client.clientEmail),
    "CLIENT PHONE": text(client.clientPhone),
    "CLIENT LAST NAME": getLastName(client.clientName),
    "COLLISION DATE": formatDate(client.collisionDate),
    "COLLISION TIME": text(client.collisionTime),
    "COLLISION LOCATION": text(client.collisionLocation),
    "COLLISION DESCRIPTION": text(client.collisionDescription),
    "DESCRIPTION OF INJURIES": text(client.injuries),
    "DEFENDANT NAME": text(client.defendantName),
    "DEFENDANT INSURANCE": text(client.defendantInsurance),
    "DEFENDANT ADJUSTER": text(client.defendantAdjuster),
    "DEFENDANT POLICY NUMBER": text(client.defendantPolicyNumber),
    "DEFENDANT CLAIM NUMBER": text(client.defendantClaimNumber),
    "DEFENDANT CDL": text(client.defendantCdl),
    "DEFENDANT DOB": formatDate(client.defendantDob),
    "DEFENDANT EMAIL": text(client.defendantEmail),
    "DEFENDANT ADDRESS": text(client.defendantAddress),
    "DEFENDANT INSURANCE EMAIL": text(client.defendantInsuranceEmail),
    "DEFENDANT INSURANCE ADDRESS": text(client.defendantInsuranceAddress),
    "UBER REFERENCE NUMBER": text(client.uberReferenceNumber),
    DATE: formatDate(new Date().toISOString()),
});

export async function buildNoticeDocx(
    noticeId: NoticeId,
    client: NoticeClient,
    requestUrl: string,
): Promise<Buffer> {
    const notice = NOTICE_TYPES[noticeId];
    const templateUrl = new URL(`/notices/${notice.filename}`, requestUrl);
    const response = await fetch(templateUrl);
    if (!response.ok) { throw new Error(`Notice template not found: ${templateUrl.pathname} (${response.status})`) }
    const templateBuffer = Buffer.from(await response.arrayBuffer());
    const zip = new PizZip(templateBuffer);

    const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true, delimiters: { start: "[", end: "]" } });

    doc.render(getPlaceholders(client));

    return Buffer.from(
        doc.getZip().generate({
            type: "nodebuffer",
        }),
    );
}