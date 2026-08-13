import { NextResponse } from "next/server";
import { getCurrentStaff } from "@/lib/auth";
import { recordOrganizerAgreementAcceptance } from "@/lib/organizer-compliance";

function clientIp(request:Request){return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()||request.headers.get("x-real-ip")||null;}

export async function POST(request:Request){
  const staff=await getCurrentStaff();
  if(!staff||!staff.organizationId)return NextResponse.json({error:"UNAUTHORIZED"},{status:401});
  if(staff.staffRole!=="OWNER")return NextResponse.json({error:"OWNER_ONLY"},{status:403});
  const compliance=await recordOrganizerAgreementAcceptance({
    organizationId:staff.organizationId,
    signerName:staff.name,
    signerEmail:staff.email,
    ip:clientIp(request),
    userAgent:request.headers.get("user-agent"),
  });
  return NextResponse.json({ok:true,agreementVersion:compliance.agreementVersion,acceptedAt:compliance.acceptedAt});
}
