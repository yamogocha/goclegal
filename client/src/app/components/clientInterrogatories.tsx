"use client";
import { use, useEffect, useState, useCallback, useRef } from "react";

type Interrogatory = {
  number: string;
  question: string;
  questionLines?: string[];
  plaintiffAttorneyResponse: string;
  plaintiffClientResponse: string;
  finalResponse: string;
};

export default function ClientInterrogatories({ params }: { params: Promise<{ caseNumber: string }> }) {
  const resolved = use(params);
  const caseNumber = decodeURIComponent(resolved.caseNumber);
  const [interrogatories, setInterrogatories] = useState<Interrogatory[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [saveStatus, setSaveStatus] = useState("Your responses are saved automatically.");
  const saveStatusRef = useRef<HTMLDivElement>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const latestInterrogatoriesRef = useRef<Interrogatory[]>([]);
  const [showContinueLaterModal, setShowContinueLaterModal] = useState(false);

  useEffect(() => {
    const handleBeforeUnload = () => {
      if (saveTimeoutRef.current) {
        navigator.sendBeacon(`/api/admin/${caseNumber}/interrogatories`, JSON.stringify({ interrogatories }));
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [caseNumber, interrogatories]);

  useEffect(() => {
    latestInterrogatoriesRef.current = interrogatories;
  }, [interrogatories]);

  const loadCase = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/${caseNumber}/interrogatories`);
      const text = await res.text();
      if (!text) return;
      try {
        const data = JSON.parse(text);
        if (data?.interrogatories) setInterrogatories(data.interrogatories);
      } catch {}
    } catch {}
  }, [caseNumber]);

  useEffect(() => {
    loadCase();
  }, [loadCase]);

  async function persistInterrogatories(updated: Interrogatory[]) {
    try {
      await fetch(`/api/admin/${caseNumber}/interrogatories`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interrogatories: updated }),
      });

      setSaveStatus("✓ Progress saved");
      setTimeout(() => {
        setSaveStatus("");
      }, 2000);
    } catch {
      setSaveStatus("Unable to save. Please check your connection.");
    }
  }

  async function saveField(index: number, field: "plaintiffAttorneyResponse" | "plaintiffClientResponse" | "finalResponse", value: string) {
    const updated = [...interrogatories];
    updated[index] = { ...updated[index], [field]: value };
    setInterrogatories(updated);
    setSaveStatus("Saving...");

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      persistInterrogatories(latestInterrogatoriesRef.current);
    }, 1500);
  }

  async function flushPendingSave() {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;

      await persistInterrogatories(interrogatories);
    }
  }

  const goToPage = (page: number) => setCurrentPage(page);

  function findNextUnansweredQuestion(interrogatories: Interrogatory[], currentPage: number) {
    for (let i = currentPage + 1; i < interrogatories.length; i++) if (!interrogatories[i]?.plaintiffClientResponse?.trim()) return i;
    for (let i = 0; i <= currentPage; i++) if (!interrogatories[i]?.plaintiffClientResponse?.trim()) return i;
    return -1;
  }

  const currentInterrogatory = interrogatories[currentPage];
  const isAtLastQuestion = currentPage === interrogatories.length - 1;
  const unansweredCount = interrogatories.filter((q) => !q.plaintiffClientResponse?.trim()).length;
  const completedCount = interrogatories.length - unansweredCount;

  return (
    <main className="min-h-screen relative font-montserrat bg-white md:bg-[url('https://res.cloudinary.com/dre1b2zmh/image/upload/v1781392342/goclegal/background_image_two.webp')] md:bg-cover md:bg-center md:flex md:items-center md:justify-center p-0 md:p-8">
      <div className="hidden md:block absolute inset-0 bg-[#00305bcf]" />
      <div className="relative z-10 w-full max-w-7xl mx-auto bg-white md:bg-white/95 md:backdrop-blur-sm rounded-none md:rounded-xl shadow-none md:shadow-xl p-4 md:p-8">
        <div ref={saveStatusRef} className="sticky top-0 z-20 mb-4 text-center rounded-md not-odd:px-4 py-2 text-green-700 font-medium">
          {saveStatus}
        </div>

        {currentInterrogatory && (
          <div className="mt-2 border border-gray-300 p-5 rounded-md">
            <div className="whitespace-pre-wrap font-bold mb-5">
              {currentInterrogatory.number}
              {"\n\n"}
              {currentInterrogatory.question}
              {currentInterrogatory.questionLines?.length ? "\n\n" + currentInterrogatory.questionLines.join("\n") : ""}
            </div>

            <div className="mt-5">
              <div className="font-bold mb-2">Client Response</div>
              <textarea
                value={currentInterrogatory.plaintiffClientResponse || ""}
                onChange={(e) => saveField(currentPage, "plaintiffClientResponse", e.target.value)}
                className="w-full min-h-[300px] border border-gray-300 rounded-md p-3"
              />
            </div>
          </div>
        )}

        <div className="mt-5 mb-5">
          <div className="flex justify-between items-center gap-4">
            <button
              className="text-white font-medium rounded bg-linear-to-r from-[#00305b] to-[#004c8f] gradient-animate min-w-30 p-5 cursor-pointer shadow-[0_0px_10px_rgba(0,0,0,0.3)]"
              onClick={async () => {
                await flushPendingSave();
                goToPage(currentPage === 0 ? interrogatories.length - 1 : currentPage - 1);
              }}
            >
              Previous
            </button>
            <div className="text-center font-medium">
              {currentPage + 1} / {interrogatories.length}
            </div>
            <button
              className="text-white font-medium rounded bg-linear-to-r from-[#00305b] to-[#004c8f] gradient-animate min-w-30 p-5 cursor-pointer shadow-[0_0px_10px_rgba(0,0,0,0.3)]"
              onClick={async () => {
                await flushPendingSave();
                if (currentPage < interrogatories.length - 1) return goToPage(currentPage + 1);
                if (unansweredCount > 0) {
                  const next = findNextUnansweredQuestion(interrogatories, currentPage);
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
      </div>
    </main>
  );
}
