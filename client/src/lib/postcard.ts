
import { put } from "@vercel/blob";
import fs from "fs";
import path from "path";
import os from "os";
import fetch from "node-fetch";
import FormData from "form-data";
import { PDFDocument } from "pdf-lib";

const BASE = "https://stage-rest.click2mail.com/molpro";
const ADDRESS_LIST_NAME = "postcard-list";

function authHeader() {
  return "Basic " + Buffer.from(
    `${process.env.C2M_USERNAME}:${process.env.C2M_PASSWORD}`
  ).toString("base64");
}

function extractXmlId(xml: string, step: string): string {
  const m = xml.match(/<id>(\d+)<\/id>/);
  if (!m) throw new Error(JSON.stringify({ step, xml }));
  return m[1];
}

// ---------- MERGE PRINT PDFs ----------
async function mergePdf(frontPath: string, backPath: string) {
  const pdf = await PDFDocument.create();

  const frontDoc = await PDFDocument.load(fs.readFileSync(frontPath));
  const backDoc = await PDFDocument.load(fs.readFileSync(backPath));

  const [frontPage] = await pdf.copyPages(frontDoc, [0]);
  const [backPage] = await pdf.copyPages(backDoc, [0]);

  pdf.addPage(frontPage);
  pdf.addPage(backPage);

  const out = path.join(os.tmpdir(), `postcard-${Date.now()}.pdf`);
  fs.writeFileSync(out, await pdf.save());

  return out;
}

// ---------- CREATE PRINT FILE ----------
export async function generatePostcardCreative() {
  const frontPath = path.join(process.cwd(), "public/postcard-front-1.pdf");
  const backPath = path.join(process.cwd(), "public/postcard-back-1.pdf");

  if (!fs.existsSync(frontPath) || !fs.existsSync(backPath)) {
    throw new Error("Missing postcard PDF templates");
  }

  const mergedPdf = await mergePdf(frontPath, backPath);

  const buffer = fs.readFileSync(mergedPdf);

  const blob = await put(`postcard/${Date.now()}.pdf`, buffer, {
    access: "public",
    contentType: "application/pdf",
  });

  return {
    pdfPath: mergedPdf,
    preview: blob.url,
  };
}

async function resolveDocumentId(pdfPath: string) {
  // ---------- LIST EXISTING ----------
  const listRes = await fetch(`${BASE}/documents?numberOfDocuments=20`, {
    method: "GET",
    headers: {
      Authorization: authHeader(),
      Accept: "application/json",
    },
  });

  const json: any = await listRes.json();

  console.log("[DOC LIST RAW]", json);

  const docs = json?.document || [];

  // ---------- REUSE LOGIC ----------
  // We reuse the MOST RECENT document with correct class
  const existing = docs.find(
    (d: any) => d.documentClass === "Postcard 6 x 11"
  );

  if (existing) {
    console.log("[DOC REUSE]", existing.id);
    return String(existing.id);
  }

  // ---------- CREATE NEW ----------
  console.log("[DOC CREATE NEW]");

  const form = new FormData();
  form.append("file", fs.createReadStream(pdfPath), {
    filename: "postcard.pdf",
    contentType: "application/pdf",
  });
  form.append("name", `postcard-${Date.now()}`);
  form.append("documentClass", "Postcard 6 x 11");
  form.append("productionTime", "Next Day");
  form.append("documentFormat", "PDF");

  const createRes = await fetch(`${BASE}/documents`, {
    method: "POST",
    headers: {
      Authorization: authHeader(),
    },
    body: form as any,
  });

  const xml = await createRes.text();
  console.log("[DOC CREATE RAW]", xml);

  if (!createRes.ok || xml.includes("<status>2</status>")) {
    throw new Error(JSON.stringify({ step: "DOC_CREATE", xml }));
  }

  return extractXmlId(xml, "DOC_CREATE");
}


// ---------- ADDRESS LIST (REUSE OR CREATE) ----------
async function getOrCreateAddressListId(csvPath: string) {
  const listRes = await fetch(`${BASE}/addressLists`, {
    headers: {
      Authorization: authHeader(),
      Accept: "application/json",
    },
  });

  const json: any = await listRes.json();
  console.log("[ADDRESS LIST RAW]", json);

  const lists = json?.addressListsInfo || [];

  const found = lists.find((l: any) => l.name === ADDRESS_LIST_NAME);

  if (found) {
    console.log("[ADDRESS LIST REUSE]", found.id);
    return String(found.id);
  }

  console.log("[ADDRESS LIST CREATE]");

  const lines = fs.readFileSync(csvPath, "utf-8").trim().split("\n");

  const rows = lines.slice(1).map((line) => {
    const [firstName, lastName, addr, city, state, postalCode] =
      line.split(",").map((s) => s.trim());

    return `<address>
<firstName>${firstName}</firstName>
<lastName>${lastName}</lastName>
<address1>${addr}</address1>
<city>${city}</city>
<state>${state}</state>
<postalCode>${postalCode}</postalCode>
<country>UNITED STATES</country>
</address>`;
  });

  const xmlBody = `<addressList>
<name>${ADDRESS_LIST_NAME}</name>
<addressMappingId>1</addressMappingId>
<addresses>
${rows.join("")}
</addresses>
</addressList>`;

  const createRes = await fetch(`${BASE}/addressLists`, {
    method: "POST",
    headers: {
      Authorization: authHeader(),
      "Content-Type": "application/xml",
      Accept: "application/xml",
    },
    body: xmlBody,
  });

  const xml = await createRes.text();
  console.log("[ADDRESS LIST CREATE RESPONSE]", xml);

  if (!createRes.ok || xml.includes("<status>9</status>")) {
    throw new Error(JSON.stringify({ step: "ADDRESS_LIST_CREATE", xml }));
  }

  return extractXmlId(xml, "ADDRESS_LIST_CREATE");
}

// ---------- JOB ----------
async function createJob(documentId: string, addressId: string) {
  const payload = new URLSearchParams({
    documentClass: "Postcard 6 x 11",
    layout: "Double Sided Postcard",
    productionTime: "Next Day",
    color: "Full Color",
    paperType: "White Matte with Gloss UV Finish",
    printOption: "Printing Both sides",
    envelope: " ",
    documentId,
    addressId,
    mailClass: "Standard",
    rtnName: "GOC Legal, P.C.",
    rtnaddress1: "10 Villanova Drive",
    rtnCity: "Oakland",
    rtnState: "CA",
    rtnZip: "94611",
  });

  console.log("[JOB REQUEST]", payload.toString());

  const res = await fetch(`${BASE}/jobs`, {
    method: "POST",
    headers: {
      Authorization: authHeader(),
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/xml",
    },
    body: payload.toString(),
  });

  const xml = await res.text();
  console.log("[JOB RESPONSE]", xml);

  if (
    !res.ok ||
    xml.includes("<status>1</status>") ||
    xml.includes("<status>2</status>")
  ) {
    throw new Error(JSON.stringify({ step: "JOB", xml }));
  }

  return extractXmlId(xml, "JOB");
}

// ---------- SUBMIT ----------
async function submitJob(jobId: string) {
  const payload = new URLSearchParams({
    billingType: "User Credit",
  });

  const res = await fetch(`${BASE}/jobs/${jobId}/submit`, {
    method: "POST",
    headers: {
      Authorization: authHeader(),
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/xml",
    },
    body: payload.toString(),
  });

  const xml = await res.text();
  console.log("[SUBMIT RESPONSE]", xml);

  if (
    !res.ok ||
    xml.includes("<status>1</status>") ||
    xml.includes("<status>2</status>")
  ) {
    throw new Error(JSON.stringify({ step: "SUBMIT", xml }));
  }

  return true;
}

// ---------- MAIN ----------
export async function sendPostcard({ csvPath }: any) {
  const { pdfPath } = await generatePostcardCreative();

  const documentId = await resolveDocumentId(pdfPath);
  const addressId = await getOrCreateAddressListId(csvPath);
  const jobId = await createJob(documentId, addressId);

  await submitJob(jobId);

  return {
    documentId,
    addressId,
    jobId,
    submitted: true,
  };
}

// ---------- CSV ----------
export function createTestCSV() {
  const p = path.join(os.tmpdir(), "postcard.csv");

  fs.writeFileSync(
    p,
    `FirstName,LastName,Address1,City,State,PostalCode
Angel,Yang,10 Villanova Drive,Oakland,CA,94611`
  );

  return p;
}
