"use client";
import { OBJECTIONS } from "@/lib/tempates";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Interrogatory = {
  _key?: string;
  number: string;
  question: string;
  questionLines?: string[];
  plaintiffAttorneyResponse: string;
  plaintiffClientResponse: string;
  finalResponse: string;
};

const backLinkClass =
  "inline-flex items-center justify-center text-white font-medium rounded bg-linear-to-r from-[#00305b] to-[#004c8f] gradient-animate px-4 py-2.5 sm:px-5 sm:py-3 cursor-pointer shadow-[0_0px_10px_rgba(0,0,0,0.3)]";
const textareaClass = "w-full min-h-[300px] border border-gray-300 rounded-md p-3";

export default function AdminInterrogatories({ clientId }: { clientId: string }) {
  const [interrogatories, setInterrogatories] = useState<Interrogatory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentPage, setCurrentPage] = useState(0);
  const [objectionMenuOpen, setObjectionMenuOpen] = useState(false);
  const [selectedObjection, setSelectedObjection] = useState("");
  const [saveStatus, setSaveStatus] = useState("Your responses are saved automatically.");
  const [showContinueLaterModal, setShowContinueLaterModal] = useState(false);
  const attorneyResponseRef = useRef<HTMLTextAreaElement>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestInterrogatoriesRef = useRef<Interrogatory[]>([]);
  const router = useRouter();

  // Load the client's latest interrogatories.
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(`/api/portal/${encodeURIComponent(clientId)}/interrogatories`, { cache: "no-store" });
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) throw new Error(data.error || "Unable to load interrogatories");
        const items = Array.isArray(data.interrogatories) ? data.interrogatories : [];
        latestInterrogatoriesRef.current = items;
        setInterrogatories(items);
      } catch (e: any) {
        if (!cancelled) setError(e.message || "Unable to load interrogatories");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  // Save pending changes when leaving the page.
  useEffect(() => {
    const handleBeforeUnload = () => {
      const items = latestInterrogatoriesRef.current;
      if (!items.length) return;
      navigator.sendBeacon(`/api/portal/${encodeURIComponent(clientId)}/interrogatories`, new Blob([JSON.stringify({ interrogatories: items })], { type: "application/json" }));
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [clientId]);

  // Persist responses.
  const persistInterrogatories = useCallback(
    async (items: Interrogatory[]) => {
      try {
        const res = await fetch(`/api/portal/${encodeURIComponent(clientId)}/interrogatories`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ interrogatories: items }),
        });
        if (!res.ok) throw new Error("Save failed");
        setSaveStatus("✓ Progress saved");
        window.setTimeout(() => setSaveStatus(""), 2000);
      } catch {
        setSaveStatus("Unable to save. Please check your connection.");
      }
    },
    [clientId],
  );

  // Update a field and debounce save.
  function saveField(index: number, field: "plaintiffAttorneyResponse" | "plaintiffClientResponse" | "finalResponse", value: string) {
    const updated = latestInterrogatoriesRef.current.map((item, i) => (i === index ? { ...item, [field]: value } : item));
    latestInterrogatoriesRef.current = updated;
    setInterrogatories(updated);
    setSaveStatus("Saving...");
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => void persistInterrogatories(updated), 1500);
  }

  // Flush pending save.
  async function flushPendingSave() {
    if (!saveTimeoutRef.current) return;
    clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = null;
    await persistInterrogatories(latestInterrogatoriesRef.current);
  }

  // Download latest DOCX.
  async function downloadDocx() {
    setLoading(true);
    setError("");
    try {
      await flushPendingSave();
      const res = await fetch(`/api/portal/${encodeURIComponent(clientId)}/interrogatories`, { method: "PATCH" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Download failed");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "interrogatories.docx";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setError(e.message || "Download failed");
    } finally {
      setLoading(false);
    }
  }

  // Insert an objection.
  function insertObjection(title: string) {
    const objection = OBJECTIONS.find((o) => o.title === title);
    if (!objection) return;
    const textarea = attorneyResponseRef.current;
    const current = latestInterrogatoriesRef.current[currentPage]?.plaintiffAttorneyResponse || "";
    if (!textarea) {
      saveField(currentPage, "plaintiffAttorneyResponse", `${current}\n\n${objection.text}`);
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const before = current.slice(0, start);
    const after = current.slice(end);
    const inserted = `${before && !before.endsWith("\n") ? "\n\n" : ""}${objection.text}\n\n`;
    saveField(currentPage, "plaintiffAttorneyResponse", before + inserted + after);
    requestAnimationFrame(() => {
      textarea.focus();
      const position = before.length + inserted.length;
      textarea.setSelectionRange(position, position);
    });
  }

  // Navigate between questions.
  async function goToPage(next: number) {
    await flushPendingSave();
    setCurrentPage(next);
    setSelectedObjection("");
    setObjectionMenuOpen(false);
  }

  // Find next unanswered question.
  function findNextUnansweredQuestion() {
    for (let i = currentPage + 1; i < interrogatories.length; i++) if (!interrogatories[i]?.plaintiffAttorneyResponse?.trim()) return i;
    for (let i = 0; i <= currentPage; i++) if (!interrogatories[i]?.plaintiffAttorneyResponse?.trim()) return i;
    return -1;
  }

  // Generate final response.
  async function generateFinalResponse() {
    const current = latestInterrogatoriesRef.current[currentPage];
    if (!current) return;
    try {
      setLoading(true);
      const res = await fetch(`/api/portal/${encodeURIComponent(clientId)}/interrogatories`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "generateFinalResponse",
          question: current.question,
          attorneyResponse: current.plaintiffAttorneyResponse,
          clientResponse: current.plaintiffClientResponse,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Unable to generate response");
      saveField(currentPage, "finalResponse", data.finalResponse || "");
    } catch (e: any) {
      setError(e.message || "Unable to generate response");
    } finally {
      setLoading(false);
    }
  }

  const currentInterrogatory = interrogatories[currentPage];
  const isAtLastQuestion = interrogatories.length > 0 && currentPage === interrogatories.length - 1;
  const unansweredCount = interrogatories.filter((q) => !q.plaintiffAttorneyResponse?.trim()).length;
  const completedCount = interrogatories.length - unansweredCount;

  if (loading && !interrogatories.length) return <main className="min-h-screen flex items-center justify-center">Loading interrogatories...</main>;

  if (error && !interrogatories.length) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center">
          <div className="text-red-600 font-medium mb-4">{error}</div>
          <button onClick={() => window.location.reload()} className="rounded-md bg-[#00305b] px-5 py-3 text-white">
            Try Again
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen relative font-montserrat bg-white md:bg-[url('https://res.cloudinary.com/dre1b2zmh/image/upload/v1781392342/goclegal/background_image_two.webp')] md:bg-cover md:bg-center md:flex md:items-center md:justify-center p-0 md:p-8">
      <div className="hidden md:block absolute inset-0 bg-[#00305bcf]" />
      <div className="relative z-10 w-full max-w-7xl mx-auto bg-white md:bg-white/95 md:backdrop-blur-sm rounded-none md:rounded-xl shadow-none md:shadow-xl p-4 md:p-8">
        {/* Keep desktop toolbar unchanged; only stack status below buttons on mobile. */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button onClick={() => router.back()} className={backLinkClass}>
            ← Profile
          </button>

          <div className="hidden sm:block flex-1 text-center">
            {loading ? "Processing..." : error ? <span className="text-red-500">{error}</span> : <span className="text-green-700 font-medium">{saveStatus}</span>}
          </div>

          <button
            onClick={downloadDocx}
            disabled={loading || !interrogatories.length}
            className="cursor-pointer text-[#00305b] px-5 py-3 rounded-md border border-[#00305b] font-medium disabled:opacity-50"
          >
            Download DOCX
          </button>

          {/* Mobile-only status row. */}
          <div className="w-full text-center sm:hidden">
            {loading ? "Processing..." : error ? <span className="text-red-500">{error}</span> : <span className="text-green-700 font-medium">{saveStatus}</span>}
          </div>
        </div>

        {currentInterrogatory && (
          <div className="mt-5 border border-gray-300 p-5 rounded-md">
            <div className="whitespace-pre-wrap font-bold mb-5">
              {currentInterrogatory.number}
              {"\n\n"}
              {currentInterrogatory.question}
              {currentInterrogatory.questionLines?.length ? `\n\n${currentInterrogatory.questionLines.join("\n")}` : ""}
            </div>

            <div className="relative mb-3">
              <button
                type="button"
                onClick={() => setObjectionMenuOpen((v) => !v)}
                className="w-full border border-gray-300 bg-slate-50 rounded-md px-3 py-2 text-left font-medium flex items-center justify-between"
              >
                <span>{selectedObjection || "Select Objection"}</span>
                <span>▼</span>
              </button>

              {objectionMenuOpen && (
                <div className="absolute z-50 mt-1 w-full rounded-md border border-gray-300 bg-white shadow-lg max-h-[300px] overflow-y-auto">
                  {OBJECTIONS.map((objection) => (
                    <button
                      key={objection.title}
                      type="button"
                      className="w-full text-left px-3 py-2 hover:bg-gray-100 font-medium"
                      onClick={() => {
                        insertObjection(objection.title);
                        setSelectedObjection("");
                        setObjectionMenuOpen(false);
                      }}
                    >
                      {objection.title}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div>
              <div className="font-bold mb-2">Attorney Response</div>
              <textarea
                ref={attorneyResponseRef}
                value={currentInterrogatory.plaintiffAttorneyResponse || ""}
                onChange={(e) => saveField(currentPage, "plaintiffAttorneyResponse", e.target.value)}
                className={textareaClass}
              />
            </div>

            <div className="mt-5">
              <div className="font-bold mb-2">Client Response</div>
              <textarea value={currentInterrogatory.plaintiffClientResponse || ""} onChange={(e) => saveField(currentPage, "plaintiffClientResponse", e.target.value)} className={textareaClass} />
            </div>

            <div className="mt-5">
              <div className="font-bold mb-2">Final Response</div>
              <button type="button" onClick={generateFinalResponse} disabled={loading} className="px-3 py-1 mb-3 rounded-md bg-[#00305b] text-white text-sm cursor-pointer disabled:opacity-50">
                ✨ Generate
              </button>
              <textarea value={currentInterrogatory.finalResponse || ""} onChange={(e) => saveField(currentPage, "finalResponse", e.target.value)} className={textareaClass} />
            </div>
          </div>
        )}

        {!interrogatories.length && !loading && <div className="mt-5 rounded-md border border-gray-300 p-8 text-center text-gray-500">No interrogatories found for this client.</div>}

        {interrogatories.length > 0 && (
          <>
            <div className="mt-5 mb-5">
              <div className="flex justify-between items-center gap-4">
                <button
                  className="text-white font-medium rounded bg-linear-to-r from-[#00305b] to-[#004c8f] gradient-animate min-w-30 p-5 cursor-pointer"
                  onClick={() => void goToPage(currentPage === 0 ? interrogatories.length - 1 : currentPage - 1)}
                >
                  Previous
                </button>

                <div className="text-center font-medium">
                  {currentPage + 1} / {interrogatories.length}
                </div>

                <button
                  className="text-white font-medium rounded bg-linear-to-r from-[#00305b] to-[#004c8f] gradient-animate min-w-30 p-5 cursor-pointer"
                  onClick={async () => {
                    await flushPendingSave();
                    if (currentPage < interrogatories.length - 1) return goToPage(currentPage + 1);
                    if (unansweredCount > 0) {
                      const next = findNextUnansweredQuestion();
                      if (next >= 0) return goToPage(next);
                    }
                  }}
                >
                  {isAtLastQuestion && unansweredCount === 0 ? "Completed" : isAtLastQuestion ? "Next Unanswered" : "Next"}
                </button>
              </div>
            </div>

            <div className="mt-6 text-center">
              <button
                onClick={async () => {
                  await flushPendingSave();
                  setShowContinueLaterModal(true);
                }}
                className="text-[#00305b] font-medium underline cursor-pointer"
              >
                Save & Continue Later
              </button>

              {showContinueLaterModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                  <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-8">
                    <div className="text-2xl mb-4">✓ Your responses have been saved.</div>
                    <div className="space-y-4 text-gray-700">
                      <p>You may safely close this browser window.</p>
                      <p>To continue answering questions later, use the same secure link provided by your attorney.</p>
                      <div className="bg-gray-50 border rounded-lg p-4">
                        <div className="font-semibold mb-1">Current Progress</div>
                        <div>
                          {completedCount} of {interrogatories.length} questions completed.
                        </div>
                      </div>
                    </div>
                    <div className="mt-8 flex justify-end">
                      <button onClick={() => setShowContinueLaterModal(false)} className="text-white font-medium rounded bg-linear-to-r from-[#00305b] to-[#004c8f] px-6 py-3">
                        Got It
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
