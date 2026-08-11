import { PromoterAuthForm } from "@/components/promoter-auth-form";
export const dynamic = "force-dynamic";
export default async function PromoterActivatePage({searchParams}:{searchParams:Promise<{token?:string}>}){const {token}=await searchParams;return <PromoterAuthForm mode="activate" token={token}/>;}
