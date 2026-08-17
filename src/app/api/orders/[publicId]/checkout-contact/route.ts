import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { releaseReservation } from "@/lib/reservation";

const schema=z.object({
  idempotencyKey:z.string().uuid(),
  firstName:z.string().trim().min(1).max(100),
  lastName:z.string().trim().max(100).default(""),
  email:z.string().trim().email().max(160),
  phone:z.string().trim().min(5).max(40),
  birthDate:z.string().trim().max(20).optional().default(""),
  city:z.string().trim().max(120).optional().default(""),
  facebook:z.string().trim().max(200).optional().default(""),
  instagram:z.string().trim().max(200).optional().default(""),
  eligibilityAnswer:z.string().trim().max(2000).optional().default("")
});

function normalizePhone(value:string){
  const digits=value.replace(/\D/g,"");
  if(!digits)return "";
  if(digits.startsWith("972"))return `+${digits}`;
  if(digits.startsWith("0"))return `+972${digits.slice(1)}`;
  return `+972${digits}`;
}

export async function POST(req:Request,{params}:{params:Promise<{publicId:string}>}){
  try{
    const {publicId}=await params;
    const input=schema.parse(await req.json());
    const order=await db.order.findFirst({
      where:{publicId,idempotencyKey:input.idempotencyKey,status:"PENDING"},
      include:{event:{select:{organizationId:true}},guest:true}
    });
    if(!order)return NextResponse.json({error:"Заказ не найден или уже обработан"},{status:404});
    const phone=normalizePhone(input.phone);
    if(!phone)return NextResponse.json({error:"Некорректный номер телефона"},{status:400});
    const birthDate=input.birthDate?new Date(input.birthDate):null;
    if(birthDate&&Number.isNaN(birthDate.getTime()))return NextResponse.json({error:"Некорректная дата рождения"},{status:400});
    const actualGuest=await db.guestProfile.upsert({
      where:{organizationId_phone:{organizationId:order.event.organizationId,phone}},
      create:{organizationId:order.event.organizationId,firstName:input.firstName,lastName:input.lastName,phone,email:input.email.toLowerCase(),birthDate:birthDate??new Date("1900-01-01T00:00:00.000Z"),city:input.city,facebook:input.facebook,instagram:input.instagram},
      update:{firstName:input.firstName,lastName:input.lastName,email:input.email.toLowerCase(),birthDate:birthDate??undefined,city:input.city,facebook:input.facebook,instagram:input.instagram}
    });
    await db.order.update({
      where:{id:order.id},
      data:{
        guestId:actualGuest.id,
        customerName:`${input.firstName} ${input.lastName}`.trim(),
        customerEmail:input.email.toLowerCase(),
        customerPhone:phone,
        customerFirstName:input.firstName,
        customerLastName:input.lastName||null,
        customerBirthDate:birthDate,
        customerCity:input.city||null,
        customerFacebook:input.facebook||null,
        customerInstagram:input.instagram||null,
        eligibilityAnswer:input.eligibilityAnswer||null
      }
    });
    if(order.guestId!==actualGuest.id&&order.guest?.email?.startsWith("checkout-")){
      const references=await db.order.count({where:{guestId:order.guestId}});
      if(references===0)await db.guestProfile.delete({where:{id:order.guestId}}).catch(()=>undefined);
    }
    return NextResponse.json({ok:true});
  }catch(error){
    return NextResponse.json({error:error instanceof Error?error.message:"Ошибка сохранения данных"},{status:400});
  }
}

export async function DELETE(req:Request,{params}:{params:Promise<{publicId:string}>}){
  try{
    const {publicId}=await params;
    const body=await req.json().catch(()=>({}));
    const idempotencyKey=z.string().uuid().parse(body.idempotencyKey);
    const order=await db.order.findFirst({where:{publicId,idempotencyKey,status:"PENDING"},select:{id:true}});
    if(!order)return NextResponse.json({ok:true});
    await db.$transaction(async tx=>{
      await releaseReservation(order.id,tx);
      await tx.order.update({where:{id:order.id},data:{status:"CANCELLED"}});
    });
    return NextResponse.json({ok:true});
  }catch(error){
    return NextResponse.json({error:error instanceof Error?error.message:"Ошибка отмены подготовленного заказа"},{status:400});
  }
}
