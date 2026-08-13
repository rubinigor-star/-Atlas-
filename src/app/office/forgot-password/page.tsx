import { redirect } from "next/navigation";

export default async function OfficeForgotPasswordPage({ searchParams }: { searchParams: Promise<Record<string,string|string[]|undefined>> }) {
  const params = await searchParams;
  redirect(`/office/login?view=forgot${params.sent ? "&sent=1" : ""}`);
}
