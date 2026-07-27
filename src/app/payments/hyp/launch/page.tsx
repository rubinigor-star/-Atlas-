import Link from "next/link";

export const dynamic="force-dynamic";

export default async function HypLaunchPage({searchParams}:{searchParams:Promise<{target?:string}>}){
  const {target}=await searchParams;
  let paymentUrl="";
  try{
    const parsed=new URL(target||"");
    if(parsed.protocol==="https:"&&parsed.hostname==="pay.hyp.co.il")paymentUrl=parsed.toString();
  }catch{}

  if(!paymentUrl){
    return <main className="container" style={{paddingTop:80,maxWidth:720}}><section className="panel form"><h1>Не удалось открыть оплату</h1><p>Платёжная ссылка недействительна. Вернитесь к заказу и попробуйте ещё раз.</p><Link className="btn" href="/events">К мероприятиям</Link></section></main>;
  }

  return <html lang="ru"><head><meta name="referrer" content="origin"/><meta httpEquiv="refresh" content={`0;url=${paymentUrl}`}/><title>Переход к безопасной оплате</title></head><body><main style={{fontFamily:"Arial, sans-serif",maxWidth:680,margin:"100px auto",padding:24,textAlign:"center"}}><h1>Переходим к безопасной оплате HYP…</h1><p>Если переход не произошёл автоматически, нажмите кнопку.</p><a href={paymentUrl} rel="noreferrer" style={{display:"inline-block",padding:"14px 22px",borderRadius:10,background:"#0b1b38",color:"white",textDecoration:"none",fontWeight:700}}>Открыть страницу оплаты</a><script dangerouslySetInnerHTML={{__html:`window.setTimeout(function(){window.location.assign(${JSON.stringify(paymentUrl)});},50);`}}/></main></body></html>;
}