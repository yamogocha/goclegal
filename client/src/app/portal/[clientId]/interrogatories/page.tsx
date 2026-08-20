// app/[clientId]/interrogatories/page.tsx
import { notFound } from "next/navigation";
import { client } from "@/sanity/client";
import { groq } from "next-sanity";
import AdminInterrogatories from "@/app/components/adminInterrogatories";
import ClientInterrogatories from "@/app/components/clientInterrogatories";
import { getClientAccess } from "@/lib/oauth";

export default async function InterrogatoriesPage({ params, searchParams }: { params: Promise<{ clientId: string }>; searchParams: Promise<{ token?: string }> }) {
  const { clientId } = await params;
  const { token } = await searchParams;
  const access = await getClientAccess(clientId, token);
  if (!access) notFound();

  const interrogatory = await client.fetch(
    groq`*[_type=="interrogatory" && references($clientId)]|order(_createdAt desc)[0]{_id,caseNumber,interrogatories}`,
    { clientId: access.clientId },
    { cache: "no-store" },
  );
  if (!interrogatory) notFound();

  return access.mode === "admin" ? <AdminInterrogatories clientId={access.clientId} /> : <ClientInterrogatories clientId={access.clientId} />;
}
