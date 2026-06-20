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
  const [successMessage, setSuccessMessage] = useState("");
  const successMessageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (successMessage && successMessageRef.current) successMessageRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [successMessage]);

  const loadCase = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/${caseNumber}`);
      const text = await res.text();
      if (!text) return;
      try {
        const data = JSON.parse(text);
        if (data?.interrogatories) setInterrogatories(data.interrogatories);
      } catch {}
    } catch {}
  }, [caseNumber]);

  useEffect(() => { loadCase(); }, [loadCase]);

  async function saveField(index: number, field: "plaintiffAttorneyResponse" | "plaintiffClientResponse" | "finalResponse", value: string) {
    const updated = [...interrogatories];
    updated[index] = { ...updated[index], [field]: value };
    setInterrogatories(updated);
    try {
      await fetch(`/api/admin/${caseNumber}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interrogatories: updated }),
      });
    } catch {}
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

  return (
    <main className="min-h-screen relative font-montserrat bg-white md:bg-[url('https://res.cloudinary.com/dre1b2zmh/image/upload/v1781392342/goclegal/background_image_two.webp')] md:bg-cover md:bg-center md:flex md:items-center md:justify-center p-0 md:p-8">
      <div className="hidden md:block absolute inset-0 bg-[#00305bcf]" />
      <div className="relative z-10 w-full max-w-7xl mx-auto bg-white md:bg-white/95 md:backdrop-blur-sm rounded-none md:rounded-xl shadow-none md:shadow-xl p-4 md:p-8">
        {successMessage && <div ref={successMessageRef} className="text-green-600 font-medium text-center">{successMessage}</div>}

        {currentInterrogatory && (
          <div className="mt-2 border border-gray-300 p-5 rounded-md">
            <div className="whitespace-pre-wrap font-bold mb-5">
            {currentInterrogatory.number}{"\n\n"}{currentInterrogatory.question}
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
          <div className="text-center font-medium mb-4">
            INTERROGATORY NO. {currentPage + 1} / {interrogatories.length}
          </div>

          <div className="flex justify-between items-center gap-4">
            <button
              className="text-white font-medium rounded bg-linear-to-r from-[#00305b] to-[#004c8f] gradient-animate min-w-30 p-5 cursor-pointer shadow-[0_0px_10px_rgba(0,0,0,0.3)]"
              onClick={() => goToPage(currentPage === 0 ? interrogatories.length - 1 : currentPage - 1)}
            >
              Previous
            </button>

            <button
              className="text-white font-medium rounded bg-linear-to-r from-[#00305b] to-[#004c8f] gradient-animate min-w-30 p-5 cursor-pointer shadow-[0_0px_10px_rgba(0,0,0,0.3)]"
              onClick={() => {
                setSuccessMessage("");
                if (currentPage < interrogatories.length - 1) return goToPage(currentPage + 1);
                if (unansweredCount > 0) {
                  const next = findNextUnansweredQuestion(interrogatories, currentPage);
                  if (next >= 0) return goToPage(next);
                }
                setSuccessMessage("🎉 Congratulations, you finished all the questions!");
              }}
            >
              {isAtLastQuestion && unansweredCount === 0 ? "Completed" : isAtLastQuestion ? "Next Unanswered" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}