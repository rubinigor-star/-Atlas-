import { ReactNode } from "react";
import { PromoterPortalShell } from "@/components/promoter-portal-shell";
import { requirePromoter } from "@/lib/promoter-auth";

export const dynamic = "force-dynamic";

export default async function PromoterPortalLayout({children}:{children:ReactNode}){
 const promoter=await requirePromoter();
 return <PromoterPortalShell name={promoter.name} organization={promoter.organization.name}>{children}</PromoterPortalShell>;
}
