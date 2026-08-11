import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { saveCustomerDemographics } from "@/lib/customer-demographics";

const schema=z.object({idempotencyKey:z.string().uuid(),gender:z.enum(["MALE","FEMALE"]),birthDate:z.string().max(20).optional().default("")});

export async function POST(req:Request,{params}:{params:Promise<{publicId:string}>}){
  try{
    const {publicId}=await params;const input=schema.parse(await req.json());
    const order=await db.order.findFirst({where:{publicId,idempotencyKey:input.idempotencyKey},select:{id:true,guestId:true,customerBirthDate:true}});
    if(!order)return NextResponse.json({error:"Заказ не найден"},{status:404});
    const birthDate=input.birthDate?new Date(input.birthDate):order.customerBirthDate;
    if(birthDate&&Number.isNaN(birthDate.getTime()))return NextResponse.json({error:"Некорректная дата рождения"},{status:400});
    await saveCustomerDemographics({orderId:order.id,guestId:order.guestId,gender:input.gender,birthDate});
    return NextResponse.json({ok:true});
  }catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Ошибка сохранения данных"},{status:400});}
}
