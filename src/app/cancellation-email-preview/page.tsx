import Link from "next/link";

export default function CancellationEmailPreviewPage(){
  const orderPublicId="ATL-DEMO-1234";
  const cancellationPublicId="CAN-DEMO-5678";
  const eventTitle="Пример мероприятия Atlas One";
  const amount="95.00 ₪";

  return <main style={{background:"#f3f4f6",minHeight:"100vh",padding:"36px 12px"}}>
    <div style={{maxWidth:680,margin:"0 auto"}}>
      <div style={{marginBottom:18,color:"#6b7280",fontSize:14}}>Preview письма отмены. Ничего не отправляется и возврат не выполняется.</div>
      <div style={{background:"#fff",borderRadius:20,overflow:"hidden",boxShadow:"0 18px 45px rgba(15,23,42,.10)",fontFamily:"Arial,sans-serif",color:"#111827"}}>
        <div style={{background:"#081426",color:"white",padding:26}}><h1 style={{margin:0,fontSize:28}}>Билеты отменены, возврат оформлен</h1></div>
        <div style={{padding:26,lineHeight:1.6}}>
          <p>Здравствуйте, Игорь.</p>
          <p>Номер заявки: <strong>{cancellationPublicId}</strong>.</p>
          <p>Ваш заказ <strong>{orderPublicId}</strong> на мероприятие <strong>{eventTitle}</strong> отменён.</p>
          <p>Организатор подтвердил возврат на сумму <strong>{amount}</strong>. Возврат уже оформлен на исходный способ оплаты. Срок фактического зачисления средств зависит от банка и платёжной системы.</p>
          <p><strong>Все билеты и QR-коды по этому заказу больше недействительны.</strong></p>
          <p style={{marginTop:28}}><Link href="#" style={{display:"inline-block",background:"#081426",color:"white",textDecoration:"none",padding:"12px 18px",borderRadius:10,fontWeight:700}}>Посмотреть отменённый заказ</Link></p>
        </div>
      </div>
    </div>
  </main>;
}
