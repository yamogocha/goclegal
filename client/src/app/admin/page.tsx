"use client";

import { useState } from "react";

type Interrogatory = {
  number: string;
  question: string;
};

type QA = {
  plaintiffAttorneyResponse: string;
  plaintiffClientResponse: string;
  finalResponse: string;
};

export default function Admin() {
  const [file, setFile] =
    useState<File | null>(null);

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const [
    interrogatories,
    setInterrogatories,
  ] = useState<Interrogatory[]>(
    []
  );

  const [responses, setResponses] =
    useState<
      Record<string, QA>
    >({});

  // ====================================================
  // LOAD QUESTIONS
  // ====================================================

  async function loadQuestions() {
    if (!file) return;

    try {
      setLoading(true);
      setError(null);

      const formData =
        new FormData();

      formData.append(
        "file",
        file
      );

      formData.append(
        "mode",
        "json"
      );

      const res = await fetch(
        "/api/pdfToDocx",
        {
          method: "POST",
          body: formData,
        }
      );

      if (!res.ok) {
        throw new Error(
          await res.text()
        );
      }

      const data =
        await res.json();

      setInterrogatories(
        data.interrogatories ||
          []
      );

      const initial: Record<
        string,
        QA
      > = {};

      (
        data.interrogatories ||
        []
      ).forEach(
        (item: Interrogatory) => {
          initial[item.number] = {
            plaintiffAttorneyResponse:
              "",

            plaintiffClientResponse:
              "",

            finalResponse: "",
          };
        }
      );

      setResponses(initial);
    } catch (err: any) {
      setError(
        err.message ||
          "Failed to load questions"
      );
    } finally {
      setLoading(false);
    }
  }

  // ====================================================
  // DOWNLOAD DOCX
  // ====================================================

  async function downloadDocx() {
    if (!file) return;
  
    try {
      setLoading(true);
      setError(null);
  
      const formData =
        new FormData();
  
      formData.append(
        "file",
        file
      );
  
      formData.append(
        "mode",
        "docx"
      );
  
      // ======================================
      // SEND FINAL RESPONSES
      // ======================================
  
      formData.append(
        "responses",
        JSON.stringify(
          responses
        )
      );
  
      const res = await fetch(
        "/api/pdfToDocx",
        {
          method: "POST",
          body: formData,
        }
      );
  
      if (!res.ok) {
        throw new Error(
          await res.text()
        );
      }
  
      const blob =
        await res.blob();
  
      const url =
        URL.createObjectURL(
          blob
        );
  
      const a =
        document.createElement(
          "a"
        );
  
      a.href = url;
  
      a.download =
        "interrogatories.docx";
  
      a.click();
  
      URL.revokeObjectURL(
        url
      );
    } catch (err: any) {
      setError(
        err.message ||
          "Download failed"
      );
    } finally {
      setLoading(false);
    }
  }

  // ====================================================
  // UPDATE RESPONSE
  // ====================================================

  function updateResponse(
    number: string,
    field: keyof QA,
    value: string
  ) {
    setResponses((prev) => ({
      ...prev,

      [number]: {
        ...prev[number],

        [field]: value,
      },
    }));
  }

  // ====================================================
  // AI ASSISTANT
  // ====================================================

  function generateAIResponses() {
    const updated = {
      ...responses,
    };
  
    interrogatories.forEach(
      (item) => {
        const response =
          responses[item.number];
  
        if (!response) {
          return;
        }
  
        const attorney =
          response.plaintiffAttorneyResponse.trim();
  
        const client =
          response.plaintiffClientResponse.trim();
  
        // ======================================
        // SKIP IF BOTH EMPTY
        // ======================================
  
        if (
          !attorney &&
          !client
        ) {
          return;
        }
  
        // ======================================
        // CLEAN CLIENT RESPONSE
        // ======================================
  
        let cleanedClient =
          client;
  
        // remove harmful / weak phrases
        const harmfulPatterns = [
          /\bi think\b/gi,
          /\bmaybe\b/gi,
          /\bprobably\b/gi,
          /\bnot sure\b/gi,
          /\bi guess\b/gi,
          /\bi don't remember\b/gi,
          /\bi dont remember\b/gi,
          /\bkind of\b/gi,
          /\bsort of\b/gi,
          /\bperhaps\b/gi,
          /\bi assume\b/gi,
          /\bpossibly\b/gi,
        ];
  
        harmfulPatterns.forEach(
          (pattern) => {
            cleanedClient =
              cleanedClient.replace(
                pattern,
                ""
              );
          }
        );
  
        cleanedClient =
          cleanedClient
            .replace(/\s+/g, " ")
            .trim();
  
        // ======================================
        // REMOVE CLIENT RESPONSE ENTIRELY
        // IF IT LOOKS WEAK / HARMFUL
        // ======================================
  
        const harmfulClient =
          [
            "i was careless",
            "my fault",
            "i caused",
            "i should have",
            "i wasn't paying attention",
            "i ignored",
            "i forgot",
            "i didn't look",
            "i wasnt looking",
            "i tripped myself",
            "i fell because of me",
          ].some((x) =>
            cleanedClient
              .toLowerCase()
              .includes(x)
          );
  
        if (harmfulClient) {
          cleanedClient = "";
        }
  
        // ======================================
        // BUILD FINAL RESPONSE
        // ======================================
  
        let finalResponse =
          "";
  
        // attorney response gets priority
        if (attorney) {
          finalResponse +=
            attorney.trim();
        }
  
        // append helpful client facts only
        if (
          cleanedClient
        ) {
          if (
            finalResponse
          ) {
            finalResponse +=
              "\n\n";
          }
  
          finalResponse +=
            cleanedClient;
        }
  
        // ======================================
        // FALLBACK
        // ======================================
  
        if (
          !finalResponse.trim()
        ) {
          finalResponse =
            "Plaintiff presently lacks sufficient information to fully respond to this interrogatory. Investigation and discovery are continuing.";
        }
  
        updated[item.number] = {
          ...response,
  
          finalResponse:
            finalResponse.trim(),
        };
      }
    );
  
    setResponses(updated);
  }

  // ====================================================
  // UI
  // ====================================================

  return (
    <main
      style={{
        padding: 24,
        maxWidth: 1200,
        margin: "0 auto",
        fontFamily:
          "Arial, sans-serif",
      }}
    >
      <h1
        style={{
          fontSize: 28,
          marginBottom: 20,
        }}
      >
        Interrogatories Parser
      </h1>

      {/* ====================================== */}
      {/* FILE */}
      {/* ====================================== */}

      <input
        type="file"
        accept="application/pdf"
        onChange={(e) => {
          setFile(
            e.target.files?.[0] ||
              null
          );

          setInterrogatories(
            []
          );

          setResponses({});

          setError(null);
        }}
      />

      {/* ====================================== */}
      {/* BUTTONS */}
      {/* ====================================== */}

      <div
        style={{
          display: "flex",
          gap: 12,
          marginTop: 16,
          marginBottom: 24,
        }}
      >
        <button
          onClick={
            loadQuestions
          }
          disabled={
            loading || !file
          }
        >
          Extract Questions
        </button>

        <button
          onClick={
            generateAIResponses
          }
          disabled={
            loading ||
            interrogatories.length ===
              0
          }
        >
          AI Assistant
        </button>

        <button
          onClick={
            downloadDocx
          }
          disabled={
            loading || !file
          }
        >
          Download DOCX
        </button>
      </div>

      {loading && (
        <div>
          Processing...
        </div>
      )}

      {error && (
        <pre
          style={{
            color: "red",
            whiteSpace:
              "pre-wrap",
          }}
        >
          {error}
        </pre>
      )}

      {/* ====================================== */}
      {/* QUESTIONS */}
      {/* ====================================== */}

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 24,
        }}
      >
        {interrogatories.map(
          (item) => (
            <div
              key={item.number}
              style={{
                border:
                  "1px solid #ddd",

                borderRadius: 8,

                padding: 20,

                background:
                  "#fafafa",
              }}
            >
              {/* ============================== */}
              {/* QUESTION */}
              {/* ============================== */}

              <div
                style={{
                  marginBottom: 20,
                }}
              >
                <div
                  style={{
                    fontWeight: 700,
                    fontSize: 18,
                    marginBottom: 10,
                  }}
                >
                  {
                    item.number
                  }
                </div>

                <div
                  style={{
                    lineHeight: 1.6,
                    whiteSpace:
                      "pre-wrap",
                  }}
                >
                  {
                    item.question
                  }
                </div>
              </div>

              {/* ============================== */}
              {/* ATTORNEY RESPONSE */}
              {/* ============================== */}

              <div
                style={{
                  marginBottom: 20,
                }}
              >
                <label
                  style={{
                    display:
                      "block",

                    fontWeight: 600,

                    marginBottom: 8,
                  }}
                >
                  Plaintiff
                  Attorney
                  Response
                </label>

                <textarea
                  value={
                    responses[
                      item.number
                    ]
                      ?.plaintiffAttorneyResponse ||
                    ""
                  }

                  onChange={(e) =>
                    updateResponse(
                      item.number,
                      "plaintiffAttorneyResponse",
                      e.target.value
                    )
                  }

                  style={{
                    width: "100%",
                    minHeight: 120,
                    padding: 12,
                    resize:
                      "vertical",
                  }}
                />
              </div>

              {/* ============================== */}
              {/* CLIENT RESPONSE */}
              {/* ============================== */}

              <div
                style={{
                  marginBottom: 20,
                }}
              >
                <label
                  style={{
                    display:
                      "block",

                    fontWeight: 600,

                    marginBottom: 8,
                  }}
                >
                  Plaintiff /
                  Client
                  Response
                </label>

                <textarea
                  value={
                    responses[
                      item.number
                    ]
                      ?.plaintiffClientResponse ||
                    ""
                  }

                  onChange={(e) =>
                    updateResponse(
                      item.number,
                      "plaintiffClientResponse",
                      e.target.value
                    )
                  }

                  style={{
                    width: "100%",
                    minHeight: 120,
                    padding: 12,
                    resize:
                      "vertical",
                  }}
                />
              </div>

              {/* ============================== */}
              {/* FINAL RESPONSE */}
              {/* ============================== */}

              <div>
                <label
                  style={{
                    display:
                      "block",

                    fontWeight: 700,

                    marginBottom: 8,

                    color:
                      "#0b5fff",
                  }}
                >
                  Final Response
                </label>

                <textarea
                  value={
                    responses[
                      item.number
                    ]
                      ?.finalResponse ||
                    ""
                  }

                  onChange={(e) =>
                    updateResponse(
                      item.number,
                      "finalResponse",
                      e.target.value
                    )
                  }

                  style={{
                    width: "100%",
                    minHeight: 180,
                    padding: 12,
                    resize:
                      "vertical",

                    border:
                      "2px solid #0b5fff",

                    background:
                      "#f8fbff",
                  }}
                />
              </div>
            </div>
          )
        )}
      </div>
    </main>
  );
}