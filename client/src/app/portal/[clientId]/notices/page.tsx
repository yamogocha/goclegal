"use client";

import Link from "next/link";
import { use, useEffect, useRef, useState } from "react";
import { renderAsync } from "docx-preview";

const notices = [
  { id: "representation", title: "Notice of Representation", description: "Prepare a representation letter." },
  { id: "preservation", title: "Evidence Preservation", description: "Prepare an evidence preservation letter." },
  { id: "uberPreservation", title: "Uber Evidence Preservation", description: "Prepare the Uber preservation letter." },
];

async function getError(res: Response) {
  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const data = await res.json();
    return data.error || "Unable to generate notice.";
  }
  const text = await res.text();
  console.error("NOTICE API NON-JSON RESPONSE:", text);
  return `Unable to generate notice. Server returned ${res.status}.`;
}

export default function NoticesPage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId: rawClientId } = use(params);
  const clientId = decodeURIComponent(rawClientId);
  const [client, setClient] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [viewing, setViewing] = useState<string | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  // Load client.
  useEffect(() => {
    async function loadClient() {
      try {
        const res = await fetch(`/api/portal/${encodeURIComponent(clientId)}`, { cache: "no-store" });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Unable to load client");
        setClient(data);
      } catch (error) {
        console.error("LOAD CLIENT ERROR", error);
      } finally {
        setLoading(false);
      }
    }
    void loadClient();
  }, [clientId]);

  // View generated DOCX.
  async function viewNotice(noticeId: string) {
    setBusy(noticeId);
    try {
      const res = await fetch(`/api/portal/${encodeURIComponent(clientId)}/notices/${noticeId}?mode=view`, { cache: "no-store" });
      if (!res.ok) throw new Error(await getError(res));
      const buffer = await res.arrayBuffer();
      setViewing(noticeId);
      requestAnimationFrame(async () => {
        if (!previewRef.current) return;
        previewRef.current.innerHTML = "";
        await renderAsync(buffer, previewRef.current, undefined, { className: "docx-preview" });
      });
    } catch (error) {
      console.error("VIEW NOTICE ERROR", error);
      alert(error instanceof Error ? error.message : "Unable to preview notice.");
    } finally {
      setBusy(null);
    }
  }

  // Download generated DOCX.
  async function downloadNotice(noticeId: string) {
    setBusy(noticeId);
    try {
      const res = await fetch(`/api/portal/${encodeURIComponent(clientId)}/notices/${noticeId}?mode=download`, { cache: "no-store" });
      if (!res.ok) throw new Error(await getError(res));
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const notice = notices.find((item) => item.id === noticeId);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${notice?.title || "Notice"} - ${client.clientName || "Client"}.docx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("DOWNLOAD NOTICE ERROR", error);
      alert(error instanceof Error ? error.message : "Unable to download notice.");
    } finally {
      setBusy(null);
    }
  }

  if (loading) return <main className="min-h-screen flex items-center justify-center">Loading...</main>;
  if (!client?._id) return <main className="min-h-screen flex items-center justify-center">Client not found.</main>;

  return (
    <main className="min-h-screen relative font-medium bg-white md:bg-[url('https://res.cloudinary.com/dre1b2zmh/image/upload/v1781392342/goclegal/background_image_two.webp')] md:bg-cover md:bg-center md:flex md:items-start md:justify-center p-0 md:p-8">
      <div className="hidden md:block absolute inset-0 bg-[#00305bcf]" />
      <div className="relative z-10 w-full max-w-7xl mx-auto">
        <div className="rounded-none md:rounded-xl bg-white p-5 shadow-[0_8px_35px_rgba(0,0,0,0.2)] sm:p-8 lg:p-10">
          <div className="mb-8">
            <Link
              href={`/portal/${encodeURIComponent(clientId)}`}
              className="inline-flex items-center justify-center text-white font-montserrat text-base font-semibold rounded bg-linear-to-r from-[#00305b] to-[#004c8f] gradient-animate px-5 py-3 mb-5 cursor-pointer shadow-[0_0px_10px_rgba(0,0,0,0.3)]"
            >
              ← Profile
            </Link>
            <h1 className="text-center text-4xl font-bold tracking-tight text-[#00305b] sm:text-5xl">Notices</h1>
            <p className="mt-2 text-center font-montserrat leading-7 text-gray-600">Generate client-specific legal notices.</p>
          </div>
          <div className="mx-auto grid max-w-7xl gap-4 md:grid-cols-3">
            {notices.map((notice) => (
              <div key={notice.id} className="flex h-full flex-col rounded-lg border bg-white p-5 shadow-sm transition hover:bg-gray-50">
                <div className="font-bold text-2xl text-[#00305b]">{notice.title}</div>
                <div className="mt-1 flex-1 font-montserrat text-gray-500">{notice.description}</div>
                <div className="mt-5 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => viewNotice(notice.id)}
                    disabled={!!busy}
                    className="cursor-pointer rounded bg-linear-to-r from-[#00305b] to-[#004c8f] px-3 py-2.5 font-montserrat text-sm font-semibold text-white shadow-[0_0px_10px_rgba(0,0,0,0.2)] transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {busy === notice.id ? "Loading..." : "View"}
                  </button>
                  <button
                    type="button"
                    onClick={() => downloadNotice(notice.id)}
                    disabled={!!busy}
                    className="cursor-pointer rounded bg-linear-to-r from-[#00305b] to-[#004c8f] px-3 py-2.5 font-montserrat text-sm font-semibold text-white shadow-[0_0px_10px_rgba(0,0,0,0.2)] transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {busy === notice.id ? "Loading..." : "Download"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      {viewing && (
        <div className="fixed inset-0 z-50 bg-black/60 p-4 md:p-8">
          <div className="mx-auto flex h-full max-w-7xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
            <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-5 py-4">
              <h2 className="font-montserrat font-bold text-lg text-[#00305b]">{notices.find((notice) => notice.id === viewing)?.title}</h2>
              <button
                type="button"
                onClick={() => setViewing(null)}
                className="cursor-pointer rounded bg-linear-to-r from-[#00305b] to-[#004c8f] px-4 py-2 font-montserrat text-sm font-semibold text-white shadow-sm hover:opacity-95"
              >
                Close
              </button>
            </div>
            <div className="flex-1 overflow-auto bg-slate-100 p-4 md:p-8">
              <div ref={previewRef} className="mx-auto w-fit" />
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
