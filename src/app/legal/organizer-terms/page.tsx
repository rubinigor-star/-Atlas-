import Link from "next/link";
import {AtlasLogo} from "@/components/atlas-logo";
import {ORGANIZER_AGREEMENT_EFFECTIVE_DATE,ORGANIZER_AGREEMENT_SECTIONS,ORGANIZER_AGREEMENT_VERSION} from "@/lib/organizer-agreement";
import {getServerI18n} from "@/lib/server-locale";
import {localeConfig} from "@/lib/i18n";

const heSections=[
 ["1. מטרת הפלטפורמה","Atlas One מספקת למפיקים כלים ליצירת אירועים, מכירה והנפקת כרטיסים, בקרת כניסה, ניהול נתוני לקוחות, החזרים, תקשורת שיווקית ואנליטיקה."],
 ["2. הרשמה ונכונות המידע","המפיק מחויב למסור פרטי קשר, מידע משפטי ופרטי תשלום עדכניים, לשמור על אבטחת הגישה לחשבון ולדווח ל-Atlas One ללא דיחוי על שימוש בלתי מורשה."],
 ["3. אימות המפיק","פתיחת חשבון אינה מהווה אישור אוטומטי לקבלת תשלומים או לפרסום מכירות. Atlas One רשאית לבקש מסמכי חברה, תעודה מזהה, פרטי בנק, מידע מס, אישורים לאירוע ומידע נוסף הנדרש לצורך האימות."],
 ["4. אירועים ותוכן","המפיק אחראי לחוקיות האירוע, לנכונות התיאור, המחיר, התאריך, המקום, הגבלות הגיל, לזכויות בתמונות, במוזיקה, בסימני מסחר ובכל תוכן אחר המתפרסם."],
 ["5. עמלות ודמי שירות","עמלת Atlas One, אופן גביית דמי השירות, מועדי התשלום, עתודות והוצאות נוספות נקבעים בתנאים המסחריים האישיים של המפיק. לאירוע מסוים עשויים לחול חריגים המאושרים על ידי הפלטפורמה. התנאים התקפים מוצגים במערכת הניהול."],
 ["6. תשלומים למפיק","תשלומים למפיק מבוצעים לאחר ניכוי עמלות מוסכמות, החזרים, ביטולי תשלום, מסים וסכומים נוספים לפי התנאים. Atlas One רשאית לעכב תשלום זמנית במקרה של חשד להונאה, מחלוקת, הכחשת עסקה, ביטול אירוע או היעדר מסמכים נדרשים."],
 ["7. ביטול, שינוי מועד והחזרים","המפיק מחויב לעדכן את הרוכשים בזמן על ביטול, שינוי מועד או שינוי מהותי באירוע. החזרים יבוצעו בהתאם לדין החל, לתנאי המכירה ולהגדרות האירוע. המפיק אחראי לכך שיהיו מקורות כספיים זמינים לביצוע ההחזרים."],
 ["8. נתוני לקוחות ושיווק","המפיק רשאי להשתמש בנתוני לקוחות רק לצורך ביצוע ההזמנה ותקשורת חוקית. מסרים פרסומיים מותרים רק כאשר קיים האישור הנדרש. הסרה מדיוור אינה מוחקת היסטוריית רכישות ואינה מבטלת הודעות שירות הכרחיות."],
 ["9. שימוש אסור","אסורים אירועים בלתי חוקיים, הונאה, מכירת כרטיסים שאינם קיימים, עקיפת עמלות, יצוא מידע ללא הרשאה, ספאם, הפרת זכויות צד שלישי וניסיונות לפגוע בפעילות הפלטפורמה."],
 ["10. הגבלה והשעיית גישה","Atlas One רשאית להגביל פרסום, מכירות, תשלומים או גישה למערכת במקרה של הפרת התנאים, דרישות דין, סיכון אבטחה, תלונות רוכשים או צורך בבדיקה."],
 ["11. אחריות","המפיק אחראי לקיום האירוע ולמילוי התחייבויותיו כלפי הרוכשים. Atlas One אחראית לאספקת הפלטפורמה במסגרת הדין החל והתנאים המסחריים המוסכמים."],
 ["12. שינוי התנאים","נוסח מעודכן יפורסם בעמוד זה. שינויים מהותיים עשויים להימסר גם במערכת הניהול או בדוא״ל. המשך השימוש בפלטפורמה לאחר כניסת השינויים לתוקף מהווה קבלה של הנוסח החדש."],
 ["13. יצירת קשר","לשאלות לגבי התנאים או העבודה במערכת הניהול ניתן להשתמש בטופס יצירת הקשר של Atlas One או בכתובת התמיכה הרשמית המופיעה באתר."]
] as const;
const enSections=[
 ["1. Purpose of the platform","Atlas One provides organizers with tools to create events, sell and issue tickets, manage admission, customer data, refunds, marketing communications and analytics."],
 ["2. Registration and accuracy of information","The organizer must provide current contact, legal and payment information, protect access to the workspace and notify Atlas One without delay of unauthorized account use."],
 ["3. Organizer verification","Creating a workspace does not automatically authorize payment acceptance or publication of sales. Atlas One may request company documents, identification, bank details, tax information, event permits and other information reasonably required for verification."],
 ["4. Events and content","The organizer is responsible for the legality of the event and the accuracy of its description, price, date, venue, age restrictions, and rights to images, music, trademarks and other published content."],
 ["5. Fees and service charges","Atlas One fees, service-fee allocation, payout timing, reserves and additional costs are defined in the organizer's individual commercial terms. Platform-approved exceptions may apply to a specific event. Current terms are shown in the organizer workspace."],
 ["6. Payouts","Payouts are made after agreed fees, refunds, charge reversals, taxes and other applicable amounts are deducted. Atlas One may temporarily withhold a payout in cases of suspected fraud, disputes, chargebacks, event cancellation or missing required documents."],
 ["7. Cancellation, rescheduling and refunds","The organizer must promptly inform buyers about event cancellation, rescheduling and material changes. Refunds are handled under applicable law, the sale terms and event settings. The organizer is responsible for maintaining funds required for refunds."],
 ["8. Customer data and marketing","The organizer may use customer data only to fulfill orders and for lawful communications. Marketing messages require any consent required by law. Marketing opt-out does not erase purchase history or block mandatory transactional notifications."],
 ["9. Prohibited use","Illegal events, fraud, sale of nonexistent tickets, fee circumvention, unauthorized data export, spam, third-party rights violations and attempts to interfere with the platform are prohibited."],
 ["10. Restriction and suspension","Atlas One may restrict publishing, sales, payouts or workspace access in case of a terms violation, legal requirement, security risk, buyer complaints or a need for verification."],
 ["11. Responsibility","The organizer is responsible for holding the event and fulfilling obligations to buyers. Atlas One is responsible for providing the platform within applicable law and the agreed commercial terms."],
 ["12. Changes to the terms","An updated version will be published on this page. Material changes may also be communicated in the workspace or by email. Continued use after changes take effect constitutes acceptance of the new version."],
 ["13. Contact","Questions about these terms or the organizer workspace can be sent through the Atlas One contact form or the official support address shown on the site."]
] as const;
const copy={
 ru:{meta:"Условия для организаторов | Atlas One",eyebrow:"Юридическая информация",title:"Условия использования для организаторов",revision:`Редакция от ${ORGANIZER_AGREEMENT_EFFECTIVE_DATE}`,back:"Вернуться к регистрации",privacy:"Политика конфиденциальности",sections:ORGANIZER_AGREEMENT_SECTIONS.map(s=>[s.title,s.body] as const)},
 he:{meta:"תנאים למפיקים | Atlas One",eyebrow:"מידע משפטי",title:"תנאי שימוש למפיקים",revision:"נוסח בתוקף מ-13 באוגוסט 2026",back:"חזרה להרשמה",privacy:"מדיניות הפרטיות",sections:heSections},
 en:{meta:"Organizer terms | Atlas One",eyebrow:"Legal information",title:"Terms of use for organizers",revision:"Effective August 13, 2026",back:"Back to registration",privacy:"Privacy policy",sections:enSections}
} as const;
export async function generateMetadata(){const{locale}=await getServerI18n();return{title:copy[locale].meta}}
export default async function OrganizerTermsPage(){const{locale}=await getServerI18n();const t=copy[locale];return <main lang={localeConfig[locale].tag} dir={localeConfig[locale].dir} className="container" style={{maxWidth:900,paddingTop:40,paddingBottom:80}}><div className="panel" style={{padding:32}}><AtlasLogo office/><div style={{marginTop:24}}><span className="eyebrow">{t.eyebrow}</span><h1>{t.title}</h1><p className="muted">{t.revision} · <bdi>{ORGANIZER_AGREEMENT_VERSION}</bdi></p></div><div className="form" style={{lineHeight:1.65}}>{t.sections.map(([title,body])=><section key={title}><h2>{title}</h2><p>{body}</p></section>)}</div><div className="row" style={{marginTop:28,flexWrap:"wrap"}}><Link className="btn dark" href="/office/register">{t.back}</Link><Link className="btn secondary" href="/legal/privacy">{t.privacy}</Link></div></div></main>}
