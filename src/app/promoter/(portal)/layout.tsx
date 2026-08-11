import { ReactNode } from "react";
import { PromoterPortalShell } from "@/components/promoter-portal-shell";
import { requirePromoterV2 } from "@/lib/promoter-auth-v2";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function PromoterPortalLayout({children}:{children:ReactNode}){
 const promoter=await requirePromoterV2();
 const organization=await db.organization.findUnique({where:{id:promoter.organizationId},select:{name:true}});
 return <PromoterPortalShell name={promoter.name} organization={organization?.name||"Atlas One"}>{children}</PromoterPortalShell>;
}
