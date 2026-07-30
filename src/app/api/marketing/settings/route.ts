import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { ensureMarketingRuntime } from "@/lib/marketing-runtime";

export async function POST(req:Request){
  try{
    const staff=await requirePermission("ANALYTICS_VIEW");
    await ensureMarketingRuntime();
    const body=await req.json() as Record<string,unknown>;
    const clean=(key:string)=>String(body[key]??"").trim().slice(0,120)||null;
    await db.$executeRawUnsafe(`INSERT INTO OrganizationMarketingSettings (organizationId, metaPixelId, googleAnalyticsId, googleAdsId, tiktokPixelId, updatedAt) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP) ON CONFLICT(organizationId) DO UPDATE SET metaPixelId=excluded.metaPixelId, googleAnalyticsId=excluded.googleAnalyticsId, googleAdsId=excluded.googleAdsId, tiktokPixelId=excluded.tiktokPixelId, updatedAt=CURRENT_TIMESTAMP`,staff.organizationId!,clean("metaPixelId"),clean("googleAnalyticsId"),clean("googleAdsId"),clean("tiktokPixelId"));
    return NextResponse.json({ok:true});
  }catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Ошибка"},{status:400});}
}
