import styles from "./ticket-design-preview.module.css";

const details = [
  ["Дата и время", "26 ноября 2026, 20:00"],
  ["Площадка", "Reading 3, Тель-Авив"],
  ["Категория", "VIP Standing"],
  ["Гость", "Igor Rubin"],
  ["Место", "Секция A · Ряд 2 · Место 14"],
  ["Заказ", "ATL-MS94QYR6-A350"],
];

function Qr() {
  return <div className={styles.qr} aria-label="QR preview"><span /><span /><span /><span /><span /><span /><span /><span /><span /></div>;
}

function Status() {
  return <span className={styles.status}><i /> VALID</span>;
}

export default function TicketDesignPreviewPage() {
  return (
    <main className={styles.page}>
      <header className={styles.hero}>
        <div>
          <span className={styles.eyebrow}>Atlas Ticket Design System</span>
          <h1>Один билет. Один визуальный язык.</h1>
          <p>Визуальная концепция для PDF, Apple Wallet, web и email. Это изолированный прототип без подключения к реальным заказам.</p>
        </div>
        <div className={styles.tokens}>
          <span style={{ background: "#071426" }} />
          <span style={{ background: "#ff5b45" }} />
          <span style={{ background: "#f4f7fb" }} />
          <span style={{ background: "#ffffff" }} />
        </div>
      </header>

      <section className={styles.grid}>
        <article className={styles.panel}>
          <div className={styles.panelHead}><span>01</span><div><b>PDF ticket</b><small>Полная версия для скачивания</small></div></div>
          <div className={styles.pdfTicket}>
            <div className={styles.brandRow}><div className={styles.logo}>ATLAS<span>ONE</span></div><Status /></div>
            <div className={styles.art}><span>LIVE IN ISRAEL</span><strong>REFLEX</strong><small>25 YEARS TOUR</small></div>
            <div className={styles.pdfBody}>
              <div><span className={styles.kicker}>БИЛЕТ НА МЕРОПРИЯТИЕ</span><h2>REFLEX · 25 YEARS TOUR</h2></div>
              <div className={styles.details}>{details.slice(0, 5).map(([label, value]) => <div key={label}><small>{label}</small><b>{value}</b></div>)}</div>
              <div className={styles.qrRow}><Qr /><div><small>НОМЕР ЗАКАЗА</small><b>ATL-MS94QYR6-A350</b><small>КОД БИЛЕТА</small><b>ATL-48F2-91AC</b></div></div>
            </div>
            <footer>Powered by Atlas One · atlas-one.co</footer>
          </div>
        </article>

        <article className={styles.panel}>
          <div className={styles.panelHead}><span>02</span><div><b>Apple Wallet</b><small>Нативная адаптация под ограничения Apple</small></div></div>
          <div className={styles.phone}>
            <div className={styles.wallet}>
              <div className={styles.walletTop}><div className={styles.walletLogo}>A</div><div><b>Atlas One</b><small>Event Ticket</small></div><Status /></div>
              <div className={styles.walletArt}><small>LIVE IN ISRAEL</small><strong>REFLEX</strong></div>
              <div className={styles.walletTitle}><small>МЕРОПРИЯТИЕ</small><h2>REFLEX · 25 YEARS TOUR</h2></div>
              <div className={styles.walletFields}><div><small>ДАТА</small><b>26 НОЯБРЯ</b><span>20:00</span></div><div><small>ПЛОЩАДКА</small><b>READING 3</b><span>Тель-Авив</span></div></div>
              <div className={styles.walletFields}><div><small>КАТЕГОРИЯ</small><b>VIP STANDING</b></div><div><small>ГОСТЬ</small><b>IGOR RUBIN</b></div></div>
              <Qr />
              <div className={styles.code}>ATL-48F2-91AC</div>
            </div>
          </div>
        </article>

        <article className={styles.panel}>
          <div className={styles.panelHead}><span>03</span><div><b>Web ticket</b><small>Основной мобильный билет</small></div></div>
          <div className={styles.webCard}>
            <div className={styles.webArt}><div className={styles.logo}>ATLAS<span>ONE</span></div><Status /><strong>REFLEX</strong></div>
            <div className={styles.webBody}><span className={styles.kicker}>26 НОЯБРЯ · 20:00</span><h2>REFLEX · 25 YEARS TOUR</h2><p>Reading 3, Тель-Авив</p><div className={styles.webInfo}><div><small>КАТЕГОРИЯ</small><b>VIP Standing</b></div><div><small>ГОСТЬ</small><b>Igor Rubin</b></div><div><small>МЕСТО</small><b>A · 2 · 14</b></div></div><Qr /><button type="button">Добавить в Apple Wallet</button><a>Скачать PDF</a></div>
          </div>
        </article>

        <article className={styles.panel}>
          <div className={styles.panelHead}><span>04</span><div><b>Email</b><small>Компактная доставка билета</small></div></div>
          <div className={styles.email}>
            <div className={styles.emailHead}><div className={styles.logo}>ATLAS<span>ONE</span></div><span>Ваш билет готов</span></div>
            <div className={styles.emailArt}><strong>REFLEX</strong><small>25 YEARS TOUR</small></div>
            <div className={styles.emailBody}><Status /><h2>REFLEX · 25 YEARS TOUR</h2><p>26 ноября 2026, 20:00<br />Reading 3, Тель-Авив</p><div className={styles.emailTicket}><div><small>ГОСТЬ</small><b>Igor Rubin</b><small>КАТЕГОРИЯ</small><b>VIP Standing</b></div><Qr /></div><button type="button">Открыть билет</button><button type="button" className={styles.darkButton}>Добавить в Apple Wallet</button><small className={styles.note}>Каждый билет имеет отдельный QR и отдельную Wallet-ссылку.</small></div>
          </div>
        </article>
      </section>

      <section className={styles.rtl} dir="rtl">
        <div><span className={styles.eyebrow}>RTL CHECK</span><h2>אותו כרטיס, אותה היררכיה</h2><p>הכותרות, הנתונים, הסטטוס והפעולות נשארים עקביים גם בעברית.</p></div>
        <div className={styles.rtlCard}><Status /><small>אירוע</small><b>REFLEX · 25 YEARS TOUR</b><small>תאריך ומקום</small><b>26 בנובמבר 2026 · רידינג 3</b></div>
      </section>
    </main>
  );
}
