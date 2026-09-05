"use client";
import Link from "next/link";
import { use, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type UploadedFile = { url: string; name: string; assetId: string };
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
  clientVehicle: string;
  defendantVehicle: string;
  driverLicense: File[];
  healthInsuranceCards: File[];
  medicalRecords: File[];
  vehicleDamagePhotos: File[];
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

type StringField = Exclude<keyof FormData, "driverLicense" | "healthInsuranceCards" | "medicalRecords" | "vehicleDamagePhotos" | "declarationPage">;
type FileField = "driverLicense" | "healthInsuranceCards" | "medicalRecords" | "vehicleDamagePhotos" | "declarationPage";

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
  clientVehicle: "",
  defendantVehicle: "",
  driverLicense: [],
  healthInsuranceCards: [],
  medicalRecords: [],
  vehicleDamagePhotos: [],
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
  "driverLicense",
  "medicalRecords",
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
  "clientVehicle",
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
  "defendantVehicle",
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
  const [uploadedFiles, setUploadedFiles] = useState<Record<FileField, UploadedFile[]>>({
    driverLicense: [],
    healthInsuranceCards: [],
    medicalRecords: [],
    vehicleDamagePhotos: [],
    declarationPage: [],
  });
  const [mode, setMode] = useState<"admin" | "client" | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadedRef = useRef(false);
  const [banner, setBanner] = useState<{ type: "success" | "error"; message: string } | null>(null);

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
        const files = (field: FileField): UploadedFile[] => {
          const value = data.client?.[field];
          if (!value) return [];
          const list = Array.isArray(value) ? value : [value];
          return list
            .filter((item: any) => item?.asset?.url)
            .map((item: any) => ({
              url: item.asset.url,
              name: item.asset.originalFilename || item.asset.filename || "Uploaded file",
              assetId: item.asset._id || item.asset._ref,
            }));
        };
        setMode(data.mode);
        setUploadedFiles({
          driverLicense: files("driverLicense"),
          healthInsuranceCards: files("healthInsuranceCards"),
          medicalRecords: files("medicalRecords"),
          vehicleDamagePhotos: files("vehicleDamagePhotos"),
          declarationPage: files("declarationPage"),
        });
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
        if (res.status === 401) window.location.href = `/api/auth/signin?callbackUrl=${encodeURIComponent(window.location.href)}`;
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

  // Update new file fields only.
  const updateFile = (field: FileField, value: File[] | File | null) => setForm((prev) => ({ ...prev, [field]: value }));

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
          aria-required={required}
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
          aria-required={required}
          onChange={(e) => updateText(field, e.target.value)}
          rows={5}
          className="w-full resize-none rounded-lg border border-slate-300 bg-white px-4 py-3 font-montserrat leading-6 text-gray-500 outline-none transition focus:border-[#00305b] focus:ring-2 focus:ring-[#00305b]/15"
        />
      </div>
    );
  };

  // Remove an uploaded or newly selected file.
  const removeFile = async (field: FileField, index: number, persisted: boolean) => {
    if (!persisted) {
      const value = form[field];
      const files = Array.isArray(value) ? value : value instanceof File ? [value] : [];
      updateFile(
        field,
        files.filter((_, i) => i !== index),
      );
      return;
    }
    const file = uploadedFiles[field][index];
    if (!file) return;

    try {
      const query = token ? `?token=${encodeURIComponent(token)}` : "";
      const response = await fetch(`/api/portal/${encodeURIComponent(clientId)}/signUp${query}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ field, assetId: file.assetId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to remove file");
      setUploadedFiles((prev) => ({
        ...prev,
        [field]: prev[field].filter((_, i) => i !== index),
      }));
      setBanner({ type: "success", message: "File removed successfully." });
    } catch (error) {
      setBanner({
        type: "error",
        message: error instanceof Error ? error.message : "Unable to remove file.",
      });
    }
  };

  // Render file upload with persisted and newly selected files.
  const upload = (field: FileField, label: string, multiple = false) => {
    const required = !optionalFields.has(field);
    const value = form[field];
    const newFiles = Array.isArray(value) ? value : value instanceof File ? [value] : [];
    const existingFiles = uploadedFiles[field] || [];
    return (
      <div className="space-y-2">
        <label htmlFor={field} className="block font-montserrat font-semibold text-slate-800">
          {label}
          {required && <span className="text-red-600"> *</span>}
        </label>
        {existingFiles.length > 0 && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="mb-2 font-montserrat text-xs font-semibold uppercase tracking-wide text-slate-500">Already uploaded</p>
            <div className="space-y-2">
              {existingFiles.map((file, index) => (
                <div key={`${file.url}-${index}`} className="flex items-center gap-3 rounded-md bg-white px-3 py-2 font-montserrat text-sm text-[#00305b]">
                  <a
                    href={`/api/portal/${encodeURIComponent(clientId)}/file?url=${encodeURIComponent(file.url)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex min-w-0 flex-1 items-center gap-3 hover:text-[#004c8f]"
                  >
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-[#00305b]/10 text-xs">✓</span>
                    <span className="min-w-0 flex-1 truncate">{file.name}</span>
                    <span className="shrink-0 text-xs font-semibold text-slate-500">View</span>
                  </a>
                  <button type="button" onClick={() => removeFile(field, index, true)} className="shrink-0 rounded px-2 py-1 text-xs font-semibold text-red-600 transition hover:bg-red-50">
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
        {newFiles.length > 0 && (
          <div className="rounded-lg border border-slate-200 bg-white p-3">
            <p className="mb-2 font-montserrat text-xs font-semibold uppercase tracking-wide text-slate-500">New files</p>
            <div className="space-y-2">
              {newFiles.map((file, index) => (
                <div key={`${file.name}-${file.size}-${index}`} className="flex items-center gap-3 rounded-md bg-slate-50 px-3 py-2 font-montserrat text-sm text-slate-700">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-[#00305b]/10 text-xs">+</span>
                  <span className="min-w-0 flex-1 truncate">{file.name}</span>
                  <button type="button" onClick={() => removeFile(field, index, false)} className="shrink-0 rounded px-2 py-1 text-xs font-semibold text-red-600 transition hover:bg-red-50">
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
        <label
          htmlFor={field}
          className="flex min-h-14 cursor-pointer items-center justify-between gap-4 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-3 transition hover:border-[#00305b] hover:bg-slate-100"
        >
          <span className="font-montserrat text-sm text-slate-600">{existingFiles.length || newFiles.length ? "Add more files" : "Choose file"}</span>
          <span className="shrink-0 rounded bg-linear-to-r from-[#00305b] to-[#004c8f] px-4 py-2 font-montserrat text-sm font-semibold text-white shadow-sm">Upload</span>
        </label>
        <input
          id={field}
          name={field}
          type="file"
          accept="image/*,.pdf"
          multiple={multiple}
          aria-required={required}
          className="hidden"
          onChange={(e) => {
            const selected = Array.from(e.target.files ?? []);
            if (!selected.length) return;
            updateFile(field, multiple ? [...newFiles, ...selected] : selected[0]);
            e.target.value = "";
          }}
        />
      </div>
    );
  };

  // Submit the complete intake.
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBanner(null);

    // Validate required fields manually so we can show our own banner.
    const missing: string[] = [];
    const requiredLabels: Partial<Record<StringField | FileField, string>> = {
      clientName: "Client Name",
      clientPhone: "Client Phone",
      clientDob: "Date of Birth",
      clientEmail: "Client Email",
      clientSsnLast4: "Last 4 of SSN",
      clientAutoInsurance: "Auto Insurance",
      clientPolicyNumber: "Policy Number",
      clientClaimNumber: "Claim Number",
      clientVehicle: "Year, Make, and Model of Your Car",
      defendantVehicle: "Year, Make, and Model of the Car That Hit You",
      clientHealthInsurance: "Health Insurance",
      clientHealthInsuranceMemberNumber: "Member Number",
      injuries: "Description of Injuries",
      medicalCare: "Description of Medical Care Received",
      medicalProvider: "Name and Address of Medical Provider",
      healthInsuranceCards: "Health Insurance Cards",
      collisionLocation: "Collision Location",
      collisionDate: "Collision Date",
    };

    for (const field of stringFields) {
      if (!optionalFields.has(field) && !String(form[field] ?? "").trim()) missing.push(requiredLabels[field] || field);
    }
    const healthInsuranceFiles = [...uploadedFiles.healthInsuranceCards, ...(Array.isArray(form.healthInsuranceCards) ? form.healthInsuranceCards : [])];
    if (healthInsuranceFiles.length === 0) missing.push(requiredLabels.healthInsuranceCards || "Health Insurance Cards");
    if (missing.length > 0) {
      setBanner({
        type: "error",
        message: `Please complete the following required field${missing.length > 1 ? "s" : ""}: ${missing.join(", ")}.`,
      });
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    setSubmitting(true);

    try {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      const body = new FormData();
      for (const [key, value] of Object.entries(form)) {
        if (Array.isArray(value)) value.forEach((file) => body.append(key, file));
        else if (value instanceof File) body.append(key, value);
        else body.append(key, value ?? "");
      }
      if (token) body.append("token", token);
      const response = await fetch(`/api/portal/${encodeURIComponent(clientId)}/signUp`, {
        method: "POST",
        body,
      });
      const data = await response.json();
      if (response.status === 401) {
        window.location.href = `/api/auth/signin?callbackUrl=${encodeURIComponent(window.location.href)}`;
        return;
      }
      if (!response.ok) throw new Error(data.error || "Unable to submit intake");
      setBanner({
        type: "success",
        message: "Your intake has been successfully submitted. Thank you!",
      });
      window.scrollTo({ top: 0, behavior: "smooth" });
      if (mode === "admin") {
        setTimeout(() => router.push(`/portal/${encodeURIComponent(clientId)}`), 1500);
      }
    } catch (error) {
      setBanner({
        type: "error",
        message: error instanceof Error ? error.message : "Something went wrong. Please try again.",
      });
      window.scrollTo({ top: 0, behavior: "smooth" });
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
            {banner && (
              <div
                role="alert"
                className={`mb-6 rounded-lg border px-5 py-4 font-montserrat text-sm font-semibold ${
                  banner.type === "success" ? "border-green-200 bg-green-50 text-green-800" : "border-red-200 bg-red-50 text-red-700"
                }`}
              >
                {banner.message}
              </div>
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
                {input("clientVehicle", "Year, Make, and Model of Your Car")}
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
                {upload("driverLicense", "Photos of California Driver License", true)}
                {upload("vehicleDamagePhotos", "Photos of Damage to Your Car", true)}
                {upload("healthInsuranceCards", "Photos of Health Insurance Cards", true)}
                {upload("medicalRecords", "Photos of Medical Records", true)}
                {upload("declarationPage", "Client’s Declaration Page")}
              </div>
            </section>
            <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
              <h2 className="text-2xl font-bold text-[#00305b]">Collision Information</h2>
              <div className="mt-6 grid gap-6 lg:grid-cols-2">
                {input("collisionLocation", "Collision Location")}
                {input("collisionDate", "Collision Date", "date")}
                {input("defendantVehicle", "Year, Make, and Model of the Car That Hit You")}
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
