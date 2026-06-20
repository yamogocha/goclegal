"use client";
import { OBJECTIONS } from "@/lib/tempates";
import { use, useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Interrogatory = {
  number: string;
  question: string;
  questionLines?: string[];
  plaintiffAttorneyResponse: string;
  plaintiffClientResponse: string;
  finalResponse: string;
};

const btnClass = "text-white font-medium rounded bg-linear-to-r from-[#00305b] to-[#004c8f] gradient-animate min-w-30 p-5 cursor-pointer shadow-[0_0px_10px_rgba(0,0,0,0.3)]";
const backLinkClass = "inline-flex items-center justify-center text-white font-medium rounded bg-linear-to-r from-[#00305b] to-[#004c8f] gradient-animate px-5 py-3 cursor-pointer shadow-[0_0px_10px_rgba(0,0,0,0.3)]";
const textareaClass = "w-full min-h-[300px] border border-gray-300 rounded-md p-3";
export default function AdminCasePage({ params }: { params: Promise<{ caseNumber: string }> }) {
  const resolved = use(params);
  const caseNumber = decodeURIComponent(resolved.caseNumber);
  const [interrogatories, setInterrogatories] = useState<Interrogatory[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const successMessageRef = useRef<HTMLDivElement>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [objectionMenuOpen, setObjectionMenuOpen] = useState(false);
  const [selectedObjection, setSelectedObjection] = useState("");
  const attorneyResponseRef = useRef<HTMLTextAreaElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (successMessage && successMessageRef.current) {
      successMessageRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [successMessage]);

  const loadCase = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/${caseNumber}`);
      const text = await res.text();
      if (!text) return;
      let data: any = {};
      try { data = JSON.parse(text); } catch { return; }
      if (data?.interrogatories) setInterrogatories(data.interrogatories);
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
  async function downloadDocx() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/${caseNumber}`, { method: "PATCH" });
      if (!res.ok) {
        const text = await res.text();
        let data: any = {};
        try { data = JSON.parse(text); } catch { throw new Error(text); }
        throw new Error(data.error || "Download failed");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${caseNumber}.docx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setError(e.message || "Download failed");
    } finally {
      setLoading(false);
    }
  }

  function insertObjection(title: string) {
    const objection = OBJECTIONS.find((o) => o.title === title);
    if (!objection) return;
    const textarea = attorneyResponseRef.current;
    const current = interrogatories[currentPage]?.plaintiffAttorneyResponse || "";

    if (!textarea) {
      saveField(currentPage, "plaintiffAttorneyResponse", current + "\n\n" + objection.text );
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const before = current.slice(0, start);
    const after = current.slice(end);
    const insertedText = (before && !before.endsWith("\n") ? "\n\n" : "") + objection.text + "\n\n"; 
    const newValue = before + insertedText + after; 
    saveField( currentPage, "plaintiffAttorneyResponse", newValue );
  
    requestAnimationFrame(() => { 
      textarea.focus();
      const newCursorPos = before.length + insertedText.length; 
      textarea.setSelectionRange( newCursorPos, newCursorPos );
    });
  }

  const goToPage = (next: number) => {
    setCurrentPage(next);
    setSelectedObjection("");
    setObjectionMenuOpen(false);
  };

  function findNextUnansweredQuestion(interrogatories: Interrogatory[], currentPage: number) {
    for (let i = currentPage + 1; i < interrogatories.length; i++) {
      if (!interrogatories[i]?.plaintiffAttorneyResponse?.trim()) return i;
    }
    for (let i = 0; i <= currentPage; i++) {
      if (!interrogatories[i]?.plaintiffAttorneyResponse?.trim()) return i;
    }
    return -1;
  }

  async function generateFinalResponse() {
    const current = interrogatories[currentPage];
    if (!current) return;
    try {
      setLoading(true);
      const res = await fetch(`/api/admin/${caseNumber}`, {
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
      await saveField(currentPage, "finalResponse", data.finalResponse);
    } finally {
      setLoading(false);
    }
  }

  const currentInterrogatory = interrogatories[currentPage];
  const isAtLastQuestion = currentPage === interrogatories.length - 1;
  const unansweredCount = interrogatories.filter((q) => !q.plaintiffAttorneyResponse?.trim()).length;
  
  return (
    <main className="min-h-screen relative font-montserrat bg-white md:bg-[url('https://res.cloudinary.com/dre1b2zmh/image/upload/v1781392342/goclegal/background_image_two.webp')] md:bg-cover md:bg-center md:flex md:items-center md:justify-center p-0 md:p-8">
      <div className="hidden md:block absolute inset-0 bg-[#00305bcf]" />
      <div className="relative z-10 w-full max-w-7xl mx-auto bg-white md:bg-white/95 md:backdrop-blur-sm rounded-none md:rounded-xl shadow-none md:shadow-xl p-4 md:p-8">
        <div className="flex justify-between items-center">
        <button  onClick={() => router.back()} className={backLinkClass}>← Back to Dashboard</button>
          {loading && <div>Processing...</div>}
          {error && <pre className="whitespace-pre-wrap text-red-500">{error}</pre>}
          {successMessage && <div ref={successMessageRef} className="text-green-600 font-medium">{successMessage}</div>}
          <div className="ml-3">
            <button onClick={downloadDocx} className="cursor-pointer text-[#00305b] px-5 py-3 rounded-md border border-[#00305b] font-medium">Download DOCX</button>
          </div>
        </div>
        {currentInterrogatory && (
          <div className="mt-2 border border-gray-300 p-5 rounded-md">
            <div className="whitespace-pre-wrap font-bold mb-5">
              {currentInterrogatory.number}{"\n\n"}
              {currentInterrogatory.questionLines?.length ? currentInterrogatory.questionLines.join("\n") : currentInterrogatory.question}
            </div>
            <div className="relative mb-3">
              <button type="button" onClick={() => setObjectionMenuOpen(!objectionMenuOpen)} className="w-full border border-gray-300 bg-slate-50 rounded-md px-3 py-2 text-left font-medium flex items-center justify-between">
                <span>{selectedObjection || "Select Objection"}</span>
                <span>▼</span>
              </button>
              {objectionMenuOpen && (
                <div className="absolute z-50 mt-1 w-full rounded-md border border-gray-300 bg-white shadow-lg max-h-[300px] overflow-y-auto">
                  {OBJECTIONS.map((objection) => (
                    <button key={objection.title} type="button" className="w-full text-left px-3 py-2 hover:bg-gray-100 font-medium" onClick={() => { setSelectedObjection(objection.title); insertObjection(objection.title); setSelectedObjection(""); setObjectionMenuOpen(false); }}>
                      {objection.title}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div>
              <div className="font-bold mb-2">Attorney Response</div>
              <textarea ref={attorneyResponseRef} value={currentInterrogatory.plaintiffAttorneyResponse || ""} onChange={(e) => saveField(currentPage, "plaintiffAttorneyResponse", e.target.value)} className={textareaClass} />
            </div>
            <div className="mt-5">
              <div className="font-bold mb-2">Client Response</div>
              <textarea value={currentInterrogatory.plaintiffClientResponse || ""} onChange={(e) => saveField(currentPage, "plaintiffClientResponse", e.target.value)} className={textareaClass} />
            </div>
            <div className="mt-5">
              <div className="font-bold mb-2">Final Response</div>
              <button type="button" onClick={generateFinalResponse} className="px-3 py-1 mb-3 rounded-md bg-[#00305b] text-white text-sm cursor-pointer">✨ Generate</button>
              <textarea value={currentInterrogatory.finalResponse || ""} onChange={(e) => saveField(currentPage, "finalResponse", e.target.value)} className="w-full min-h-[300px] border border-gray-300 rounded-md p-3" />
            </div>
          </div>
        )}
        <div className="mt-5 mb-20">
          <div className="text-center font-medium mb-4">INTERROGATORY NO. {currentPage + 1} / {interrogatories.length}</div>
          <div className="flex justify-between items-center gap-4">
            <button className={btnClass} onClick={() => goToPage(currentPage === 0 ? interrogatories.length - 1 : currentPage - 1)}>Previous</button>
            <button className={btnClass} onClick={() => {
              setSuccessMessage("");
              if (currentPage < interrogatories.length - 1) { goToPage(currentPage + 1); return; }
              if (unansweredCount > 0) {
                const next = findNextUnansweredQuestion(interrogatories, currentPage);
                if (next >= 0) { goToPage(next); return; }
              }
              setSuccessMessage("🎉 Congratulations, you finished all the questions!");
            }}>
              {isAtLastQuestion && unansweredCount === 0 ? "Completed" : isAtLastQuestion ? "Next Unanswered" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
