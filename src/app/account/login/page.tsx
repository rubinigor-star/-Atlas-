import { CustomerLoginForm } from "@/components/customer-login-form";

export default async function CustomerLoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const params = await searchParams;
  return <main className="container" style={{paddingTop:32,paddingBottom:64}}><CustomerLoginForm expired={params.error === "expired"}/></main>;
}
