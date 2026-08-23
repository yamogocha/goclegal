"use client";
import Link from "next/link";
import { useState } from "react";
import { useSession } from "next-auth/react";

type SearchResult = { clientId: string; clientName: string; clientPhone: string };

const CONSENT_TEXT =
  "I agree to receive SMS/text messages from GOC Legal, P.C. regarding my legal matter, including client intake requests, document or information requests, appointment or treatment reminders, attorney communications, and case-related updates. Message frequency varies based on my case and communication needs. Message and data rates may apply. I can reply STOP to opt out or HELP for assistance. SMS consent is voluntary and is not a condition of receiving legal services.";

export default function AdminPage() {
  const { data: session, status } = useSession();
  const isAdmin = status === "authenticated";
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [recentClients, setRecentClients] = useState<SearchResult[]>([]);
  const [showNewClient, setShowNewClient] = useState(false);
  const [newClientName, setNewClientName] = useState("");
  const [newClientPhone, setNewClientPhone] = useState("");
  const [smsConsent, setSmsConsent] = useState(false);
  const [consentNotes, setConsentNotes] = useState(CONSENT_TEXT);
  const [creatingClient, setCreatingClient] = useState(false);
  const [loadedRecent, setLoadedRecent] = useState(false);

  // Load recent clients for the admin dashboard.
  async function loadRecentClients() {
    if (!isAdmin || loadedRecent) return;
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

  // Search clients for the admin dashboard.
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

  // Reset the client form.
  function resetNewClientForm() {
    setShowNewClient(false);
    setNewClientName("");
    setNewClientPhone("");
    setSmsConsent(false);
    setConsentNotes(CONSENT_TEXT);
  }

  // Create the client and record website SMS consent.
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
            consentedAt: new Date().toISOString(),
            method: "website",
            source: "website_sms_consent",
            collectedBy: isAdmin ? session?.user?.email || session?.user?.name || "GOC Legal Staff" : "Client (website)",
            consentText: consentNotes.trim() || CONSENT_TEXT,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Unable to submit SMS consent");
      resetNewClientForm();
      setLoadedRecent(false);
      if (isAdmin) await loadRecentClients();
    } catch (error) {
      console.error("CREATE CLIENT ERROR", error);
      alert(error instanceof Error ? error.message : "Unable to submit SMS consent");
    } finally {
      setCreatingClient(false);
    }
  }

  if (status === "loading") return <main className="min-h-screen flex items-center justify-center">Loading...</main>;

  const displayClients = query.trim() ? results : recentClients;

  return (
    <main
      onMouseEnter={isAdmin ? loadRecentClients : undefined}
      className="min-h-screen relative font-medium bg-white md:bg-[url('https://res.cloudinary.com/dre1b2zmh/image/upload/v1781392342/goclegal/background_image_two.webp')] md:bg-cover md:bg-center md:flex md:items-start md:justify-center p-0 md:p-8"
    >
      <div className="hidden md:block absolute inset-0 bg-[#00305bcf]" />
      <div className="relative z-10 w-full max-w-7xl mx-auto bg-white md:bg-white/95 md:backdrop-blur-sm rounded-none md:rounded-xl shadow-none md:shadow-xl p-4 md:p-8">
        {isAdmin ? (
          <>
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
                <button
                  onClick={() => setShowNewClient((value) => !value)}
                  className="w-full sm:w-auto cursor-pointer rounded-md bg-[#00305b] px-5 py-3 font-montserrat font-base text-white shadow-sm"
                >
                  {showNewClient ? "Cancel New Client" : "New Client"}
                </button>

                {showNewClient && (
                  <div className="mt-8 w-full rounded-xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
                    <div className="border-b border-gray-200 pb-4">
                      <h2 className="text-2xl font-bold text-[#00305b]">Add New Client</h2>
                      <p className="mt-2 font-montserrat leading-6 text-gray-500">Enter the client's information and confirm that SMS consent was provided through the GOC Legal consent form.</p>
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

                    {/* Admin records completed website consent. */}
                    <div className="mt-6 rounded-lg border border-gray-200 bg-gray-50 p-4 sm:p-5">
                      <div className="flex items-start gap-3">
                        <input id="smsConsent" type="checkbox" checked={smsConsent} onChange={(e) => setSmsConsent(e.target.checked)} className="mt-1 h-5 w-5 cursor-pointer accent-[#00305b]" />
                        <label htmlFor="smsConsent" className="cursor-pointer">
                          <div className="text-xl font-semibold text-[#00305b]">Client completed SMS consent</div>
                          <div className="mt-1 font-montserrat leading-6 text-gray-500">Confirm only after the client has submitted the public GOC Legal SMS consent form.</div>
                        </label>
                      </div>
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
                        {creatingClient ? "Creating & Sending..." : "Record Consent & Send Text"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="w-full rounded-xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="border-b border-gray-200 pb-4">
              <h1 className="text-3xl font-bold text-[#00305b]">GOC Legal SMS Messaging</h1>
              <p className="mt-2 font-montserrat leading-6 text-gray-500">Choose whether you would like to receive case-related text messages from GOC Legal, P.C.</p>
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
                <label className="mb-2 block text-xl font-semibold text-[#00305b]">Mobile Phone</label>
                <input
                  value={newClientPhone}
                  onChange={(e) => setNewClientPhone(e.target.value)}
                  placeholder="Enter mobile phone number"
                  type="tel"
                  autoComplete="tel"
                  className="w-full rounded-lg border border-gray-300 px-4 py-3.5 font-montserrat text-gray-500 outline-none transition focus:border-[#00305b] focus:ring-2 focus:ring-[#00305b]/10"
                />
              </div>
            </div>

            {/* Public customer-facing SMS opt-in. */}
            <div className="mt-6 rounded-lg border border-gray-200 bg-gray-50 p-4 sm:p-5">
              <div className="flex items-start gap-3">
                <input id="smsConsent" type="checkbox" checked={smsConsent} onChange={(e) => setSmsConsent(e.target.checked)} className="mt-1 h-5 w-5 cursor-pointer accent-[#00305b]" />
                <label htmlFor="smsConsent" className="cursor-pointer font-montserrat leading-6 text-gray-500">
                  {CONSENT_TEXT}
                </label>
              </div>
            </div>

            <div className="mt-4 font-montserrat text-gray-500">
              <span>SMS consent is optional. You can continue without consenting to text messages.</span>
            </div>

            <div className="mt-3 font-montserrat text-gray-500">
              <Link href="/privacy-policy" className="text-[#00305b] underline">
                Privacy Policy
              </Link>
              <span> {" • "} </span>
              <Link href="/terms-of-service" className="text-[#00305b] underline">
                Terms of Service
              </Link>
            </div>

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Link href="/" className="w-full rounded-md border border-gray-300 px-5 py-3.5 text-center font-montserrat text-[#00305b] transition hover:bg-gray-50 sm:w-auto">
                No Thanks
              </Link>
              <button
                onClick={createClient}
                disabled={creatingClient || !newClientName.trim() || !newClientPhone.trim() || !smsConsent}
                className="w-full rounded-md bg-linear-to-r from-[#00305b] to-[#004c8f] px-5 py-3.5 font-base font-montserrat text-white shadow-sm transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
              >
                {creatingClient ? "Submitting..." : "Agree & Continue"}
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
