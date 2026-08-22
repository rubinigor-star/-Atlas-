import { NextResponse } from "next/server";
import { z } from "zod";
import { activatePromoterV2,createPromoterV2Session,forgotPromoterV2,loginPromoterV2,logoutPromoterV2,resetPromoterV2 } from "@/lib/promoter-auth-v2";

const locale=z.enum(["ru","he","en"]).optional();
const schema=z.discriminatedUnion("action",[
 z.object({action:z.literal("activate"),token:z.string().min(20),password:z.string().min(8).max(200),locale}),
 z.object({action:z.literal("login"),email:z.string().email(),password:z.string().min(1).max(200),locale}),
 z.object({action:z.literal("forgot"),email:z.string().email(),locale}),
 z.object({action:z.literal("reset"),token:z.string().min(20),password:z.string().min(8).max(200),locale}),
 z.object({action:z.literal("logout"),locale}),
]);
function errorCode(error:unknown){const message=error instanceof Error?error.message:"";if(["PASSWORD_TOO_SHORT","PROMOTER_ACTIVATION_INVALID","PROMOTER_LOGIN_INVALID","PROMOTER_ACCESS_DISABLED","PROMOTER_RESET_INVALID"].includes(message))return message;if(error instanceof z.ZodError)return "INVALID_INPUT";return "PROMOTER_AUTH_FAILED";}
export async function POST(request:Request){try{const input=schema.parse(await request.json());if(input.action==="activate"){const id=await activatePromoterV2(input.token,input.password);await createPromoterV2Session(id);return NextResponse.json({ok:true,redirect:"/promoter"})}if(input.action==="login"){await loginPromoterV2(input.email,input.password);return NextResponse.json({ok:true,redirect:"/promoter"})}if(input.action==="forgot"){await forgotPromoterV2(input.email,input.locale);return NextResponse.json({ok:true,messageCode:"PROMOTER_RESET_SENT"})}if(input.action==="reset"){const id=await resetPromoterV2(input.token,input.password);await createPromoterV2Session(id);return NextResponse.json({ok:true,redirect:"/promoter"})}await logoutPromoterV2();return NextResponse.json({ok:true,redirect:"/promoter/login"})}catch(error){console.error("[promoter-v2-auth]",error);return NextResponse.json({errorCode:errorCode(error)},{status:400})}}
