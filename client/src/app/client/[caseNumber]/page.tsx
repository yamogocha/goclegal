import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { client } from "@/sanity/client";
import { groq } from "next-sanity";
import ClientInterrogatories from "@/app/components/clientInterrogatories";

export default async function ClientCasePage({
  params,
  searchParams,
}: {
  params: Promise<{ caseNumber: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { caseNumber } = await params;
  const { token } = await searchParams;

  const record = await client.fetch(
    groq`
      *[
        _type == "interrogatory" &&
        caseNumber == $caseNumber
      ][0]{
        caseNumber,
        clientAccessToken
      }
    `,
    { caseNumber }
  );

  if (!record) notFound();

  const cookieStore = await cookies();

  const cookieToken = cookieStore.get(`case-${caseNumber}`)?.value;

  const suppliedToken = token || cookieToken;

  if (
    suppliedToken !== record.clientAccessToken
  ) {
    notFound();
  }

  return (
    <ClientInterrogatories
      params={Promise.resolve({ caseNumber })}
    />
  );
}