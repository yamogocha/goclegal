"use client";
import Link from "next/link";
import { use, useEffect, useState } from "react";
export default function CaseProfilePage({ params }: { params: Promise<{ caseNumber: string }> }) {
  const resolved = use(params);
  const caseNumber = decodeURIComponent(resolved.caseNumber);
  const [caseData, setCaseData] = useState<any>(null);
  useEffect(() => {
    loadCase();
  }, [caseNumber]);
  async function loadCase() {
    const res = await fetch(`/api/admin/${encodeURIComponent(caseNumber)}`);
    const data = await res.json();
    setCaseData(data);
  }
  if (!caseData) {
    return <main className="p-8">Loading...</main>;
  }
  const plaintiffName = caseData?.metadata?.plaintiffName || "Unknown Plaintiff";
  return (
    <main className="min-h-screen relative font-medium bg-white md:bg-[url('https://res.cloudinary.com/dre1b2zmh/image/upload/v1781392342/goclegal/background_image_two.webp')] md:bg-cover md:bg-center md:flex md:items-start md:justify-center p-0 md:p-8">
      <div className="hidden md:block absolute inset-0 bg-[#00305bcf]" />
      <div className="relative z-10 w-full max-w-7xl mx-auto bg-white md:bg-white/95 md:backdrop-blur-sm rounded-none md:rounded-xl shadow-none md:shadow-xl p-4 md:p-8">
        <Link
          href="/admin"
          className="inline-flex items-center justify-center text-white font-montserrat font-medium rounded bg-linear-to-r from-[#00305b] to-[#004c8f] gradient-animate px-5 py-3 mb-5 cursor-pointer shadow-[0_0px_10px_rgba(0,0,0,0.3)]"
        >
          ← Dashboard
        </Link>
        <h1 className="text-3xl font-bold text-[#00305b]">{plaintiffName}</h1> <div className="text-gray-500 font-montserrat mb-8">Case No. {caseNumber}</div>{" "}
        <h2 className="font-montserrat font-semibold mb-4">Case Tools</h2>{" "}
        <div className="grid gap-4 md:grid-cols-3">
          <Link href={`/admin/${encodeURIComponent(caseNumber)}/interrogatories`} className="border rounded-lg p-5 hover:bg-gray-50 transition">
            <div className="font-semibold text-xl">Admin Interrogatories</div> <div className="font-montserrat text-sm text-gray-500 mt-1">Review and edit responses.</div>
          </Link>{" "}
          <Link href={`/client/${encodeURIComponent(caseNumber)}/interrogatories?token=${caseData.clientAccessToken}`} className="border rounded-lg p-5 hover:bg-gray-50 transition">
            <div className="font-semibold text-xl">Client Interrogatories</div> <div className="font-montserrat text-sm text-gray-500 mt-1">Open client questionnaire.</div>
          </Link>{" "}
          <Link href={`/client/${encodeURIComponent(caseNumber)}/signUp?token=${caseData.clientAccessToken}`} className="border rounded-lg p-5 hover:bg-gray-50 transition">
            <div className="font-semibold text-xl">Client Sign-Up</div> <div className="font-montserrat text-sm text-gray-500 mt-1">Client intake portal.</div>
          </Link>
        </div>{" "}
        <h2 className="font-montserrat font-semibold mt-10 mb-4">Coming Soon</h2>{" "}
        <div className="grid gap-4 md:grid-cols-3">
          {["Medical Records", "Demands", "Settlement", "Expenses", "Liens"].map((item) => (
            <div key={item} className="border rounded-lg p-5 bg-gray-50 opacity-70">
              <div className="font-semibold text-xl">{item}</div> <div className="font-montserrat text-sm text-gray-500 mt-1">Coming soon</div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
