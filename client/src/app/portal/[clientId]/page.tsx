"use client";

import Link from "next/link";
import { use, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export default function ClientProfilePage({ params }: { params: Promise<{ clientId: string }> }) {
  const resolved = use(params);
  const clientId = decodeURIComponent(resolved.clientId);
  const [clientData, setClientData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Load client profile.
  useEffect(() => {
    async function loadClient() {
      try {
        const res = await fetch(`/api/portal/${encodeURIComponent(clientId)}`, { cache: "no-store" });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Unable to load client");
        setClientData(data);
      } catch (error) {
        console.error("LOAD CLIENT ERROR", error);
      } finally {
        setLoading(false);
      }
    }
    void loadClient();
  }, [clientId]);

  // Upload interrogatories and send the client their secure questionnaire link.
  async function handleInterrogatoriesUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/portal/${encodeURIComponent(clientId)}`, { method: "POST", body: formData });
      const data = await res.json();
      if (res.ok && data.redirectTo) {
        router.replace(data.redirectTo);
        return;
      }
      alert(data.error || "Unable to add interrogatories");
    } catch (error) {
      console.error("UPLOAD ERROR", error);
      alert("Unable to add interrogatories");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  if (loading) return <main className="flex min-h-screen items-center justify-center">Loading...</main>;
  if (!clientData?._id) return <main className="p-8">Client not found.</main>;

  const clientName = clientData.clientName || "Unknown Client";
  const hasInterrogatories = !!clientData.interrogatory;
  const interrogatoryHref = `/portal/${encodeURIComponent(clientId)}/interrogatories`;

  return (
    <main className="relative min-h-screen bg-white font-medium md:flex md:items-start md:justify-center md:bg-[url('https://res.cloudinary.com/dre1b2zmh/image/upload/v1781392342/goclegal/background_image_two.webp')] md:bg-cover md:bg-center md:p-8">
      <div className="absolute inset-0 hidden bg-[#00305bcf] md:block" />
      <div className="relative z-10 mx-auto w-full max-w-7xl rounded-none bg-white p-4 shadow-none md:rounded-xl md:bg-white/95 md:p-8 md:shadow-xl md:backdrop-blur-sm">
        <Link
          href="/portal"
          className="mb-5 inline-flex cursor-pointer items-center justify-center rounded bg-linear-to-r from-[#00305b] to-[#004c8f] px-5 py-3 font-montserrat font-medium text-white shadow-[0_0px_10px_rgba(0,0,0,0.3)] gradient-animate"
        >
          ← Dashboard
        </Link>

        <h1 className="text-center text-3xl font-bold text-[#00305b]">{clientName}</h1>
        <div className="mb-8 text-center font-montserrat text-gray-500">{clientData.clientPhone}</div>

        <h2 className="mb-4 font-montserrat font-semibold text-slate-800">Client Tools</h2>

        <div className="grid items-stretch gap-4 md:grid-cols-3">
          <Link href={`/portal/${encodeURIComponent(clientId)}/signUp`} className="flex h-full flex-col justify-center rounded-lg border p-5 transition hover:bg-gray-50">
            <div className="text-2xl font-bold text-[#00305b]">Client Sign-Up</div>
            <div className="mt-1 font-montserrat text-gray-500">Client intake portal.</div>
          </Link>

          <Link href={`/portal/${encodeURIComponent(clientId)}/notices`} className="flex h-full flex-col justify-center rounded-lg border p-5 transition hover:bg-gray-50">
            <div className="text-2xl font-bold text-[#00305b]">Notices</div>
            <div className="mt-1 font-montserrat text-gray-500">Generate and download client notices.</div>
          </Link>

          {hasInterrogatories ? (
            <Link href={interrogatoryHref} className="flex h-full flex-col justify-center rounded-lg border p-5 transition hover:bg-gray-50">
              <div className="text-2xl font-bold text-[#00305b]">Interrogatories</div>
              <div className="mt-1 font-montserrat text-gray-500">Review and manage responses.</div>
            </Link>
          ) : (
            <div className="flex h-full items-center justify-between gap-4 rounded-lg border bg-gray-50 p-5">
              <div>
                <div className="text-2xl font-bold text-[#00305b]">Interrogatories</div>
                <div className="mt-1 font-montserrat text-gray-500">Upload and send the client a secure questionnaire link.</div>
              </div>

              <input ref={fileInputRef} type="file" accept="application/pdf" className="hidden" onChange={handleInterrogatoriesUpload} />

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="shrink-0 cursor-pointer rounded-md bg-[#00305b] px-4 py-2.5 font-montserrat text-sm font-semibold text-white transition hover:bg-[#004c8f] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {uploading ? "Sending..." : "Upload"}
              </button>
            </div>
          )}
        </div>

        <h2 className="mb-4 mt-10 font-montserrat font-semibold text-slate-800">Coming Soon</h2>

        <div className="grid items-stretch gap-4 md:grid-cols-3">
          {["Medical Records", "Demands", "Settlement", "Expenses", "Liens"].map((item) => (
            <div key={item} className="flex h-full flex-col justify-center rounded-lg border bg-gray-50 p-5 opacity-70">
              <div className="text-2xl font-bold text-[#00305b]">{item}</div>
              <div className="mt-1 font-montserrat text-gray-500">Coming soon.</div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
