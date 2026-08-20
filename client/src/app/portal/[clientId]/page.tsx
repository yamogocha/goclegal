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

  // Upload interrogatories for this client.
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
        router.push(data.redirectTo);
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

  if (loading) return <main className="p-8">Loading...</main>;
  if (!clientData?._id) return <main className="p-8">Client not found.</main>;

  const clientName = clientData.clientName || "Unknown Client";
  // const clientAccessToken = clientData.clientAccessToken;
  const hasInterrogatories = !!clientData.interrogatory;
  const interrogatoryHref = `/portal/${encodeURIComponent(clientId)}/interrogatories`;

  return (
    <main className="min-h-screen relative font-medium bg-white md:bg-[url('https://res.cloudinary.com/dre1b2zmh/image/upload/v1781392342/goclegal/background_image_two.webp')] md:bg-cover md:bg-center md:flex md:items-start md:justify-center p-0 md:p-8">
      <div className="hidden md:block absolute inset-0 bg-[#00305bcf]" />
      <div className="relative z-10 w-full max-w-7xl mx-auto bg-white md:bg-white/95 md:backdrop-blur-sm rounded-none md:rounded-xl shadow-none md:shadow-xl p-4 md:p-8">
        <Link
          href="/portal"
          className="inline-flex items-center justify-center text-white font-montserrat font-medium rounded bg-linear-to-r from-[#00305b] to-[#004c8f] gradient-animate px-5 py-3 mb-5 cursor-pointer shadow-[0_0px_10px_rgba(0,0,0,0.3)]"
        >
          ← Dashboard
        </Link>
        <h1 className="text-center text-3xl font-bold text-[#00305b]">{clientName}</h1>
        <div className="text-center text-gray-500 font-montserrat mb-8">{clientData.clientPhone}</div>

        <h2 className="font-montserrat font-semibold text-slate-800 mb-4">Client Tools</h2>
        <div className="grid gap-4 md:grid-cols-3 items-stretch">
          <Link href={`/portal/${encodeURIComponent(clientId)}/signUp`} className="h-full border rounded-lg p-5 hover:bg-gray-50 transition flex flex-col justify-center">
            <div className="font-bold text-2xl text-[#00305b]">Client Sign-Up</div>
            <div className="font-montserrat text-gray-500 mt-1">Client intake portal.</div>
          </Link>

          {hasInterrogatories ? (
            <Link href={interrogatoryHref} className="h-full border rounded-lg p-5 hover:bg-gray-50 transition flex flex-col justify-center">
              <div className="font-bold text-2xl text-[#00305b]">Interrogatories</div>
              <div className="font-montserrat text-gray-500 mt-1">Review and manage responses.</div>
            </Link>
          ) : (
            <div className="h-full border rounded-lg p-5 bg-gray-50 flex items-center justify-between gap-4">
              <div>
                <div className="font-bold text-2xl text-[#00305b]">Interrogatories</div>
                <div className="font-montserrat text-gray-500 mt-1">Add interrogatories.</div>
              </div>
              <input ref={fileInputRef} type="file" accept="application/pdf" className="hidden" onChange={handleInterrogatoriesUpload} />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="shrink-0 cursor-pointer rounded-md bg-[#00305b] px-4 py-2.5 font-montserrat text-sm font-semibold text-white transition hover:bg-[#004c8f] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {uploading ? "Uploading..." : "Upload"}
              </button>
            </div>
          )}
        </div>

        <h2 className="font-montserrat font-semibold text-slate-800 mt-10 mb-4">Coming Soon</h2>
        <div className="grid gap-4 md:grid-cols-3 items-stretch">
          {["Medical Records", "Demands", "Settlement", "Expenses", "Liens"].map((item) => (
            <div key={item} className="h-full border rounded-lg p-5 bg-gray-50 opacity-70 flex flex-col justify-center">
              <div className="font-bold text-2xl text-[#00305b]">{item}</div>
              <div className="font-montserrat text-gray-500 mt-1">Coming soon.</div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
