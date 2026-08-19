import type { Metadata } from "next";
import Link from "next/link";
import { HypLaunchClient } from "./hyp-launch-client";

export const dynamic="force-dynamic";
export const metadata:Metadata={title:"Переход к безопасной оплате",referrer:"origin"};

export default async function HypLaunchPage({searchParams}:{searchParams:Promise<{target?:string}>}){
  const {target}=await searchParams;
  let paymentUrl="";
  try{
    const parsed=new URL(target||"");
    if(parsed.protocol==="https:"&&parsed.hostname==="pay.hyp.co.il")paymentUrl=parsed.toString();
  }catch{}

  if(paymentUrl)return <HypLaunchClient paymentUrl={paymentUrl}/>;

  return <main className="container" style={{paddingTop:80,maxWidth:720}}><section className="panel form"><h1>Не удалось открыть оплату</h1><p>Платёжная ссылка недействительна. Вернитесь к заказу и попробуйте ещё раз.</p><Link className="btn" href="/events">К мероприятиям</Link></section></main>;
}
