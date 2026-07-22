import {NextResponse} from "next/server";
import {writeFile,mkdir} from "fs/promises";
import path from "path";
import {randomBytes} from "crypto";
import {requirePermission} from "@/lib/auth";

export async function POST(req:Request){try{await requirePermission("TICKET_MANAGE");const data=await req.formData();const file=data.get("image")??data.get("poster");if(!(file instanceof File)||!file.type.match(/^image\/(jpeg|png|webp)$/)||file.size>8_000_000)throw new Error("Нужен JPG, PNG или WebP до 8 MB");const ext=file.type.split("/")[1].replace("jpeg","jpg");const name=`atlas-${randomBytes(10).toString("hex")}.${ext}`;const dir=path.join(process.cwd(),"public","uploads");await mkdir(dir,{recursive:true});await writeFile(path.join(dir,name),Buffer.from(await file.arrayBuffer()));return NextResponse.json({url:`/uploads/${name}`})}catch(error){const message=error instanceof Error?error.message:"Upload error";return NextResponse.json({error:message==="FORBIDDEN"?"Недостаточно прав":message},{status:message==="FORBIDDEN"?403:400})}}
