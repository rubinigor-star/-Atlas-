import { NextResponse } from "next/server";
import { z } from "zod";
import { activatePromoterV2,createPromoterV2Session,forgotPromoterV2,loginPromoterV2,logoutPromoterV2,resetPromoterV2 } from "@/lib/promoter-auth-v2";

const schema=z.discriminatedUnion("action",[
 z.object({action:z.literal("activate"),token:z.string().min(20),password:z.string().min(8).max(200)}),
 z.object({action:z.literal("login"),email:z.string().email(),password:z.string().min(1).max(200)}),
 z.object({action:z.literal("forgot"),email:z.string().email()}),
 z.object({action:z.literal("reset"),token:z.string().min(20),password:z.string().min(8).max(200)}),
 z.object({action:z.literal("logout")}),
]);
export async function POST(request:Request){try{const input=schema.parse(await request.json());if(input.action==="activate"){const id=await activatePromoterV2(input.token,input.password);await createPromoterV2Session(id);return NextResponse.json({ok:true,redirect:"/promoter"})}if(input.action==="login"){await loginPromoterV2(input.email,input.password);return NextResponse.json({ok:true,redirect:"/promoter"})}if(input.action==="forgot"){await forgotPromoterV2(input.email);return NextResponse.json({ok:true,message:"Если аккаунт существует, письмо отправлено."})}if(input.action==="reset"){const id=await resetPromoterV2(input.token,input.password);await createPromoterV2Session(id);return NextResponse.json({ok:true,redirect:"/promoter"})}await logoutPromoterV2();return NextResponse.json({ok:true,redirect:"/promoter/login"})}catch(error){const message=error instanceof Error?error.message:"Ошибка авторизации";console.error("[promoter-v2-auth]",error);return NextResponse.json({error:message},{status:400})}}
