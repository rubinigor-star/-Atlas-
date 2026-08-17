import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";

const schema=z.object({idempotencyKey:z.string().uuid(),city:z.string().max(120).optional().default(""),facebook:z.string().max(250).optional().default(""),instagram:z.string().max(250).optional().default("")});

export async function POST(req:Request,{params}:{params:Promise<{publicId:string}>}){
  try{
    const {publicId}=await params;
    const input=schema.parse(await req.json());
    const order=await db.order.findFirst({where:{publicId,idempotencyKey:input.idempotencyKey},select:{id:true,guestId:true}});
    if(!order)return NextResponse.json({error:"Заказ не найден"},{status:404});
    await db.$transaction(async tx=>{
      await tx.order.update({where:{id:order.id},data:{customerCity:input.city||null,customerFacebook:input.facebook||null,customerInstagram:input.instagram||null}});
      if(order.guestId)await tx.guestProfile.update({where:{id:order.guestId},data:{city:input.city,facebook:input.facebook,instagram:input.instagram}});
    });
    return NextResponse.json({ok:true});
  }catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Ошибка сохранения данных"},{status:400});}
}
