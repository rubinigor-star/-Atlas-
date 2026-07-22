import { buildWalletPass } from "@/lib/wallet";
export const runtime="nodejs";
export async function GET(_:Request,{params}:{params:Promise<{id:string}>}){try{const{id}=await params;const buffer=await buildWalletPass(id);return new Response(new Uint8Array(buffer),{headers:{"content-type":"application/vnd.apple.pkpass","content-disposition":`attachment; filename="atlas-${id}.pkpass"`,"cache-control":"no-store"}})}catch(error){return Response.json({error:error instanceof Error?error.message:"Wallet error"},{status:503})}}
