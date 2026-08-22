"use client";

import Link from "next/link";
import { useLocale } from "@/components/locale-provider";

const helpCopy={
  ru:{title:"Нужна помощь?",text:"Свяжитесь с командой Atlas One. Мы поможем с билетами, мероприятием или подключением организатора.",action:"Связаться с нами"},
  he:{title:"צריכים עזרה?",text:"צוות Atlas One כאן בשבילכם בכל שאלה על כרטיסים, אירוע או הצטרפות כמפיקים.",action:"דברו איתנו"},
  en:{title:"Need help?",text:"Contact the Atlas One team for help with tickets, an event, or organizer onboarding.",action:"Contact us"},
} as const;

export function ContentPage({eyebrow,title,intro,children}:{eyebrow:string;title:string;intro:string;children:React.ReactNode}){
  const {locale}=useLocale();const help=helpCopy[locale];
  return <main className="shell" style={{maxWidth:900,paddingTop:56,paddingBottom:80}}>
    <span className="eyebrow">{eyebrow}</span>
    <h1 style={{fontSize:"clamp(40px,7vw,72px)",lineHeight:1,letterSpacing:"-3px",margin:"14px 0 20px"}}>{title}</h1>
    <p className="muted" style={{fontSize:20,lineHeight:1.65,maxWidth:760}}>{intro}</p>
    <div style={{display:"grid",gap:20,marginTop:36,lineHeight:1.7}}>{children}</div>
    <div className="panel" style={{marginTop:38}}><strong>{help.title}</strong><p className="muted">{help.text}</p><Link className="btn" href="/contact">{help.action}</Link></div>
  </main>;
}

export function Section({title,children}:{title:string;children:React.ReactNode}){
  return <section><h2 style={{fontSize:28,marginBottom:8}}>{title}</h2><div className="muted">{children}</div></section>;
}
