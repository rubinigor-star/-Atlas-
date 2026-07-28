import { NextResponse } from "next/server";

const themes:Record<string,{a:string;b:string;accent:string;title:string;subtitle:string;motif:string}>={
  "echoes-of-light":{a:"#070b18",b:"#9a5b18",accent:"#ffe7a3",title:"ECHOES OF LIGHT",subtitle:"LIVE CONCERT",motif:"✦"},
  "neon-dreams":{a:"#190629",b:"#1565c0",accent:"#ff4fd8",title:"NEON DREAMS",subtitle:"ELECTRONIC NIGHT",motif:"◈"},
  "stand-up-night":{a:"#050505",b:"#3a1111",accent:"#ffd600",title:"STAND UP NIGHT",subtitle:"COMEDY SHOW",motif:"●"},
  "sunset-sessions":{a:"#5d1708",b:"#ff8a21",accent:"#fff0c2",title:"SUNSET SESSIONS",subtitle:"BEACH FESTIVAL",motif:"☀"},
  "techno-united":{a:"#05060a",b:"#5c0808",accent:"#ff3b30",title:"TECHNO UNITED",subtitle:"INDOOR RAVE",motif:"⌁"},
  "magic-adventure":{a:"#14307a",b:"#7b2cbf",accent:"#ffdf67",title:"MAGIC ADVENTURE",subtitle:"FAMILY SHOW",motif:"★"},
  "jazz-nights":{a:"#041321",b:"#174b70",accent:"#d8edf8",title:"JAZZ NIGHTS",subtitle:"LIVE MUSIC",motif:"♪"},
  "pool-party":{a:"#0077a8",b:"#39c6bb",accent:"#fff4cf",title:"POOL PARTY",subtitle:"SUMMER EDITION",motif:"≈"},
};

export async function GET(_:Request,{params}:{params:Promise<{slug:string}>}){
  const {slug}=await params;
  const t=themes[slug]??themes["echoes-of-light"];
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1500" viewBox="0 0 1200 1500"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${t.a}"/><stop offset="1" stop-color="${t.b}"/></linearGradient><radialGradient id="r"><stop stop-color="${t.accent}" stop-opacity=".8"/><stop offset="1" stop-color="${t.accent}" stop-opacity="0"/></radialGradient></defs><rect width="1200" height="1500" fill="url(#g)"/><circle cx="930" cy="260" r="420" fill="url(#r)"/><circle cx="210" cy="1180" r="360" fill="url(#r)" opacity=".45"/><g fill="none" stroke="${t.accent}" stroke-opacity=".28">${Array.from({length:11},(_,i)=>`<circle cx="600" cy="740" r="${120+i*65}"/>`).join("")}</g><text x="90" y="150" fill="${t.accent}" font-family="Arial" font-size="44" font-weight="700">ATLAS ONE PRESENTS</text><text x="600" y="680" text-anchor="middle" fill="${t.accent}" font-family="Arial" font-size="190">${t.motif}</text><text x="90" y="1050" fill="white" font-family="Arial" font-size="112" font-weight="900">${t.title}</text><text x="94" y="1135" fill="${t.accent}" font-family="Arial" font-size="42" font-weight="700" letter-spacing="8">${t.subtitle}</text><line x1="90" y1="1210" x2="1110" y2="1210" stroke="${t.accent}" stroke-width="4"/><text x="90" y="1310" fill="white" font-family="Arial" font-size="34">TEL AVIV • 2026–2027 • TICKETS FROM ₪1</text></svg>`;
  return new NextResponse(svg,{headers:{"Content-Type":"image/svg+xml; charset=utf-8","Cache-Control":"public, max-age=31536000, immutable"}});
}
