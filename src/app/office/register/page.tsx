import { redirect } from "next/navigation";

export default async function OfficeRegisterPage({ searchParams }: { searchParams: Promise<Record<string,string|string[]|undefined>> }) {
  const params = await searchParams;
  const error = typeof params.error === "string" ? `&error=${encodeURIComponent(params.error)}` : "";
  redirect(`/office/login?view=register${error}`);
}
