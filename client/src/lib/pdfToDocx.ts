import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  HeightRule,
  Packer,
  PageNumber,
  Paragraph,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
} from "docx";

let pdfjsLib: any;
const FONT = "Times New Roman";
const ROWS_PER_PAGE = 28;
const ROW_HEIGHT = 480;
const LINE_HEIGHT = 240;
const BODY_FIRST_LINE_INDENT = 360;

async function getPdfJs() {
  if (pdfjsLib) {
    return pdfjsLib;
  }

  const mod = await import(
    /* webpackIgnore: true */
    "pdfjs-dist/legacy/build/pdf.js"
  );

  pdfjsLib =
    (mod as any).default || mod;

  return pdfjsLib;
}

function normalize(
  text: string
) {
  return text
    .replace(/\s+/g, " ")
    .replace(/[‐-–—]/g, "-")
    .trim();
}
 
// REMOVE HEADER / FOOTER JUNK
function isJunkLine(
  text: string
) {
  if (!text) return true;

  if (/^\d+$/.test(text)) {
    return true;
  }

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

  return blocked.some((x) =>
    text.includes(x)
  );
}

function isDefinitionLine(
  text: string
) {
  const lower =
    text.toLowerCase();

  return [
    "definitions & instructions",
    "incident means",
    "subject area",
    "vegetation debris",
    "overgrown trees",
    '"you" and "your"',
    '"identify"',
    '"person"',
    '"document"',
    "health care provider",
    "collateral source payments",
  ].some((x) =>
    lower.includes(x)
  );
}

// INTERROGATORY QUESTIONS
function isQuestionLine(
  text: string
) {
  return [
    "If ",
    "Describe ",
    "IDENTIFY ",
    "Have ",
    "Did ",
    "State ",
    "Set forth ",
    "Identify ",
  ].some((x) =>
    text.startsWith(x)
  );
}

// FOOTER
function buildFooter() {
  return new Footer({
    children: [
      new Paragraph({
        alignment:
          AlignmentType.CENTER,

        spacing: {
          before: 0,
          after: 0,
          line: 180,
        },

        children: [
          new TextRun({
            children: [
              PageNumber.CURRENT,
            ],

            size: 20,
            font: FONT,
          }),
        ],
      }),

      new Table({
        layout:
          TableLayoutType.FIXED,

        width: {
          size: 100,
          type:
            WidthType.PERCENTAGE,
        },

        alignment:
          AlignmentType.CENTER,

        borders: {
          top: {
            style:
              BorderStyle.SINGLE,
            size: 6,
            color: "000000",
          },

          bottom: {
            style:
              BorderStyle.NONE,
          },

          left: {
            style:
              BorderStyle.NONE,
          },

          right: {
            style:
              BorderStyle.NONE,
          },

          insideHorizontal: {
            style:
              BorderStyle.NONE,
          },

          insideVertical: {
            style:
              BorderStyle.NONE,
          },
        },

        rows: [
          new TableRow({
            children: [
              new TableCell({
                width: {
                  size: 100,
                  type:
                    WidthType.PERCENTAGE,
                },

                verticalAlign:
                  VerticalAlign.CENTER,

                margins: {
                  top: 80,
                  bottom: 0,
                  left: 0,
                  right: 0,
                },

                borders: {
                  top: {
                    style:
                      BorderStyle.NONE,
                  },

                  bottom: {
                    style:
                      BorderStyle.NONE,
                  },

                  left: {
                    style:
                      BorderStyle.NONE,
                  },

                  right: {
                    style:
                      BorderStyle.NONE,
                  },
                },

                children: [
                  new Paragraph({
                    alignment:
                      AlignmentType.CENTER,

                    spacing: {
                      before: 0,
                      after: 0,
                      line: 180,
                    },

                    children: [
                      new TextRun({
                        text:
                          "RESPONSES TO SPECIAL INTERROGATORIES, SET ONE",

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

type PleadingLine = {
  text: string;
  bold?: boolean;
  center?: boolean;
  firstLine?: boolean;
  interrogatoryTitle?: boolean;
};

function buildRows(
  pageLines: PleadingLine[],
  responsesMap: Record<
    string,
    string
  > = {}
) {
  const rows: TableRow[] = [];

  // ==========================================
  // EXPAND QUESTIONS + RESPONSES
  // ==========================================

  const expandedLines: PleadingLine[] =
    [];

  for (
    let i = 0;
    i < pageLines.length;
    i++
  ) {
    const line =
      pageLines[i];

    expandedLines.push(line);

    // ========================================
    // INSERT RESPONSE AFTER QUESTION BLOCK
    // ========================================

    const isInterrogatoryTitle =
      /^INTERROGATORY NO\.\s*\d+\s*:?\s*$/i.test(
        line.text
      );

    if (
      !isInterrogatoryTitle
    ) {
      continue;
    }

    // ========================================
    // GET QUESTION NUMBER
    // ========================================

    const match =
      line.text.match(
        /(\d+)/
      );

    if (!match) {
      continue;
    }

    const number =
      match[1];

    const finalResponse =
      responsesMap[
        number
      ]?.trim();

    // ========================================
    // SKIP EMPTY RESPONSE
    // ========================================

    if (!finalResponse) {
      continue;
    }

    // ========================================
    // FIND END OF QUESTION
    // ========================================

    let j = i + 1;

    while (
      j <
        pageLines.length &&
      !/^INTERROGATORY NO\.\s*\d+\s*:?\s*$/i.test(
        pageLines[j].text
      )
    ) {
      expandedLines.push(
        pageLines[j]
      );

      i = j;
      j++;
    }

    // ========================================
    // RESPONSE TITLE
    // ========================================

    expandedLines.push({
      text:
        `RESPONSE TO SPECIAL INTERROGATORY NO. ${number}:`,

      bold: true,
    });

    // ========================================
    // SPLIT RESPONSE INTO WRAPPED LINES
    // ========================================

    const wrapped =
      wrapPleadingText(
        finalResponse,
        95
      );

      wrapped.forEach(
        (lineText, index) => {
          expandedLines.push({
            text: lineText,
      
            // ONLY FIRST RESPONSE ROW INDENTED
            firstLine:
              index === 0,
          });
        }
      );
  }

  // ==========================================
  // FORCE EXACTLY 28 ROWS
  // ==========================================

  for (
    let i = 0;
    i < ROWS_PER_PAGE;
    i++
  ) {
    const line =
      expandedLines[i];

    // ========================================
    // DOCX DISPLAY TEXT
    // ========================================

    let displayText =
      line?.text || "";

    // ========================================
    // SECTION TITLE
    // ========================================

    if (
      displayText ===
      "INTERROGATORIES"
    ) {
      displayText =
        "RESPONSES TO SPECIAL INTERROGATORIES";
    }

    // ========================================
    // PREFIX SPECIAL
    // ========================================

    if (
      /^INTERROGATORY NO\.\s*\d+\s*:?\s*$/i.test(
        displayText
      )
    ) {
      displayText =
        displayText.replace(
          /^INTERROGATORY/i,
          "SPECIAL INTERROGATORY"
        );
    }

    rows.push(
      new TableRow({
        height: {
          value: ROW_HEIGHT,
          rule:
            HeightRule.EXACT,
        },

        cantSplit: true,

        children: [
          // ==================================
          // LINE NUMBER
          // ==================================

          new TableCell({
            width: {
              size: 260,
              type:
                WidthType.DXA,
            },

            verticalAlign:
              VerticalAlign.TOP,

            margins: {
              top: 0,
              bottom: 0,
              left: 0,
              right: 0,
            },

            borders: {
              top: {
                style:
                  BorderStyle.NONE,
              },

              bottom: {
                style:
                  BorderStyle.NONE,
              },

              left: {
                style:
                  BorderStyle.NONE,
              },

              right: {
                style:
                  BorderStyle.SINGLE,
                size: 6,
                color:
                  "000000",
              },
            },

            children: [
              new Paragraph({
                spacing: {
                  before: 0,
                  after: 0,
                  line:
                    LINE_HEIGHT,
                },

                children: [
                  new TextRun({
                    text:
                      String(
                        i + 1
                      ),

                    size: 20,

                    font: FONT,
                  }),
                ],
              }),
            ],
          }),

          // ==================================
          // EXTRA LEFT LINE
          // ==================================

          new TableCell({
            width: {
              size: 80,
              type:
                WidthType.DXA,
            },

            verticalAlign:
              VerticalAlign.TOP,

            margins: {
              top: 0,
              bottom: 0,
              left: 0,
              right: 0,
            },

            borders: {
              top: {
                style:
                  BorderStyle.NONE,
              },

              bottom: {
                style:
                  BorderStyle.NONE,
              },

              left: {
                style:
                  BorderStyle.SINGLE,
                size: 6,
                color:
                  "000000",
              },

              right: {
                style:
                  BorderStyle.NONE,
              },
            },

            children: [
              new Paragraph({
                children: [],
              }),
            ],
          }),

          // ==================================
          // CONTENT
          // ==================================

          new TableCell({
            width: {
              size: 8940,
              type:
                WidthType.DXA,
            },

            verticalAlign:
              VerticalAlign.TOP,

            margins: {
              top: 0,
              bottom: 0,
              left: 80,
              right: 60,
            },

            borders: {
              top: {
                style:
                  BorderStyle.NONE,
              },

              bottom: {
                style:
                  BorderStyle.NONE,
              },

              left: {
                style:
                  BorderStyle.SINGLE,
                size: 6,
                color:
                  "000000",
              },

              right: {
                style:
                  BorderStyle.SINGLE,
                size: 6,
                color:
                  "000000",
              },
            },

            children: [
              new Paragraph({
                keepLines: true,

                wordWrap: true,

                alignment:
                  line?.center
                    ? AlignmentType.CENTER
                    : AlignmentType.LEFT,

                spacing: {
                  before: 0,
                  after: 0,
                  line:
                    LINE_HEIGHT,
                },

                indent: {
                  firstLine:
                    line?.firstLine
                      ? BODY_FIRST_LINE_INDENT
                      : 0,
                },

                children: [
                  new TextRun({
                    text:
                      displayText,

                    bold:
                      line?.bold ||
                      false,

                    size: 24,

                    font: FONT,
                  }),
                ],
              }),
            ],
          }),
        ],
      })
    );
  }

  return rows;
}

// ======================================================
// WRAP LONG RESPONSE TEXT
// ======================================================

function wrapPleadingText(
  text: string,
  maxLength = 95
) {
  const words =
    text.split(" ");

  const lines: string[] =
    [];

  let current = "";

  for (const word of words) {
    if (
      (
        current +
        " " +
        word
      ).trim().length >
      maxLength
    ) {
      lines.push(
        current.trim()
      );

      current = word;
    } else {
      current +=
        " " + word;
    }
  }

  if (current.trim()) {
    lines.push(
      current.trim()
    );
  }

  return lines;
}

// PAGINATION
function paginate(
  lines: PleadingLine[]
) {
  const pages: PleadingLine[][] =
    [];

  for (
    let i = 0;
    i < lines.length;
    i += ROWS_PER_PAGE
  ) {
    pages.push(
      lines.slice(
        i,
        i + ROWS_PER_PAGE
      )
    );
  }

  return pages;
}

type Interrogatory = {
  number: string;
  question: string;
};

// CONVERT PDF TO CLEAN STRUCTURED DATA
async function extractLines(
  buffer: ArrayBuffer
): Promise<{
  pleadingLines: PleadingLine[];
  interrogatories: Interrogatory[];
}> {
  const pdfjs =
    await getPdfJs();

  const pdf =
    await pdfjs.getDocument({
      data: buffer,
      disableWorker: true,
      useWorkerFetch: false,
      isEvalSupported: false,
    }).promise;

  const pleadingLines: PleadingLine[] =
    [];

  const interrogatories: Interrogatory[] =
    [];

  let currentNumber = "";
  let currentQuestionLines: string[] =
    [];

  let insideDefinitions = false;
  let reachedProofOfService =
    false;

  for (
    let pageNum = 1;
    pageNum <= pdf.numPages;
    pageNum++
  ) {
    if (
      reachedProofOfService
    ) {
      break;
    }

    const page =
      await pdf.getPage(pageNum);

    const content =
      await page.getTextContent();

    const items =
      content.items
        .map((item: any) => ({
          text: normalize(
            item.str || ""
          ),

          x: item.transform[4],
          y: item.transform[5],
        }))
        .filter(
          (x: any) => x.text
        );

    // ==========================================
    // VISUAL SORT
    // ==========================================

    items.sort(
      (a: any, b: any) => {
        if (
          Math.abs(a.y - b.y) <
          2
        ) {
          return a.x - b.x;
        }

        return b.y - a.y;
      }
    );

    // ==========================================
    // GROUP BY VISUAL ROW
    // ==========================================

    const grouped: {
      y: number;
      items: any[];
    }[] = [];

    for (const item of items) {
      const existing =
        grouped.find(
          (g) =>
            Math.abs(
              g.y - item.y
            ) < 2
        );

      if (existing) {
        existing.items.push(
          item
        );
      } else {
        grouped.push({
          y: item.y,
          items: [item],
        });
      }
    }

    // ==========================================
    // BUILD LINES
    // ==========================================

    for (const row of grouped) {
      row.items.sort(
        (a: any, b: any) =>
          a.x - b.x
      );

      let text = normalize(
        row.items
          .map(
            (x: any) => x.text
          )
          .join(" ")
      );

      // remove pleading line numbers
      text = text.replace(
        /^\d+\s+/,
        ""
      );

      text = normalize(text);

      if (!text) {
        continue;
      }

      // ========================================
      // STOP BEFORE PROOF OF SERVICE
      // ========================================

      if (
        text.includes(
          "PROOF OF SERVICE"
        ) ||
        text.includes(
          "Denise Winkelstein et al, v. City of Oakland"
        )
      ) {
        reachedProofOfService =
          true;

        break;
      }

      // ========================================
      // DEFINITIONS SECTION
      // ========================================

      if (
        text ===
        "DEFINITIONS & INSTRUCTIONS"
      ) {
        insideDefinitions = true;
        continue;
      }

      if (
        insideDefinitions
      ) {
        if (
          text ===
          "INTERROGATORIES"
        ) {
          insideDefinitions =
            false;
        } else {
          continue;
        }
      }

      // ========================================
      // REMOVE HEADER / FOOTER JUNK
      // ========================================

      if (
        isJunkLine(text)
      ) {
        continue;
      }

      // ========================================
      // IMPORTANT:
      // DO NOT REMOVE
      // "Interrogatory No. 18."
      // continuation lines
      // ========================================

      // ========================================
      // STOP BEFORE SIGNATURE
      // ========================================

      if (
        text.startsWith(
          "Dated:"
        )
      ) {
        break;
      }

      // ========================================
      // INTERROGATORY TITLE
      // ========================================

      const interrogatoryTitle =
        /^INTERROGATORY NO\.\s*\d+\s*:?\s*$/i.test(
          text
        );

      const centered =
        text ===
        "INTERROGATORIES";

      // ========================================
      // SAVE PREVIOUS QUESTION
      // ========================================

      if (
        interrogatoryTitle
      ) {
        if (
          currentNumber &&
          currentQuestionLines.length >
            0
        ) {
          interrogatories.push({
            number:
              currentNumber,

            question:
              currentQuestionLines
                .join(" ")
                .replace(
                  /\s+/g,
                  " "
                )
                .trim(),
          });
        }

        currentNumber = text;

        currentQuestionLines =
          [];

      } else if (
        currentNumber
      ) {
        // ======================================
        // KEEP EVERY WRAPPED QUESTION LINE
        // ======================================

        currentQuestionLines.push(
          text
        );
      }

      // ========================================
      // DOCX CONTENT
      // ========================================

      pleadingLines.push({
        text,

        bold:
          interrogatoryTitle ||
          centered,

        center: centered,

        interrogatoryTitle,

        firstLine:
          !interrogatoryTitle &&
          !centered &&
          isQuestionLine(text),
      });
    }
  }

  // ==========================================
  // PUSH FINAL QUESTION
  // ==========================================

  if (
    currentNumber &&
    currentQuestionLines.length >
      0
  ) {
    interrogatories.push({
      number: currentNumber,

      question:
        currentQuestionLines
          .join(" ")
          .replace(/\s+/g, " ")
          .trim(),
    });
  }

  // ==========================================
  // START AT FIRST INTERROGATORY
  // ==========================================

  const start =
    pleadingLines.findIndex(
      (x) =>
        x.text.includes(
          "INTERROGATORY NO. 1"
        )
    );

  return {
    pleadingLines:
      pleadingLines.slice(start),

    interrogatories,
  };
}

// MAIN
export async function pdfToDocx(
  buffer: ArrayBuffer,
  responses: any = {}
) {
  const {
    pleadingLines,
    interrogatories,
  } = await extractLines(
    buffer
  );

  const pages =
    paginate(
      pleadingLines
    );

  const children: (
    | Table
    | Paragraph
  )[] = [];

  pages.forEach(
    (pageLines, index) => {
      children.push(
        new Table({
          layout:
            TableLayoutType.FIXED,

          width: {
            size: 100,
            type:
              WidthType.PERCENTAGE,
          },

          borders: {
            top: {
              style:
                BorderStyle.NONE,
            },

            bottom: {
              style:
                BorderStyle.NONE,
            },

            left: {
              style:
                BorderStyle.NONE,
            },

            right: {
              style:
                BorderStyle.NONE,
            },

            insideHorizontal: {
              style:
                BorderStyle.NONE,
            },

            insideVertical: {
              style:
                BorderStyle.NONE,
            },
          },

          rows: buildRows(
            pageLines,
            Object.fromEntries(
              Object.entries(
                responses || {}
              ).map(
                ([key, value]: any) => [
                  key.replace(
                    /\D/g,
                    ""
                  ),
          
                  value.finalResponse ||
                    "",
                ]
              )
            )
          )
        })
      );

      if (
        index <
        pages.length - 1
      ) {
        children.push(
          new Paragraph({
            pageBreakBefore:
              true,
          })
        );
      }
    }
  );

  const doc =
    new Document({
      compatibility: {
        noExtraLineSpacing:
          true,

        doNotExpandShiftReturn:
          true,
      },

      sections: [
        {
          properties: {
            page: {
              margin: {
                left: 720,
                right: 720,
                top: 1440,
                bottom: 720,
                footer: 720,
              },
            },
          },

          footers: {
            default:
              buildFooter(),
          },

          children,
        },
      ],
    });

  const docxBuffer =
    await Packer.toBuffer(doc);

  return {
    interrogatories,
    docxBuffer,
  };
}