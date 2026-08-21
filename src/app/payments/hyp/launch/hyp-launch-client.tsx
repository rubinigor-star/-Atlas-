"use client";

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
    </section>
  </main>;
}
