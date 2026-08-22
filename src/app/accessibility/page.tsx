import type { Metadata } from "next";
import Link from "next/link";
import { localeConfig } from "@/lib/i18n";
import { getServerI18n } from "@/lib/server-locale";

const content = {
  ru: {
    metaTitle: "Заявление о доступности - Atlas One",
    metaDescription: "Информация о доступности Atlas One, поддерживаемых настройках и способах сообщить о проблеме.",
    title: "Заявление о доступности",
    intro: "Atlas One стремится сделать покупку билетов и использование платформы доступными для людей с различными потребностями и возможностями.",
    standardTitle: "Стандарт доступности",
    standard: "Мы последовательно адаптируем сайт в соответствии с израильским стандартом IS 5568 и принципами WCAG 2.0 уровня AA. Доступность проверяется и улучшается по мере развития продукта.",
    featuresTitle: "Что уже поддерживается",
    features: [
      "Навигация с клавиатуры и заметный индикатор фокуса.",
      "Семантическая структура страниц и подписи для интерактивных элементов.",
      "Настройки увеличения текста, интервалов, подчёркивания ссылок и уменьшения анимации.",
      "Поддержка языков с направлением слева направо и справа налево.",
      "Адаптация интерфейса для мобильных устройств и компьютеров.",
    ],
    limitsTitle: "Известные ограничения",
    limits: "Некоторые сложные элементы, включая схемы мест и внешние платёжные компоненты, могут зависеть от сторонних технологий. Мы продолжаем улучшать их доступность и предоставлять альтернативный путь взаимодействия там, где это возможно.",
    venuesTitle: "Доступность мероприятий и площадок",
    venues: "Atlas One является билетной платформой. Физическая доступность конкретной площадки и специальные условия мероприятия определяются организатором и площадкой. Если информация предоставлена организатором, мы публикуем её в карточке мероприятия или помогаем получить её через поддержку.",
    contactTitle: "Нашли проблему с доступностью?",
    contact: "Напишите нам на support@atlas-one.co и укажите страницу, устройство, браузер и краткое описание проблемы. Мы постараемся предоставить доступную альтернативу и исправить проблему.",
    updated: "Последнее обновление: 22 августа 2026",
    back: "Вернуться на главную",
  },
  he: {
    metaTitle: "הצהרת נגישות - Atlas One",
    metaDescription: "מידע על נגישות Atlas One, התאמות הנגישות הקיימות ודרכי יצירת קשר במקרה של בעיה.",
    title: "הצהרת נגישות",
    intro: "Atlas One פועלת כדי לאפשר לאנשים עם מגוון צרכים ויכולות לרכוש כרטיסים ולהשתמש בפלטפורמה בצורה נגישה.",
    standardTitle: "תקן הנגישות",
    standard: "אנו פועלים להתאמת האתר לתקן הישראלי ת״י 5568 ולעקרונות WCAG 2.0 ברמת AA. הנגישות נבדקת ומשתפרת באופן שוטף עם התפתחות המוצר.",
    featuresTitle: "התאמות הקיימות באתר",
    features: [
      "ניווט באמצעות מקלדת וסימון ברור של מוקד המקלדת.",
      "מבנה סמנטי ותוויות לרכיבים אינטראקטיביים.",
      "אפשרויות להגדלת טקסט, ריווח טקסט, הדגשת קישורים והפחתת אנימציות.",
      "תמיכה בשפות ובכיווניות מימין לשמאל ומשמאל לימין.",
      "התאמה למכשירים ניידים ולמחשבים שולחניים.",
    ],
    limitsTitle: "מגבלות ידועות",
    limits: "חלק מהרכיבים המורכבים, ובהם מפות מושבים ורכיבי תשלום חיצוניים, עשויים להיות תלויים בטכנולוגיות של צד שלישי. אנו ממשיכים לשפר את נגישותם ולספק חלופה נגישה ככל שניתן.",
    venuesTitle: "נגישות אירועים ומקומות",
    venues: "Atlas One היא פלטפורמת כרטוס. הסדרי הנגישות הפיזיים של מקום מסוים והתאמות באירוע נקבעים על ידי המפיק והמקום. כאשר המידע נמסר לנו, אנו מציגים אותו בעמוד האירוע או מסייעים לקבל אותו דרך התמיכה.",
    contactTitle: "נתקלתם בבעיית נגישות?",
    contact: "כתבו לנו ל-support@atlas-one.co וציינו את כתובת העמוד, סוג המכשיר, הדפדפן ותיאור קצר של הבעיה. נפעל לספק חלופה נגישה ולתקן את הבעיה.",
    updated: "עדכון אחרון: 22 באוגוסט 2026",
    back: "חזרה לעמוד הראשי",
  },
  en: {
    metaTitle: "Accessibility statement - Atlas One",
    metaDescription: "Atlas One accessibility information, available accessibility controls and contact details for reporting an issue.",
    title: "Accessibility statement",
    intro: "Atlas One is committed to making ticket purchasing and use of the platform accessible to people with a wide range of needs and abilities.",
    standardTitle: "Accessibility standard",
    standard: "We are progressively adapting the site in line with Israeli Standard IS 5568 and WCAG 2.0 Level AA principles. Accessibility is reviewed and improved as the product evolves.",
    featuresTitle: "Accessibility features currently available",
    features: [
      "Keyboard navigation with a visible focus indicator.",
      "Semantic page structure and labels for interactive controls.",
      "Controls for larger text, increased text spacing, underlined links and reduced motion.",
      "Support for both left-to-right and right-to-left languages.",
      "Responsive operation on mobile devices and desktop computers.",
    ],
    limitsTitle: "Known limitations",
    limits: "Some complex elements, including seat maps and externally hosted payment components, may depend on third-party technology. We continue to improve their accessibility and provide an alternative path where reasonably possible.",
    venuesTitle: "Venue and event accessibility",
    venues: "Atlas One is a ticketing platform. Physical accessibility arrangements for a specific venue and event are determined by the organizer and venue. When the organizer provides this information, we publish it on the event page or help users obtain it through support.",
    contactTitle: "Found an accessibility issue?",
    contact: "Email support@atlas-one.co with the page address, device, browser and a short description of the issue. We will work to provide an accessible alternative and correct the problem.",
    updated: "Last updated: August 22, 2026",
    back: "Back to home",
  },
} as const;

export async function generateMetadata(): Promise<Metadata> {
  const { locale } = await getServerI18n();
  const t = content[locale];
  return { title: t.metaTitle, description: t.metaDescription };
}

export default async function AccessibilityPage() {
  const { locale } = await getServerI18n();
  const t = content[locale];
  const settings = localeConfig[locale];

  return <main className="atlas-accessibility-statement" id="atlas-main-content">
    <div className="atlas-accessibility-statement-card" lang={settings.tag} dir={settings.dir}>
      <div className="atlas-accessibility-statement-kicker">Atlas One</div>
      <h1>{t.title}</h1>
      <p className="atlas-accessibility-statement-lead">{t.intro}</p>

      <section>
        <h2>{t.standardTitle}</h2>
        <p>{t.standard}</p>
      </section>

      <section>
        <h2>{t.featuresTitle}</h2>
        <ul>{t.features.map(item => <li key={item}>{item}</li>)}</ul>
      </section>

      <section>
        <h2>{t.limitsTitle}</h2>
        <p>{t.limits}</p>
      </section>

      <section>
        <h2>{t.venuesTitle}</h2>
        <p>{t.venues}</p>
      </section>

      <section>
        <h2>{t.contactTitle}</h2>
        <p>{t.contact}</p>
        <a className="atlas-accessibility-email" href="mailto:support@atlas-one.co" dir="ltr">support@atlas-one.co</a>
      </section>

      <div className="atlas-accessibility-statement-footer">
        <span>{t.updated}</span>
        <Link href="/">{t.back}</Link>
      </div>
    </div>
  </main>;
}