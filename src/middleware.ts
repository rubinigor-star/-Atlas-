import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const CANONICAL_HOST="www.atlas-one.co";

export function middleware(request:NextRequest){
  const host=request.headers.get("host")?.split(":")[0]?.toLowerCase()||"";
  const isVercelHost=host.endsWith(".vercel.app");
  const isPublicGet=request.method==="GET"&&!request.nextUrl.pathname.startsWith("/api/")&&!request.nextUrl.pathname.startsWith("/_next/");

  if(isVercelHost&&isPublicGet){
    const url=request.nextUrl.clone();
    url.protocol="https:";
    url.hostname=CANONICAL_HOST;
    url.port="";
    return NextResponse.redirect(url,308);
  }

  return NextResponse.next();
}

export const config={matcher:["/((?!_next/static|_next/image|favicon.ico).*)"]};
