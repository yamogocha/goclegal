"use client";
import Link from "next/link";
import { useState } from "react";
import { signIn, useSession } from "next-auth/react";

type SearchResult = { clientId: string; clientName: string; clientPhone: string };

const CONSENT_TEXT =
  "GOC Legal would like to communicate with you by text message regarding your case, including your intake, documents, appointments, treatment reminders, and messages from our office. Message and data rates may apply. You can opt out at any time by replying STOP. Do you agree to receive text messages from GOC Legal?";

export default function AdminPage() {
  const { data: session, status } = useSession();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [recentClients, setRecentClients] = useState<SearchResult[]>([]);
  const [showNewClient, setShowNewClient] = useState(false);
  const [newClientName, setNewClientName] = useState("");
  const [newClientPhone, setNewClientPhone] = useState("");
  const [smsConsent, setSmsConsent] = useState(false);
  const [consentDate, setConsentDate] = useState(() => new Date().toISOString().slice(0, 16));
  const [consentMethod, setConsentMethod] = useState("phone");
  const [consentNotes, setConsentNotes] = useState(CONSENT_TEXT);
  const [creatingClient, setCreatingClient] = useState(false);
  const [loadedRecent, setLoadedRecent] = useState(false);

  // Load recent clients when the dashboard is first interacted with.
  async function loadRecentClients() {
    if (loadedRecent) return;
    try {
      const res = await fetch("/api/portal?recent=true");
      if (!res.ok) return;
      const data = await res.json();
      setRecentClients(Array.isArray(data) ? data : []);
      setLoadedRecent(true);
    } catch (error) {
      console.error("LOAD RECENT CLIENTS ERROR", error);
    }
  }

  // Search clients.
  async function searchClients(value: string) {
    setQuery(value);
    const search = value.trim();
    if (!search) {
      setResults([]);
      return;
    }
    try {
      const res = await fetch(`/api/portal?q=${encodeURIComponent(search)}`);
      if (!res.ok) return;
      const data = await res.json();
      setResults(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("SEARCH CLIENTS ERROR", error);
    }
  }

  // Reset the new-client form.
  function resetNewClientForm() {
    setShowNewClient(false);
    setNewClientName("");
    setNewClientPhone("");
    setSmsConsent(false);
    setConsentDate(new Date().toISOString().slice(0, 16));
    setConsentMethod("phone");
    setConsentNotes(CONSENT_TEXT);
  }

  // Create client and send intake link only after consent is recorded.
  async function createClient() {
    if (!newClientName.trim() || !newClientPhone.trim() || !smsConsent) return;
    setCreatingClient(true);
    try {
      const res = await fetch("/api/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientName: newClientName.trim(),
          clientPhone: newClientPhone.trim(),
          smsConsent: {
            consented: true,
            consentedAt: new Date(consentDate).toISOString(),
            method: consentMethod,
            source: "attorney_phone_call",
            collectedBy: session?.user?.email || session?.user?.name || "GOC Legal Staff",
            consentText: consentNotes.trim() || CONSENT_TEXT,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Unable to create client");
      resetNewClientForm();
      setLoadedRecent(false);
      await loadRecentClients();
    } catch (error) {
      console.error("CREATE CLIENT ERROR", error);
      alert(error instanceof Error ? error.message : "Unable to create client");
    } finally {
      setCreatingClient(false);
    }
  }

  if (status === "loading") return <main className="min-h-screen flex items-center justify-center">Loading...</main>;

  if (!session) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="bg-white p-8 rounded-xl shadow-lg max-w-md w-full">
          <h1 className="text-2xl font-bold text-[#00305b] mb-4">GOC Legal Admin</h1>
          <p className="text-gray-600 mb-6">Sign in with your authorized Google account to access case management.</p>
          <button onClick={() => signIn("google", { callbackUrl: "/portal" })} className="w-full bg-[#00305b] text-white py-3 rounded-md font-medium">
            Sign in with Google
          </button>
        </div>
      </main>
    );
  }

  const displayClients = query.trim() ? results : recentClients;

  return (
    <main
      onMouseEnter={loadRecentClients}
      className="min-h-screen relative font-medium bg-white md:bg-[url('https://res.cloudinary.com/dre1b2zmh/image/upload/v1781392342/goclegal/background_image_two.webp')] md:bg-cover md:bg-center md:flex md:items-start md:justify-center p-0 md:p-8"
    >
      <div className="hidden md:block absolute inset-0 bg-[#00305bcf]" />
      <div className="relative z-10 w-full max-w-7xl mx-auto bg-white md:bg-white/95 md:backdrop-blur-sm rounded-none md:rounded-xl shadow-none md:shadow-xl p-4 md:p-8">
        <h1 className="text-3xl font-bold mb-5 text-[#00305b]">Admin Dashboard</h1>
        <div className="relative">
          <input
            value={query}
            onChange={(e) => void searchClients(e.target.value)}
            placeholder="Search client..."
            className="outline-none w-full border border-gray-300 rounded-md px-4 py-3 font-montserrat font-medium"
          />

          {!query.trim() && (
            <div className="mt-10 mb-4">
              <h2 className="font-semibold text-[#00305b] font-montserrat">Recent Clients</h2>
            </div>
          )}
          {query.trim() && results.length === 0 && <div className="py-8 text-center text-gray-500 font-montserrat">No clients found.</div>}

          {displayClients.map((item, index) => (
            <Link
              key={`${item.clientId || item.clientPhone}-${index}`}
              href={`/portal/${encodeURIComponent(item.clientId)}`}
              className="block p-4 border-b border-gray-200 hover:bg-gray-50 transition"
            >
              <div className="text-xl font-semibold text-[#00305b]">{item.clientName}</div>
              <div className="text-gray-500 font-montserrat">{item.clientPhone}</div>
            </Link>
          ))}

          {/* New client */}
          <div className="mt-10">
            <button onClick={() => setShowNewClient((value) => !value)} className="w-full sm:w-auto cursor-pointer rounded-md bg-[#00305b] px-5 py-3 font-montserrat font-base text-white shadow-sm">
              {showNewClient ? "Cancel New Client" : "New Client"}
            </button>

            {showNewClient && (
              <div className="mt-8 w-full rounded-xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
                <div className="border-b border-gray-200 pb-4">
                  <h2 className="text-2xl font-bold text-[#00305b]">Add New Client</h2>
                  <p className="mt-2 font-montserrat leading-6 text-gray-500">Enter the client&apos;s information and record SMS consent before sending the secure intake link.</p>
                </div>

                <div className="mt-5 grid gap-5 sm:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-xl font-semibold text-[#00305b]">Client Name</label>
                    <input
                      value={newClientName}
                      onChange={(e) => setNewClientName(e.target.value)}
                      placeholder="Enter client name"
                      autoComplete="name"
                      className="w-full rounded-lg border border-gray-300 px-4 py-3.5 font-montserrat text-gray-500 outline-none transition focus:border-[#00305b] focus:ring-2 focus:ring-[#00305b]/10"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-xl font-semibold text-[#00305b]">Client Phone</label>
                    <input
                      value={newClientPhone}
                      onChange={(e) => setNewClientPhone(e.target.value)}
                      placeholder="Enter phone number"
                      type="tel"
                      autoComplete="tel"
                      className="w-full rounded-lg border border-gray-300 px-4 py-3.5 font-montserrat text-gray-500 outline-none transition focus:border-[#00305b] focus:ring-2 focus:ring-[#00305b]/10"
                    />
                  </div>
                </div>

                {/* SMS consent */}
                <div className="mt-6 rounded-lg border border-gray-200 bg-gray-50 p-4 sm:p-5">
                  <div className="flex items-start gap-3">
                    <input id="smsConsent" type="checkbox" checked={smsConsent} onChange={(e) => setSmsConsent(e.target.checked)} className="mt-1 h-5 w-5 cursor-pointer accent-[#00305b]" />
                    <label htmlFor="smsConsent" className="cursor-pointer">
                      <div className="text-xl font-semibold text-[#00305b]">Client consented to SMS</div>
                      <div className="mt-1 font-montserrat leading-6 text-gray-500">The client gave verbal consent during a phone call to receive case-related text messages from GOC Legal.</div>
                    </label>
                  </div>

                  {smsConsent && (
                    <div className="mt-5 grid gap-5 sm:grid-cols-2">
                      <div>
                        <label className="mb-2 block text-xl font-semibold text-[#00305b]">Consent Date & Time</label>
                        <input
                          type="datetime-local"
                          value={consentDate}
                          onChange={(e) => setConsentDate(e.target.value)}
                          className="w-full rounded-lg border border-gray-300 px-4 py-3 font-montserrat text-gray-500 outline-none focus:border-[#00305b] focus:ring-2 focus:ring-[#00305b]/10"
                        />
                      </div>
                      <div>
                        <label className="mb-2 block text-xl font-semibold text-[#00305b]">Consent Method</label>
                        <select
                          value={consentMethod}
                          onChange={(e) => setConsentMethod(e.target.value)}
                          className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 font-montserrat text-gray-500 outline-none focus:border-[#00305b] focus:ring-2 focus:ring-[#00305b]/10"
                        >
                          <option value="phone">Phone / Verbal</option>
                          <option value="written">Written</option>
                          <option value="website">Website</option>
                        </select>
                      </div>
                      <div className="sm:col-span-2">
                        <label className="mb-2 block text-xl font-semibold text-[#00305b]">Consent Language Used</label>
                        <textarea
                          value={consentNotes}
                          onChange={(e) => setConsentNotes(e.target.value)}
                          className="min-h-28 w-full rounded-lg border border-gray-300 px-4 py-3 font-montserrat text-gray-500 outline-none focus:border-[#00305b] focus:ring-2 focus:ring-[#00305b]/10"
                        />
                        <p className="mt-1 text-xl font-semibold text-[#00305b]">Keep the exact language used by the attorney whenever possible.</p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                  <button
                    onClick={resetNewClientForm}
                    disabled={creatingClient}
                    className="w-full rounded-md border border-gray-300 px-5 py-3.5 font-montserrat text-[#00305b] transition hover:bg-gray-50 disabled:opacity-50 sm:w-auto"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={createClient}
                    disabled={creatingClient || !newClientName.trim() || !newClientPhone.trim() || !smsConsent}
                    className="w-full rounded-md bg-linear-to-r from-[#00305b] to-[#004c8f] px-5 py-3.5 font-base font-montserrat text-white shadow-sm transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                  >
                    {creatingClient ? "Creating & Sending..." : "Record Consent & Text Client"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
