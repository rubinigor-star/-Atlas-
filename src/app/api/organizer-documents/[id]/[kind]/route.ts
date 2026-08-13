import { get } from "@vercel/blob";
import { NextResponse } from "next/server";
import { getCurrentStaff } from "@/lib/auth";
import { getOrganizerCompliance } from "@/lib/organizer-compliance";

function canRead(actor:Awaited<ReturnType<typeof getCurrentStaff>>,organizationId:string){
  if(!actor)return false;
  if(actor.role==="ADMIN")return true;
  return actor.organizationId===organizationId&&actor.staffRole==="OWNER";
}

function contentDisposition(name:string){
  const ascii=name.replace(/[^a-zA-Z0-9._-]+/g,"-").slice(0,100)||"document";
  const encoded=encodeURIComponent(name);
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}

export async function GET(_request:Request,{params}:{params:Promise<{id:string;kind:string}>}){
  const actor=await getCurrentStaff();
  const {id,kind}=await params;
  if(!canRead(actor,id))return NextResponse.json({error:"FORBIDDEN"},{status:403});
  if(kind!=="bank"&&kind!=="tax")return NextResponse.json({error:"NOT_FOUND"},{status:404});
  const compliance=await getOrganizerCompliance(id);
  const pathname=kind==="bank"?compliance.bankDocumentPath:compliance.taxDocumentPath;
  const name=kind==="bank"?compliance.bankDocumentName:compliance.taxDocumentName;
  if(!pathname)return NextResponse.json({error:"NOT_FOUND"},{status:404});
  try{
    const result=await get(pathname,{access:"private"});
    if(!result||result.statusCode!==200)return NextResponse.json({error:"NOT_FOUND"},{status:404});
    return new NextResponse(result.stream,{headers:{
      "content-type":result.blob.contentType||"application/octet-stream",
      "content-disposition":contentDisposition(name||"document"),
      "cache-control":"private, no-store",
      "x-content-type-options":"nosniff",
    }});
  }catch(error){
    console.error("[organizer-document-download]",{organizationId:id,kind,error});
    return NextResponse.json({error:"DOWNLOAD_FAILED"},{status:500});
  }
}
