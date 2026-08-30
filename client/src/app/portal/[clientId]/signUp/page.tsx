"use client";
import Link from "next/link";
import { use, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type FormData = {
  clientName: string;
  clientPhone: string;
  clientDob: string;
  clientEmail: string;
  clientSsnLast4: string;
  clientAutoInsurance: string;
  clientPolicyNumber: string;
  clientClaimNumber: string;
  clientHealthInsurance: string;
  clientHealthInsuranceMemberNumber: string;
  injuries: string;
  medicalCare: string;
  medicalProvider: string;
  driverLicense: File | null;
  healthInsuranceCards: File | null;
  declarationPage: File | null;
  collisionLocation: string;
  collisionDate: string;
  collisionDescription: string;
  policeDepartment: string;
  policeReportNumber: string;
  defendantName: string;
  defendantInsurance: string;
  defendantAdjuster: string;
  defendantPolicyNumber: string;
  defendantClaimNumber: string;
};

type StringField = Exclude<keyof FormData, "driverLicense" | "healthInsuranceCards" | "declarationPage">;
type FileField = "driverLicense" | "healthInsuranceCards" | "declarationPage";

const initialForm: FormData = {
  clientName: "",
  clientPhone: "",
  clientDob: "",
  clientEmail: "",
  clientSsnLast4: "",
  clientAutoInsurance: "",
  clientPolicyNumber: "",
  clientClaimNumber: "",
  clientHealthInsurance: "",
  clientHealthInsuranceMemberNumber: "",
  injuries: "",
  medicalCare: "",
  medicalProvider: "",
  driverLicense: null,
  healthInsuranceCards: null,
  declarationPage: null,
  collisionLocation: "",
  collisionDate: "",
  collisionDescription: "",
  policeDepartment: "",
  policeReportNumber: "",
  defendantName: "",
  defendantInsurance: "",
  defendantAdjuster: "",
  defendantPolicyNumber: "",
  defendantClaimNumber: "",
};

const optionalFields = new Set<StringField | FileField>([
  "declarationPage",
  "policeDepartment",
  "policeReportNumber",
  "collisionDescription",
  "defendantName",
  "defendantInsurance",
  "defendantAdjuster",
  "defendantPolicyNumber",
  "defendantClaimNumber",
]);

const stringFields: StringField[] = [
  "clientName",
  "clientPhone",
  "clientDob",
  "clientEmail",
  "clientSsnLast4",
  "clientAutoInsurance",
  "clientPolicyNumber",
  "clientClaimNumber",
  "clientHealthInsurance",
  "clientHealthInsuranceMemberNumber",
  "injuries",
  "medicalCare",
  "medicalProvider",
  "collisionLocation",
  "collisionDate",
  "collisionDescription",
  "policeDepartment",
  "policeReportNumber",
  "defendantName",
  "defendantInsurance",
  "defendantAdjuster",
  "defendantPolicyNumber",
  "defendantClaimNumber",
];

export default function ClientSignupPage({ params, searchParams }: { params: Promise<{ clientId: string }>; searchParams: Promise<{ token?: string }> }) {
  const { clientId } = use(params);
  const { token } = use(searchParams);
  const [form, setForm] = useState<FormData>(initialForm);
  const [mode, setMode] = useState<"admin" | "client" | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadedRef = useRef(false);

  // Load only after the API validates admin session or client token.
  useEffect(() => {
    async function load() {
      try {
        const query = token ? `?token=${encodeURIComponent(token)}` : "";
        const res = await fetch(`/api/portal/${encodeURIComponent(clientId)}/signUp${query}`, { cache: "no-store" });
        const data = await res.json();
        if (res.status === 401) {
          window.location.href = `/api/auth/signin?callbackUrl=${encodeURIComponent(window.location.href)}`;
          return;
        }
        if (!res.ok) throw new Error(data.error || "Unable to load intake");
        const normalized: Partial<FormData> = {};
        for (const field of stringFields) normalized[field] = typeof data.client?.[field] === "string" ? data.client[field] : "";
        setMode(data.mode);
        setForm((prev) => ({ ...prev, ...normalized }));
        loadedRef.current = true;
      } catch (error) {
        console.error("LOAD SIGNUP ERROR", error);
        window.location.href = `/api/auth/signin?callbackUrl=${encodeURIComponent(window.location.href)}`;
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [clientId, token, router]);

  // Autosave scalar fields 700ms after the user stops typing.
  useEffect(() => {
    if (!loadedRef.current || !mode) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        const body = Object.fromEntries(stringFields.map((field) => [field, form[field] ?? ""]));
        const query = token ? `?token=${encodeURIComponent(token)}` : "";
        const res = await fetch(`/api/portal/${encodeURIComponent(clientId)}/signUp${query}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (res.status === 401) {
          window.location.href = `/api/auth/signin?callbackUrl=${encodeURIComponent(window.location.href)}`;
        }
      } catch (error) {
        console.error("AUTOSAVE ERROR", error);
      }
    }, 700);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [form, clientId, token, mode, router]);

  // Update text fields only.
  const updateText = (field: StringField, value: string) => setForm((prev) => ({ ...prev, [field]: value }));

  // Update file fields only.
  const updateFile = (field: FileField, value: File | null) => setForm((prev) => ({ ...prev, [field]: value }));

  // Render text input.
  const input = (field: StringField, label: string, type = "text") => {
    const required = !optionalFields.has(field);
    return (
      <div className="space-y-2">
        <label htmlFor={field} className="block font-montserrat font-semibold text-slate-800">
          {label}
          {required && <span className="text-red-600"> *</span>}
        </label>
        <input
          id={field}
          name={field}
          type={type}
          value={form[field] || ""}
          required={required}
          onChange={(e) => updateText(field, e.target.value)}
          className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 font-montserrat text-gray-500 outline-none transition focus:border-[#00305b] focus:ring-2 focus:ring-[#00305b]/15"
        />
      </div>
    );
  };

  // Render textarea.
  const textarea = (field: StringField, label: string) => {
    const required = !optionalFields.has(field);
    return (
      <div className="space-y-2">
        <label htmlFor={field} className="block font-montserrat font-semibold text-slate-800">
          {label}
          {required && <span className="text-red-600"> *</span>}
        </label>
        <textarea
          id={field}
          name={field}
          value={form[field] || ""}
          required={required}
          onChange={(e) => updateText(field, e.target.value)}
          rows={5}
          className="w-full resize-none rounded-lg border border-slate-300 bg-white px-4 py-3 font-montserrat leading-6 text-gray-500 outline-none transition focus:border-[#00305b] focus:ring-2 focus:ring-[#00305b]/15"
        />
      </div>
    );
  };

  // Render file upload.
  const upload = (field: FileField, label: string) => {
    const required = !optionalFields.has(field);
    const file = form[field];
    return (
      <div className="space-y-2">
        <label htmlFor={field} className="block font-montserrat font-semibold text-slate-800">
          {label}
          {required && <span className="text-red-600"> *</span>}
        </label>
        <label
          htmlFor={field}
          className="flex min-h-14 cursor-pointer items-center justify-between gap-4 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-3 transition hover:border-[#00305b] hover:bg-slate-100"
        >
          <span className="truncate font-montserrat text-slate-600">{file instanceof File ? file.name : "Choose file"}</span>
          <span className="shrink-0 rounded bg-linear-to-r from-[#00305b] to-[#004c8f] px-4 py-2 font-montserrat text-sm font-semibold text-white shadow-sm">Upload</span>
        </label>
        <input id={field} name={field} type="file" accept="image/*,.pdf" required={required} className="hidden" onChange={(e) => updateFile(field, e.target.files?.[0] ?? null)} />
      </div>
    );
  };

  // Submit the complete intake.
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      const body = new FormData();
      for (const [key, value] of Object.entries(form)) {
        if (value instanceof File) body.append(key, value);
        else body.append(key, value ?? "");
      }
      if (token) body.append("token", token);
      const response = await fetch(`/api/portal/${encodeURIComponent(clientId)}/signUp`, { method: "POST", body });
      const data = await response.json();
      if (response.status === 401) {
        window.location.href = `/api/auth/signin?callbackUrl=${encodeURIComponent(window.location.href)}`;
        return;
      }
      if (!response.ok) throw new Error(data.error || "Unable to submit intake");
      alert("Your intake has been submitted.");
      if (mode === "admin") router.push(`/portal/${encodeURIComponent(clientId)}`);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <main className="min-h-screen flex items-center justify-center">Loading...</main>;
  if (!mode) return null;

  return (
    <main className="min-h-screen relative font-medium bg-white md:bg-[url('https://res.cloudinary.com/dre1b2zmh/image/upload/v1781392342/goclegal/background_image_two.webp')] md:bg-cover md:bg-center md:flex md:items-start md:justify-center p-0 md:p-8">
      <div className="hidden md:block absolute inset-0 bg-[#00305bcf]" />
      <div className="relative z-10 w-full max-w-7xl mx-auto">
        <div className="rounded-none md:rounded-xl bg-white p-5 shadow-[0_8px_35px_rgba(0,0,0,0.2)] sm:p-8 lg:p-10">
          <div className="mb-9">
            {mode === "admin" && (
              <Link
                href={`/portal/${encodeURIComponent(clientId)}`}
                className="inline-flex items-center justify-center text-white font-montserrat text-base font-semibold rounded bg-linear-to-r from-[#00305b] to-[#004c8f] gradient-animate px-5 py-3 mb-5 cursor-pointer shadow-[0_0px_10px_rgba(0,0,0,0.3)]"
              >
                ← Profile
              </Link>
            )}
            <h1 className="text-center text-4xl font-bold tracking-tight text-[#00305b] sm:text-5xl">Tell Us About Your Case</h1>
            <p className="mt-3 text-center font-montserrat leading-7 text-gray-600">Please provide the information below so our team can begin reviewing your case.</p>
          </div>
          <form onSubmit={submit} className="space-y-8">
            <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
              <h2 className="text-2xl font-bold text-[#00305b]">Client Information</h2>
              <div className="mt-6 grid gap-6 lg:grid-cols-2">
                {input("clientName", "Client Name")}
                {input("clientPhone", "Client Phone", "tel")}
                {input("clientDob", "Date of Birth", "date")}
                {input("clientEmail", "Client Email", "email")}
                {input("clientSsnLast4", "Last 4 of SSN")}
              </div>
            </section>
            <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
              <h2 className="text-2xl font-bold text-[#00305b]">Auto Insurance</h2>
              <div className="mt-6 grid gap-6 lg:grid-cols-2">
                {input("clientAutoInsurance", "Auto Insurance")}
                {input("clientPolicyNumber", "Policy Number")}
                {input("clientClaimNumber", "Claim Number")}
              </div>
            </section>
            <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
              <h2 className="text-2xl font-bold text-[#00305b]">Health Insurance</h2>
              <div className="mt-6 grid gap-6 lg:grid-cols-2">
                {input("clientHealthInsurance", "Health Insurance")}
                {input("clientHealthInsuranceMemberNumber", "Member Number")}
              </div>
            </section>
            <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
              <h2 className="text-2xl font-bold text-[#00305b]">Injuries & Medical Care</h2>
              <div className="mt-6 space-y-6">
                {textarea("injuries", "Description of Injuries")}
                {textarea("medicalCare", "Description of Medical Care Received")}
                {textarea("medicalProvider", "Name and Address of Medical Provider")}
              </div>
            </section>
            <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
              <h2 className="text-2xl font-bold text-[#00305b]">Documents</h2>
              <div className="mt-6 space-y-5">
                {upload("driverLicense", "Photo of California Driver License")}
                {upload("healthInsuranceCards", "Photo of Health Insurance Cards")}
                {upload("declarationPage", "Client’s Declaration Page")}
              </div>
            </section>
            <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
              <h2 className="text-2xl font-bold text-[#00305b]">Collision Information</h2>
              <div className="mt-6 grid gap-6 lg:grid-cols-2">
                {input("collisionLocation", "Collision Location")}
                {input("collisionDate", "Collision Date", "date")}
                {input("policeDepartment", "Police Department")}
                {input("policeReportNumber", "Police Report Number")}
              </div>
              <div className="mt-6">{textarea("collisionDescription", "Collision Description")}</div>
            </section>
            <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
              <h2 className="text-2xl font-bold text-[#00305b]">Other Driver / Defendant</h2>
              <div className="mt-6 grid gap-6 lg:grid-cols-2">
                {input("defendantName", "Defendant Name")}
                {input("defendantInsurance", "Defendant Insurance")}
                {input("defendantAdjuster", "Defendant Adjuster")}
                {input("defendantPolicyNumber", "Defendant Policy Number")}
                {input("defendantClaimNumber", "Defendant Claim Number")}
              </div>
            </section>
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded bg-linear-to-r from-[#00305b] to-[#004c8f] px-8 py-4 font-montserrat text-base font-semibold text-white shadow-[0_0px_10px_rgba(0,0,0,0.3)] transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
              >
                {submitting ? "Submitting..." : "Submit Intake"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}
