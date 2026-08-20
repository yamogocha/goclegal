"use client";
import { useCallback, useEffect, useRef, useState } from "react";

type Interrogatory = {
  _key?: string;
  number: string;
  question: string;
  questionLines?: string[];
  plaintiffAttorneyResponse: string;
  plaintiffClientResponse: string;
  finalResponse: string;
};

export default function ClientInterrogatories({ clientId }: { clientId: string }) {
  const [interrogatories, setInterrogatories] = useState<Interrogatory[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [saveStatus, setSaveStatus] = useState("Your responses are saved automatically.");
  const [error, setError] = useState("");
  const [showContinueLaterModal, setShowContinueLaterModal] = useState(false);
  const latestRef = useRef<Interrogatory[]>([]);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep ref and state synchronized without a separate state-setting effect.
  const setResponses = useCallback((value: Interrogatory[]) => {
    latestRef.current = value;
    setInterrogatories(value);
  }, []);

  // Load the client's latest interrogatories.
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(`/api/portal/${clientId}/interrogatories`, { cache: "no-store" });
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setError(data.error || "Unable to load interrogatories");
          return;
        }
        setResponses(Array.isArray(data.interrogatories) ? data.interrogatories : []);
      } catch {
        if (!cancelled) setError("Unable to load interrogatories");
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [clientId, setResponses]);

  // Save pending responses before the browser closes.
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (!latestRef.current.length) return;
      navigator.sendBeacon(`/api/portal/${clientId}/interrogatories`, new Blob([JSON.stringify({ interrogatories: latestRef.current })], { type: "application/json" }));
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [clientId]);

  // Persist responses.
  const persist = useCallback(
    async (value: Interrogatory[]) => {
      try {
        const res = await fetch(`/api/portal/${clientId}/interrogatories`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ interrogatories: value }),
        });
        if (!res.ok) throw new Error();
        setSaveStatus("✓ Progress saved");
        window.setTimeout(() => setSaveStatus(""), 2000);
      } catch {
        setSaveStatus("Unable to save. Please check your connection.");
      }
    },
    [clientId],
  );

  // Update a client response and debounce saving.
  function saveField(index: number, value: string) {
    const updated = latestRef.current.map((item, i) => (i === index ? { ...item, plaintiffClientResponse: value } : item));
    setResponses(updated);
    setSaveStatus("Saving...");
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => void persist(updated), 1500);
  }

  // Flush pending save.
  async function flushPendingSave() {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
      await persist(latestRef.current);
    }
  }

  // Find the next unanswered question.
  function findNextUnanswered(current: number) {
    for (let i = current + 1; i < interrogatories.length; i++) if (!interrogatories[i]?.plaintiffClientResponse?.trim()) return i;
    for (let i = 0; i <= current; i++) if (!interrogatories[i]?.plaintiffClientResponse?.trim()) return i;
    return -1;
  }

  const current = interrogatories[currentPage];
  const isLast = interrogatories.length > 0 && currentPage === interrogatories.length - 1;
  const unanswered = interrogatories.filter((q) => !q.plaintiffClientResponse?.trim()).length;
  const completed = interrogatories.length - unanswered;

  if (error) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <div className="text-red-600 font-medium">{error}</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen relative font-montserrat bg-white md:bg-[url('https://res.cloudinary.com/dre1b2zmh/image/upload/v1781392342/goclegal/background_image_two.webp')] md:bg-cover md:bg-center md:flex md:items-center md:justify-center p-0 md:p-8">
      <div className="hidden md:block absolute inset-0 bg-[#00305bcf]" />
      <div className="relative z-10 w-full max-w-7xl mx-auto bg-white md:bg-white/95 md:backdrop-blur-sm rounded-none md:rounded-xl shadow-none md:shadow-xl p-4 md:p-8">
        <div className="sticky top-0 z-20 mb-4 text-center rounded-md px-4 py-2 text-green-700 font-medium">{saveStatus}</div>

        {!interrogatories.length ? (
          <div className="border border-gray-300 rounded-md p-8 text-center text-gray-500">Loading interrogatories...</div>
        ) : (
          <>
            <div className="border border-gray-300 p-5 rounded-md">
              <div className="whitespace-pre-wrap font-bold mb-5">
                {current?.number}
                {"\n\n"}
                {current?.question}
                {current?.questionLines?.length ? `\n\n${current.questionLines.join("\n")}` : ""}
              </div>
              <div className="mt-5">
                <div className="font-bold mb-2">Your Response</div>
                <textarea
                  value={current?.plaintiffClientResponse || ""}
                  onChange={(e) => saveField(currentPage, e.target.value)}
                  className="w-full min-h-[300px] border border-gray-300 rounded-md p-3"
                />
              </div>
            </div>

            <div className="mt-5 mb-5 flex justify-between items-center gap-4">
              <button
                onClick={async () => {
                  await flushPendingSave();
                  setCurrentPage(currentPage === 0 ? interrogatories.length - 1 : currentPage - 1);
                }}
                className="text-white font-medium rounded bg-linear-to-r from-[#00305b] to-[#004c8f] gradient-animate min-w-30 p-5 cursor-pointer"
              >
                Previous
              </button>
              <div className="text-center font-medium">
                {currentPage + 1} / {interrogatories.length}
              </div>
              <button
                onClick={async () => {
                  await flushPendingSave();
                  if (currentPage < interrogatories.length - 1) return setCurrentPage(currentPage + 1);
                  if (unanswered > 0) {
                    const next = findNextUnanswered(currentPage);
                    if (next >= 0) setCurrentPage(next);
                  }
                }}
                className="text-white font-medium rounded bg-linear-to-r from-[#00305b] to-[#004c8f] gradient-animate min-w-30 p-5 cursor-pointer"
              >
                {isLast && unanswered === 0 ? "Completed" : isLast ? "Next Unanswered" : "Next"}
              </button>
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
            </div>

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
                        {completed} of {interrogatories.length} questions completed.
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
          </>
        )}
      </div>
    </main>
  );
}
