"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type SearchResult = {
  plaintiffName: string;
  caseNumber: string;
  links: { label: string; href: string }[];
};

export default function AdminPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);

  useEffect(() => {
    const savedQuery = sessionStorage.getItem("adminQuery");
    const savedResults = sessionStorage.getItem("adminResults");
  
    if (savedQuery) setQuery(savedQuery);
  
    if (savedResults) {
      try {
        setResults(JSON.parse(savedResults));
      } catch {}
    }
  }, []);
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      sessionStorage.removeItem("adminQuery");
      sessionStorage.removeItem("adminResults");
      return;
    }
  
    const timeout = setTimeout(async () => {
      const res = await fetch(`/api/admin?q=${encodeURIComponent(query)}`);
      const data = await res.json();
  
      setResults(data);
  
      sessionStorage.setItem("adminQuery", query);
      sessionStorage.setItem("adminResults", JSON.stringify(data));
    }, 300);
  
    return () => clearTimeout(timeout);
  }, [query]);

  async function handleNewCaseUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch("/api/admin", {
      method: "POST",
      body: formData,
    });

    const data = await res.json();

    console.log("UPLOAD RESULT", data);

    if (res.ok && data.redirectTo) {
      router.push(data.redirectTo);
      return;
    }

    e.target.value = "";
  }

  return (
    <main className="min-h-screen relative font-medium bg-white md:bg-[url('https://res.cloudinary.com/dre1b2zmh/image/upload/v1781392342/goclegal/background_image_two.webp')] md:bg-cover md:bg-center md:flex md:items-start md:justify-center p-0 md:p-8">
      <div className="hidden md:block absolute inset-0 bg-[#00305bcf]" />

      <div className="relative z-10 w-full max-w-7xl mx-auto bg-white md:bg-white/95 md:backdrop-blur-sm rounded-none md:rounded-xl shadow-none md:shadow-xl p-4 md:p-8">
        <h1 className="text-2xl font-bold mb-5 text-[#00305b]">
          Admin Dashboard
        </h1>

        <div className="relative">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search plaintiff..."
            className="outline-none w-full border border-gray-300 rounded-md px-4 py-3 font-montserrat font-medium"
          />

          {results.map((item) => (
            <div
              key={item.caseNumber}
              className="px-4 py-3 border-b border-gray-100 font-montserrat font-medium"
            >
              <div className="font-medium">{item.plaintiffName}</div>

              <div className="text-sm text-gray-500 mb-2">
                {item.caseNumber}
              </div>

              <div className="flex gap-4">
                {item.links.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="text-blue-600 hover:underline"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>
          ))}

          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={handleNewCaseUpload}
          />

          <button
            onClick={() => fileInputRef.current?.click()}
            className="cursor-pointer text-white bg-[#00305b] px-4 py-3 my-3 rounded-md font-medium font-montserrat"
          >
            New Case
          </button>
        </div>
      </div>
    </main>
  );
}