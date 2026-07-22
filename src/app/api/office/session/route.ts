import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { db } from "@/lib/db";
import { demoSessionCookie } from "@/lib/auth";

const schema=z.object({email:z.string().email()});
export async function POST(request:Request){try{const {email}=schema.parse(await request.json());const user=await db.user.findUnique({where:{email}});if(!user?.active||!user.organizationId)throw new Error("Сотрудник недоступен");const store=await cookies();store.set(demoSessionCookie,email,{httpOnly:true,sameSite:"lax",secure:process.env.NODE_ENV==="production",path:"/",maxAge:60*60*12});return NextResponse.json({ok:true});}catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Ошибка"},{status:400})}}
