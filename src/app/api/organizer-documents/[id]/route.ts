import { del, put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { getCurrentStaff } from "@/lib/auth";
import { getOrganizerCompliance, recordOrganizerComplianceDocument } from "@/lib/organizer-compliance";

const MAX_FILE_SIZE=4*1024*1024;
const ALLOWED=new Set(["application/pdf","image/jpeg","image/png"]);

function safeName(name:string){
  const normalized=name.normalize("NFKC").replace(/[^a-zA-Z0-9а-яА-Яא-ת._-]+/g,"-").replace(/^-+|-+$/g,"");
  return normalized.slice(0,120)||"document";
}

function canManage(actor:Awaited<ReturnType<typeof getCurrentStaff>>,organizationId:string){
  if(!actor)return false;
  if(actor.role==="ADMIN")return true;
  return actor.organizationId===organizationId&&(actor.staffRole==="OWNER"||actor.staffRole==="ADMIN");
}

export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
  const actor=await getCurrentStaff();
  const {id}=await params;
  if(!canManage(actor,id))return NextResponse.json({error:"FORBIDDEN"},{status:403});
  const form=await request.formData();
  const kind=form.get("kind");
  const file=form.get("file");
  if((kind!=="bank"&&kind!=="tax")||!(file instanceof File))return NextResponse.json({error:"INVALID_UPLOAD"},{status:400});
  if(file.size<=0)return NextResponse.json({error:"EMPTY_FILE"},{status:400});
  if(file.size>MAX_FILE_SIZE)return NextResponse.json({error:"FILE_TOO_LARGE"},{status:413});
  if(!ALLOWED.has(file.type))return NextResponse.json({error:"UNSUPPORTED_FILE_TYPE"},{status:415});

  try{
    const before=await getOrganizerCompliance(id);
    const oldPath=kind==="bank"?before.bankDocumentPath:before.taxDocumentPath;
    const originalName=safeName(file.name);
    const blob=await put(`organizer-compliance/${id}/${kind}/${originalName}`,file,{access:"private",addRandomSuffix:true,contentType:file.type,cacheControlMaxAge:60});
    const compliance=await recordOrganizerComplianceDocument({organizationId:id,kind,pathname:blob.pathname,originalName:file.name.slice(0,180),mime:file.type,size:file.size});
    if(oldPath&&oldPath!==blob.pathname)void del(oldPath).catch(error=>console.warn("[organizer-document] old blob cleanup failed",{id,kind,error}));
    return NextResponse.json({ok:true,kind,name:kind==="bank"?compliance.bankDocumentName:compliance.taxDocumentName});
  }catch(error){
    const message=error instanceof Error?error.message:String(error);
    console.error("[organizer-document-upload]",{organizationId:id,kind,message});
    const notConfigured=/blob|token|store|oidc|authorization/i.test(message);
    return NextResponse.json({error:notConfigured?"BLOB_NOT_CONFIGURED":"UPLOAD_FAILED"},{status:500});
  }
}
