import { SectionType, AlignmentType, BorderStyle, Document, Footer, HeightRule, Packer, PageNumber, Paragraph, Table, TableCell, TableLayoutType, TableRow, TextRun, Textbox, VerticalAlign, WidthType } from "docx";
import { buildCourtTitle, buildFormInterrogatoryIntroLines, buildInterrogatoryResponseLines, buildIntroLines, buildPlaintiffAttorneyLines, buildPlaintiffCaptionLines, buildPlaintiffCaptionRightLines, buildProofOfServiceLines, buildServiceListLines } from "./tempates";
import { getOpenAI, finalResponsePrompt } from "@/lib/openai";

const openai = getOpenAI();

export async function createFinalResponse(params: {
  question: string;
  attorneyResponse: string;
  clientResponse: string;
}) {
  const resp = await openai.responses.create({
    model: "gpt-5",
    instructions: `You are an experienced California plaintiff attorney.
    You draft polished interrogatory responses.
    Preserve objections.
    Do not invent facts.
    Maintain the attorney's writing style and tone.
    `,
    input: finalResponsePrompt({
      question: params.question,
      attorneyResponse: params.attorneyResponse,
      clientResponse: params.clientResponse,
    }),
  });

  return resp.output_text?.trim() || "";
}

let pdfjsLib: any;

// ======================================================
// CONFIG
// ======================================================

const FONT = "Times New Roman";
const BODY_FIRST_LINE_INDENT = 360;
const PLEADING_VISUAL_WIDTH = 100;
const PLEADING_FIRST_LINE_WIDTH = 94;

type PageLayout = { rowsPerPage: number; rowHeight: number; lineHeight: number };

const PLEADING_LAYOUT: PageLayout = { rowsPerPage: 28, rowHeight: 475, lineHeight: 235 };

const PROOF_OF_SERVICE_LAYOUT: PageLayout = { rowsPerPage: 28, rowHeight: 435, lineHeight: 215 };

export type Interrogatory = {
  number: string;
  question: string;
  questionLines?: string[];
};

export type FormInterrogatory = {
  number: string;
  question: string;
  questionLines: string[];
};

export type CaseMetadata = {
  caseNumber: string;
  plaintiffName: string;
  defendantName: string;
  setNumber: string;
  title: string;
  serviceDate: string
  defendantAttorney: string;
  defendantAttorneyAddress: string;
  defendantAttorneyEmail: string;
};

export type PleadingLine = {
  text: string;
  center?: boolean;
  right?: boolean;
  bold?: boolean;
  firstLine?: boolean;
  indent?: boolean;
  stacked?: boolean;
  runs?: { text: string; bold?: boolean }[];
  captionLeftText?: string;
  captionLeftStacked?: boolean;
  captionRightText?: string;
  captionRightStacked?: boolean;
  captionRightBold?: boolean;
};

// PDFJS
async function getPdfJs() {
  if (pdfjsLib) return pdfjsLib;

  const mod = await import(
    /* webpackIgnore: true */
    "pdfjs-dist/legacy/build/pdf.js"
  );

  pdfjsLib = (mod as any).default || mod;

  return pdfjsLib;
}

// HELPERS
const signatureDate = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

function normalize(text: string) {
  return text.replace(/\s+/g, " ").replace(/[‐-–—]/g, "-").trim();
}

function isDefinitionsLine(text: string) {
  const lower = text.toLowerCase();

  return (
    lower.includes("definitions & instructions") ||
    lower.includes('"incident"') ||
    lower.includes('"subject area"') ||
    lower.includes('"vegetation debris"') ||
    lower.includes('"overgrown trees"') ||
    lower.includes('"you" and "your"') ||
    lower.includes('"identify"') ||
    lower.includes('"person"') ||
    lower.includes('"document"') ||
    lower.includes('"health care provider"') ||
    lower.includes('"collateral source payments"')
  );
}

function isJunkLine(text: string) {
  if (!text) return true;
  if (/^\d+$/.test(text)) return true;

  const blocked = [
    "DEFENDANT CITY OF OAKLAND’S SPECIAL INTERROGATORIES TO",
    "PLAINTIFF DENISE WINKELSTEIN, SET ONE",
    "CITY OF OAKLAND; AND DOES 1",
    "THROUGH 5, INCLUSIVE",
    "Complaint Filed:",
    "Trial Date:",
    "EXEMPT PER GOV. CODE SECTION 6103",
    "25CV153765",
    "SET ONE",
    "Defendants.",
    "PROOF OF SERVICE",
  ];

  return blocked.some((x) => text.includes(x));
}

function buildFooter(title: string) {
  return new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 0, line: 180 },
        children: [
          new TextRun({
            children: [PageNumber.CURRENT],
            size: 20,
            font: FONT,
          }),
        ],
      }),

      new Table({
        layout: TableLayoutType.FIXED,
        width: { size: 100, type: WidthType.PERCENTAGE },
        alignment: AlignmentType.CENTER,

        borders: {
          top: { style: BorderStyle.SINGLE, size: 6, color: "000000" },
          bottom: { style: BorderStyle.NONE },
          left: { style: BorderStyle.NONE },
          right: { style: BorderStyle.NONE },
          insideHorizontal: { style: BorderStyle.NONE },
          insideVertical: { style: BorderStyle.NONE },
        },

        rows: [
          new TableRow({
            children: [
              new TableCell({
                borders: {
                  top: { style: BorderStyle.NONE },
                  bottom: { style: BorderStyle.NONE },
                  left: { style: BorderStyle.NONE },
                  right: { style: BorderStyle.NONE },
                },

                children: [
                  new Paragraph({
                    alignment: AlignmentType.CENTER,

                    children: [
                      new TextRun({
                        text: title,
                        size: 20,
                        font: FONT,
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });
}

// PAGINATE
function paginate(lines: PleadingLine[], rowsPerPage: number) {
  const pages: PleadingLine[][] = [];
  for (let i = 0; i < lines.length; i += rowsPerPage) {
    pages.push(lines.slice(i, i + rowsPerPage));
  }
  return pages;
}

function buildCaptionLineOverlay() {
  const line = Array(25).fill("│").join("\n");
  return new Textbox({
    children: [
      new Paragraph({
        spacing: { before: .1, after: .1 },
        children: [new TextRun({ text: line })],
      }),
    ],
    style: {
      width: ".1pt",
      height: "135pt",
      position: "absolute",
      left: "267pt",
      top: "260pt",
      wrapStyle: "none",
    },
  });
}

function buildRows(lines: PleadingLine[], layout: PageLayout) {
  const rows: TableRow[] = [];

  const capped = [...lines];
  while (capped.length < layout.rowsPerPage) capped.push({ text: "" });

  function buildStackedRuns(text: string, bold = false, stacked = true) {
    const parts = (text || "").split("\n").filter((x) => x.trim() !== "");

    if (!stacked) { return [new TextRun({ text: text || "", bold, size: 24, font: FONT })] }

    return parts.map((part, index) => new TextRun({ text: part, bold, size: 24, font: FONT, break: index > 0 ? 1 : 0 }));
  }

  function buildRuns(runs: { text: string; bold?: boolean }[]) {
    return runs.flatMap((run) =>
      run.text.split("\n").map((text, i) => new TextRun({ text, bold: run.bold, size: 24, font: FONT, break: i > 0 ? 1 : 0 }))
    );
  }

  function isEmptyCaptionRow(line: any) {
    return (line.captionLeftText || "").trim() === "" && (line.captionRightText || "").trim() === "";
  }

  for (let i = 0; i < layout.rowsPerPage; i++) {
    const line: any = capped[i];
    const isCaptionRow = line.captionLeftText !== undefined || line.captionRightText !== undefined;

    if (isCaptionRow && isEmptyCaptionRow(line)) continue;

    const contentChildren: (Paragraph | Table)[] = [];

    if (isCaptionRow) {
      const leftLines = (line.captionLeftText || "").split("\n").filter((x: string) => x.trim() !== "");
      const rightLines = (line.captionRightText || "").split("\n").filter((x: string) => x.trim() !== "");
      const visualLines = Math.max(leftLines.length, rightLines.length);
      const captionRuns: TextRun[] = [];

      for (let i = 0; i < visualLines; i++) {
        if (i > 0) captionRuns.push(new TextRun({ break: 1 }));
        captionRuns.push(new TextRun({ text: leftLines[i] || "", size: 24, font: FONT }));
        captionRuns.push(new TextRun({ text: "\t" }));
        captionRuns.push(new TextRun({ text: rightLines[i] || "", bold: line.captionRightBold ?? true, size: 24, font: FONT }));
      }
      contentChildren.push(new Paragraph({ spacing: { before: 0, after: 0, line: layout.lineHeight }, tabStops: [{ type: "left", position: 5200 }], children: captionRuns }));
    } else {
      const interrogatoryMatch = line.text.match(/^(INTERROGATORY NO\.\s*\d+:)(.*)$/i);
      const paragraphChildren: TextRun[] = line.runs
        ? buildRuns(line.runs)
        : interrogatoryMatch
          ? [
            new TextRun({ text: interrogatoryMatch[1], bold: true, size: 24, font: FONT }),
            new TextRun({ text: interrogatoryMatch[2] || "", size: 24, font: FONT }),
          ]
          : buildStackedRuns(line.text, !!line.bold, !!line.stacked);

      contentChildren.push(
        new Paragraph({
          alignment: line.center ? AlignmentType.CENTER : line.right ? AlignmentType.RIGHT : AlignmentType.LEFT,
          indent: { left: line.indent ? 420 : 0, firstLine: line.firstLine ? BODY_FIRST_LINE_INDENT : 0 },
          spacing: { before: 0, after: 0, line: layout.lineHeight },
          children: paragraphChildren,
        }),
      );
    }

    rows.push(
      new TableRow({
        height: { value: layout.rowHeight, rule: HeightRule.ATLEAST },
        cantSplit: true,
        children: [
          new TableCell({
            width: { size: 260, type: WidthType.DXA },
            borders: {
              top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE },
              right: { style: BorderStyle.SINGLE, size: 6, color: "000000" },
            },
            children: [
              new Paragraph({
                spacing: { before: 0, after: 0, line: layout.lineHeight },
                children: [new TextRun({ text: String(i + 1), size: 20, font: FONT })],
              }),
            ],
          }),
          new TableCell({
            width: { size: 80, type: WidthType.DXA },
            borders: {
              top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE },
              left: { style: BorderStyle.SINGLE, size: 6, color: "000000" }, right: { style: BorderStyle.NONE },
            },
            children: [new Paragraph({ children: [] })],
          }),
          new TableCell({
            width: { size: 8940, type: WidthType.DXA },
            verticalAlign: VerticalAlign.TOP,
            margins: { top: 0, bottom: 0, left: 60, right: 60 },
            borders: {
              top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE },
              left: { style: BorderStyle.SINGLE, size: 6, color: "000000" },
              right: { style: BorderStyle.SINGLE, size: 6, color: "000000" },
            },
            children: contentChildren,
          }),
        ],
      }),
    );
  }

  return rows;
}

async function generateDocx(pleadingLines: PleadingLine[], caseMetadata: CaseMetadata) {
  const proofLines: PleadingLine[] = [];
  const serviceListLines: PleadingLine[] = [];

  insertProofOfServiceSection(proofLines, caseMetadata);
  insertServiceListSection(serviceListLines, caseMetadata);

  function buildSectionChildren(
    lines: PleadingLine[],
    layout: PageLayout,
  ): (Paragraph | Table)[] {
    const sectionChildren: (Paragraph | Table)[] = [];
    const pages = paginate(lines, layout.rowsPerPage);

    pages.forEach((pageLines, index) => {
      sectionChildren.push(
        new Table({
          layout: TableLayoutType.FIXED,
          width: { size: 100, type: WidthType.PERCENTAGE },
          columnWidths: [260, 80, 8940],
          borders: {
            top: { style: BorderStyle.NONE },
            bottom: { style: BorderStyle.NONE },
            left: { style: BorderStyle.NONE },
            right: { style: BorderStyle.NONE },
            insideHorizontal: { style: BorderStyle.NONE },
            insideVertical: { style: BorderStyle.NONE },
          },
          rows: buildRows(pageLines, layout),
        }),
      );

      if (index < pages.length - 1) {
        sectionChildren.push(new Paragraph({ pageBreakBefore: true }));
      }
    });

    return sectionChildren;
  }

  const pleadingChildren = [buildCaptionLineOverlay(), ...buildSectionChildren(pleadingLines, PLEADING_LAYOUT)];

  const proofChildren = buildSectionChildren(proofLines, PROOF_OF_SERVICE_LAYOUT);

  const serviceListChildren = buildSectionChildren(serviceListLines, PROOF_OF_SERVICE_LAYOUT);

  const pageMargins = { left: 720, right: 720, top: 720, bottom: 720, footer: 1800 };

  const doc = new Document({
    compatibility: { noExtraLineSpacing: true, doNotExpandShiftReturn: true },
    sections: [{
      properties: { page: { margin: pageMargins } },
      footers: { default: buildFooter(caseMetadata.title) }, children: pleadingChildren
    }, {
      properties: { type: SectionType.NEXT_PAGE, page: { margin: pageMargins, pageNumbers: { start: 1 } } },
      footers: { default: buildFooter("PROOF OF SERVICE") }, children: proofChildren
    }, {
      properties: { type: SectionType.NEXT_PAGE, page: { margin: pageMargins, pageNumbers: { start: 1 } } },
      footers: { default: buildFooter("SERVICE LIST") }, children: serviceListChildren
    }]
  });

  return await Packer.toBuffer(doc);
}

// SECTION HELPERS
function insertPlaintiffAttorneySection(pleadingLines: PleadingLine[], plaintiffName: string) {
  buildPlaintiffAttorneyLines(plaintiffName).forEach((line) => pleadingLines.push({ text: line.text, stacked: line.stacked }));
}

function insertCourtTitleSection(pleadingLines: PleadingLine[]) {
  buildCourtTitle().forEach((line) => pleadingLines.push({ text: line.text, center: line.center, bold: line.bold }));
}

function insertCaptionSection(pleadingLines: PleadingLine[], caseMetadata: CaseMetadata) {
  const { caseNumber, plaintiffName, defendantName, title } = caseMetadata
  const leftLines = buildPlaintiffCaptionLines(plaintiffName, defendantName);
  const rightLines = buildPlaintiffCaptionRightLines(caseNumber, title);
  const totalRows = Math.max(leftLines.length, rightLines.length);

  for (let i = 0; i < totalRows; i++) {
    pleadingLines.push({
      text: "",
      captionLeftText: leftLines[i]?.text || "",
      captionLeftStacked: leftLines[i]?.stacked ?? false,
      captionRightText: rightLines[i]?.text || "",
      captionRightStacked: rightLines[i]?.stacked ?? false,
    } as any);
  }
  pleadingLines.push({ text: "" });
  pleadingLines.push({ text: "" });
}

function insertIntroductorySection(pleadingLines: PleadingLine[], caseMetadata: CaseMetadata) {
  const { plaintiffName, defendantName, setNumber } = caseMetadata
  buildIntroLines(plaintiffName, defendantName, setNumber).forEach((line) =>
    pleadingLines.push({ text: line.text || "", runs: line.runs, firstLine: line.firstLine })
  );
}

function insertFormInterrogatoryIntroductorySection(pleadingLines: PleadingLine[], caseMetadata: CaseMetadata) {
  const { plaintiffName, defendantName, setNumber } = caseMetadata
  buildFormInterrogatoryIntroLines(plaintiffName, defendantName, setNumber).forEach((line) =>
    pleadingLines.push({ text: line.text || "", firstLine: line.firstLine, bold: line.bold, center: line.center, runs: line.runs, }),
  );

  pleadingLines.push({ text: "" });
}

function insertInterrogatoryResponses(
  pleadingLines: PleadingLine[],
  interrogatories: any[],
) {
  pleadingLines.push({ text: "RESPONSES TO SPECIAL INTERROGATORIES", center: true, bold: true });

  interrogatories.forEach((interrogatory) => {
    const lines = buildInterrogatoryResponseLines(
      true,
      interrogatory.number,
      interrogatory.question,
      interrogatory.finalResponse || "",
      interrogatory.questionLines || [],
    );

    lines.forEach((line) => {
      if (line.firstLine) {
        const wrapped = wrapPleadingText(line.text, line.firstLine);

        wrapped.forEach((text, index) => {
          pleadingLines.push({ text, firstLine: index === 0 });
        });
      } else {
        pleadingLines.push({ text: line.text, bold: line.bold });
      }
    });
  });
}

function insertFormInterrogatoryResponses(
  pleadingLines: PleadingLine[],
  interrogatories: any[],
) {
  pleadingLines.push({ text: "RESPONSES TO FORM INTERROGATORIES", center: true, bold: true });

  interrogatories.forEach((interrogatory) => {
    const lines = buildInterrogatoryResponseLines(
      false,
      interrogatory.number,
      interrogatory.question,
      interrogatory.finalResponse || "",
      interrogatory.questionLines || [],
    );

    lines.forEach((line) => {
      if (line.firstLine) {
        wrapPleadingText(line.text, true).forEach((text, index) => {
          pleadingLines.push({ text, firstLine: index === 0 });
        });
      } else {
        pleadingLines.push({ text: line.text, bold: line.bold });
      }
    });
  });
}

function insertAttorneyVerificationSection(pleadingLines: PleadingLine[], plaintiffName: string, signatureDate: string) {
  const leftLines = [
    `DATED: ${signatureDate}`,
  ];

  const rightLines = [
    "GOC Legal, P.C.",
    "By:_____________________",
    "Gregory O'Connell\nAttorney for",
    plaintiffName,
  ];

  const totalRows = Math.max(
    leftLines.length,
    rightLines.length
  );

  pleadingLines.push({ text: "" });
  pleadingLines.push({ text: "" });
  for (let i = 0; i < totalRows; i++) {
    pleadingLines.push({
      text: "",
      captionLeftText: leftLines[i] || "",
      captionRightText: rightLines[i] || "",
      captionRightBold: false,
    } as any);
  }
}

function insertProofOfServiceSection(pleadingLines: PleadingLine[], caseMetadata: CaseMetadata) {
  const { caseNumber, plaintiffName, defendantName, serviceDate } = caseMetadata
  buildProofOfServiceLines(caseNumber, plaintiffName, defendantName, serviceDate).forEach((line) => {
    pleadingLines.push({ text: line.text || "", center: line.center, right: line.right, bold: line.bold, stacked: line.stacked, runs: line.runs });
  });
}

function insertServiceListSection(pleadingLines: PleadingLine[], caseMetadata: CaseMetadata) {
  const { caseNumber, plaintiffName, defendantName, defendantAttorney, defendantAttorneyAddress, defendantAttorneyEmail } = caseMetadata
  buildServiceListLines(caseNumber, plaintiffName, defendantName, defendantAttorney, defendantAttorneyAddress, defendantAttorneyEmail).forEach(line =>
    pleadingLines.push({ text: line.text, center: line.center, bold: line.bold, stacked: line.stacked }))
}

function measurePleadingWidth(text: string) {
  let width = 0;

  for (const char of text) {
    if (/[mwMW]/.test(char)) width += 1.7;
    else if (/[A-Z]/.test(char)) width += 1.6;
    else if (/[ilI\.,']/.test(char)) width += 0.5;
    else width += 1;
  }

  return width;
}

function wrapPleadingText(text: string, isFirstLineParagraph: boolean) {
  const maxWidth = isFirstLineParagraph ? PLEADING_FIRST_LINE_WIDTH : PLEADING_VISUAL_WIDTH;
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;

    if (measurePleadingWidth(candidate) > maxWidth) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }

  if (current) lines.push(current);
  return lines;
}

export async function detectInterrogatoryType(buffer: ArrayBuffer) {
  const pdfjs = await getPdfJs();
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(buffer), disableWorker: true, useWorkerFetch: false, isEvalSupported: false }).promise;

  const page = await pdf.getPage(1);
  const content = await page.getTextContent();

  const text = content.items.map((item: any) => item.str || "").join(" ").toUpperCase();

  if (text.includes("FORM INTERROGATORIES")) return "form";
  return "special";
}

export async function loadSpecialInterrogatoryPdfQuestions(buffer: ArrayBuffer) {
  const pdfjs = await getPdfJs();
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(buffer), disableWorker: true, useWorkerFetch: false, isEvalSupported: false }).promise;

  const interrogatories: Interrogatory[] = [];
  let currentNumber = "", currentQuestion: string[] = [], stopQuestionAppend = false;
  let caseNumber = "", plaintiffName = "", defendantName = "", setNumber = "";

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();

    const items = content.items
      .map((item: any) => ({ text: normalize(item.str || ""), x: item.transform[4], y: item.transform[5] }))
      .filter((x: any) => x.text);

    items.sort((a: any, b: any) => Math.abs(a.y - b.y) < 2 ? a.x - b.x : b.y - a.y);

    const grouped: any[] = [];
    for (const item of items) {
      const existing = grouped.find((g) => Math.abs(g.y - item.y) < 2);
      if (existing) existing.items.push(item);
      else grouped.push({ y: item.y, items: [item] });
    }

    for (const row of grouped) {
      row.items.sort((a: any, b: any) => a.x - b.x);

      let text = normalize(row.items.map((x: any) => x.text).join(" "));

      const caseMatch = text.match(/CASE\s+NO\.\s*(.+)$/i);
      if (caseMatch && !caseNumber) caseNumber = caseMatch[1].trim().replace(/\s*-\s*/g, "-");

      const setMatch = text.match(/SET NUMBER:\s*([A-Z0-9() ]+)/i);
      if (setMatch && !setNumber) setNumber = setMatch[1].replace(/\(.+\)/, "").trim();

      const plaintiffMatch = text.match(/RESPONDING\s+PARTY:\s*(.+)$/i);
      if (plaintiffMatch && !plaintiffName) plaintiffName = plaintiffMatch[1].trim();

      const defendantMatch = text.match(/PROPOUNDING\s+PARTY:\s*(.+)$/i);
      if (defendantMatch && !defendantName) defendantName = defendantMatch[1].trim().replace(/^DEFENDANT\s+/i, "");

      text = normalize(text.replace(/^\d+\s+/, ""));

      if (isDefinitionsLine(text) || isJunkLine(text)) continue;

      if (
        text.startsWith("Dated:") ||
        text.includes("RYAN RICHARDSON") ||
        text.includes("DIANA ROSENSTEIN") ||
        text.includes("Deputy City Attorney") ||
        text.includes("Attorneys for Defendant")
      ) {
        stopQuestionAppend = true;
      }

      const titleMatch = text.match(/^INTERROGATORY NO\.\s*(\d+):/i);

      if (titleMatch) {
        if (currentNumber && currentQuestion.length) {
          interrogatories.push({ number: currentNumber, question: currentQuestion.join(" "), questionLines: [] });
        }

        currentNumber = `INTERROGATORY NO. ${titleMatch[1]}:`;
        currentQuestion = [];
        stopQuestionAppend = false;
      } else if (currentNumber && !stopQuestionAppend) {
        currentQuestion.push(text);
      }

      if (text.includes("Denise Winkelstein et al, v. City of Oakland")) continue;
    }
  }

  if (currentNumber && currentQuestion.length) {
    interrogatories.push({ number: currentNumber, question: currentQuestion.join(" ") });
  }

  const title = `RESPONSES TO SPECIAL INTERROGATORIES, SET ${setNumber}`
  console.log("metadata", { caseNumber, plaintiffName, defendantName, setNumber, title });
  return {
    interrogatories,
    metadata: { caseNumber, plaintiffName, defendantName, setNumber, title },
  };
}

export async function buildSpecialInterrogatoryDocx(
  interrogatories: any[],
  caseMetadata: CaseMetadata,
) {
  const pleadingLines: PleadingLine[] = [];

  insertPlaintiffAttorneySection(pleadingLines, caseMetadata.plaintiffName);
  pleadingLines.push({ text: "" });
  insertCourtTitleSection(pleadingLines);
  insertCaptionSection(pleadingLines, caseMetadata);
  insertIntroductorySection(pleadingLines, caseMetadata);
  insertInterrogatoryResponses(pleadingLines, interrogatories);
  insertAttorneyVerificationSection(pleadingLines, caseMetadata.plaintiffName, signatureDate);

  return await generateDocx(pleadingLines, caseMetadata);
}

export async function loadFormInterrogatoryPdfQuestions(buffer: ArrayBuffer) {
  const pdfjs = await getPdfJs();
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(buffer), disableWorker: true, useWorkerFetch: false, isEvalSupported: false }).promise;

  const interrogatories: FormInterrogatory[] = [];
  let currentNumber = "", currentLines: string[] = [], foundQuestions = false;
  let caseNumber = "", plaintiffName = "", defendantName = "", setNumber = "";

  function isFormJunkLine(text: string) {
    if (!text || /^\d+$/.test(text)) return true;
    if (/^-\s*\d+\s*-$/.test(text)) return true;
    if (text.includes("RESPONSES TO FORM INTERROGATORIES")) return true;
    if (text.startsWith("DATED:")) return true;
    if (text.includes("Attorney for")) return true;
    if (text.includes("Gregory O'Connell")) return true;
    if (text.startsWith("By:")) return true;
    if (text.includes("AMANDA KETCHUM")) return true;
    const blocked = ["RESPONSES TO FORM INTERROGATORIES", "PRELIMINARY STATEMENT", "GENERAL OBJECTIONS", "GOC Legal", "SUPERIOR COURT OF THE STATE", "UNLIMITED JURISDICTION", "ATTORNEY FOR PLAINTIFF"];
    return blocked.some((x) => text.includes(x));
  }

  function pushCurrentQuestion() {
    if (!currentNumber) return;
    const firstOptionIndex = currentLines.findIndex((line) => /^\s*\([a-z]\)/i.test(line));
    let question = "";
    let questionLines: string[] = [];

    if (firstOptionIndex === -1) {
      question = currentLines.join(" ");
    } else {
      question = currentLines.slice(0, firstOptionIndex).join(" ").trim();
      questionLines = currentLines.slice(firstOptionIndex).map((x) => x.trim());
    }
    interrogatories.push({ number: currentNumber, question, questionLines });
  }

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();

    const items = content.items
      .map((item: any) => ({ text: normalize(item.str || ""), x: item.transform[4], y: item.transform[5] }))
      .filter((x: any) => x.text);

    items.sort((a: any, b: any) => Math.abs(a.y - b.y) < 2 ? a.x - b.x : b.y - a.y);

    const grouped: any[] = [];
    for (const item of items) {
      const existing = grouped.find((g) => Math.abs(g.y - item.y) < 2);
      if (existing) existing.items.push(item);
      else grouped.push({ y: item.y, items: [item] });
    }

    grouped.sort((a, b) => b.y - a.y);

    const rows = grouped.map((group) =>
      normalize(group.items.sort((a: any, b: any) => a.x - b.x).map((x: any) => x.text).join(" "))
    );

    for (const row of rows) {
      const text = normalize(row).replace(/^\d+\s+/, "");

      const caseMatch = text.match(/CASE\s+NO\.\s*(.+)$/i);
      if (caseMatch && !caseNumber) caseNumber = caseMatch[1].trim().replace(/\s*-\s*/g, "-");

      const setMatch = text.match(/SET NUMBER:\s*([A-Z0-9() ]+)/i);
      if (setMatch && !setNumber) setNumber = setMatch[1].replace(/\(.+\)/, "").trim();

      const plaintiffMatch = text.match(/RESPONDING\s+PARTY:\s*(.+)$/i);
      if (plaintiffMatch && !plaintiffName) plaintiffName = plaintiffMatch[1].trim();

      const defendantMatch = text.match(/PROPOUNDING\s+PARTY:\s*(.+)$/i);
      if (defendantMatch && !defendantName) defendantName = defendantMatch[1].trim().replace(/^DEFENDANT\s+/i, "");
    }

    for (const row of rows) {
      const text = normalize(row).replace(/^\d+\s+/, "");
      if (!text) continue;

      if (text === "RESPONSES TO FORM INTERROGATORIES") {
        foundQuestions = true;
        continue;
      }

      if (!foundQuestions) continue;

      const match = text.match(/FORM\s+INTERROGATORY\s+NO\.\s*([\d\s.]+)\s*:/i);
      if (match) {
        pushCurrentQuestion();
        currentNumber = `INTERROGATORY NO. ${match[1].replace(/\s+/g, "").trim()}:`;
        currentLines = [];
        const remainder = text.replace(match[0], "").trim();
        if (remainder) { currentLines.push(remainder) };
        continue;
      }

      if (isFormJunkLine(text)) continue;
      if (currentNumber && !isFormJunkLine(text)) currentLines.push(text);
    }
  }

  pushCurrentQuestion();

  return {
    interrogatories,
    metadata: { caseNumber, plaintiffName, defendantName, setNumber, title: `RESPONSES TO FORM INTERROGATORIES, SET ${setNumber}` },
  };
}

export async function buildFormInterrogatoryDocx(
  interrogatories: any[],
  caseMetadata: CaseMetadata,
) {
  const pleadingLines: PleadingLine[] = [];

  insertPlaintiffAttorneySection(pleadingLines, caseMetadata.plaintiffName);
  pleadingLines.push({ text: "" });
  insertCourtTitleSection(pleadingLines);
  insertCaptionSection(pleadingLines, caseMetadata);
  insertFormInterrogatoryIntroductorySection(pleadingLines, caseMetadata);
  insertFormInterrogatoryResponses(pleadingLines, interrogatories);
  insertAttorneyVerificationSection(pleadingLines, caseMetadata.plaintiffName, signatureDate);

  return await generateDocx(pleadingLines, caseMetadata);
}