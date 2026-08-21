"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale } from "@/components/locale-provider";
import styles from "./hyp-launch.module.css";

export function HypLaunchClient({paymentUrl}:{paymentUrl:string}){
  const router=useRouter();
  const {locale}=useLocale();
  const backLabel=locale==="he"?"חזרה לפרטי ההזמנה":locale==="ru"?"Вернуться к оформлению заказа":"Back to checkout";

  return <main className={styles.shell}>
    <div className={styles.toolbar}>
      <button type="button" className={styles.back} onClick={()=>router.back()}>
        <span className={styles.backIcon} aria-hidden="true">←</span>{backLabel}
      </button>
    </div>
    <section className={styles.frameWrap} aria-label="HYP payment">
      <iframe
        className={styles.frame}
        src={paymentUrl}
        title="HYP payment"
        allow="payment"
        scrolling="no"
        referrerPolicy="origin"
      />
      <div className={styles.paymentLegal} dir={locale==="he"?"rtl":"ltr"}>
        {locale==="he"?<span>ע״י לחיצה על כפתור התשלום אני מאשר/ת את <Link href="/privacy" target="_blank">מדיניות הפרטיות</Link> ו<Link href="/terms" target="_blank">תנאי השימוש</Link></span>:locale==="ru"?<span>Нажимая кнопку оплаты, я подтверждаю согласие с <Link href="/privacy" target="_blank">Политикой конфиденциальности</Link> и <Link href="/terms" target="_blank">Условиями использования</Link></span>:<span>By clicking the payment button, I agree to the <Link href="/privacy" target="_blank">Privacy Policy</Link> and <Link href="/terms" target="_blank">Terms of Use</Link></span>}
      </div>
    </section>
  </main>;
}
