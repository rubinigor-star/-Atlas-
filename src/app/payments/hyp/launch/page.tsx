import type { Metadata } from "next";
import Link from "next/link";
import { HypLaunchClient } from "./hyp-launch-client";
import styles from "./hyp-launch.module.css";

export const dynamic="force-dynamic";
export const metadata:Metadata={title:"Оплата",referrer:"origin"};

export default async function HypLaunchPage({searchParams}:{searchParams:Promise<{target?:string}>}){
  const {target}=await searchParams;
  let paymentUrl="";
  try{
    const parsed=new URL(target||"");
    if(parsed.protocol==="https:"&&parsed.hostname==="pay.hyp.co.il")paymentUrl=parsed.toString();
  }catch{}

  if(paymentUrl)return <HypLaunchClient paymentUrl={paymentUrl}/>;

  return <main className={styles.shell}><section className={styles.error}><h1>Не удалось открыть оплату</h1><p>Платёжная ссылка недействительна. Вернитесь к оформлению заказа и попробуйте ещё раз.</p><Link href="/events">К мероприятиям</Link></section></main>;
}
