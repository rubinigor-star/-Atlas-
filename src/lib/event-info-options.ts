export type VenueOption = {
  name: string;
  nameHe: string;
  city: string;
  cityHe: string;
  address: string;
};

export const venueCatalog: VenueOption[] = [
  { name: "Auditorium Haifa", nameHe: "אודיטוריום חיפה", city: "Хайфа", cityHe: "חיפה", address: "שדרות הנשיא 138, חיפה" },
  { name: "Amphi Shuni", nameHe: "אמפי שוני", city: "Биньямина", cityHe: "בנימינה", address: "פארק ז׳בוטינסקי, בנימינה-גבעת עדה" },
  { name: "Barby Tel Aviv", nameHe: "בארבי תל אביב", city: "Тель-Авив-Яффо", cityHe: "תל אביב-יפו", address: "נמל יפו, מחסן 2, תל אביב-יפו" },
  { name: "Beit Nagler", nameHe: "בית נגלר", city: "Хайфа", cityHe: "חיפה", address: "רחוב בן צבי 14, קריית חיים, חיפה" },
  { name: "Gray Tel Aviv", nameHe: "גריי תל אביב", city: "Тель-Авив-Яффо", cityHe: "תל אביב-יפו", address: "אבן גבירול 30, תל אביב-יפו" },
  { name: "Gray Yehud", nameHe: "גריי יהוד", city: "Йехуд-Моноссон", cityHe: "יהוד-מונוסון", address: "דרך העצמאות 2, יהוד-מונוסון" },
  { name: "Hangar 11", nameHe: "האנגר 11", city: "Тель-Авив-Яффо", cityHe: "תל אביב-יפו", address: "כ״ג יורדי הסירה 1, נמל תל אביב" },
  { name: "Heichal HaTarbut Tel Aviv", nameHe: "היכל התרבות תל אביב", city: "Тель-Авив-Яффо", cityHe: "תל אביב-יפו", address: "כיכר הבימה, הוברמן 1, תל אביב-יפו" },
  { name: "International Convention Center Haifa", nameHe: "מרכז הקונגרסים חיפה", city: "Хайфа", cityHe: "חיפה", address: "קדושי יאסי 2, חיפה" },
  { name: "Krieger Arts Center", nameHe: "מרכז קריגר לאמנויות הבמה", city: "Хайфа", cityHe: "חיפה", address: "אליהו חכים 6, חיפה" },
  { name: "MALINA Night Club", nameHe: "מלינה נייט קלאב", city: "Хайфа", cityHe: "חיפה", address: "חיפה, ישראל" },
  { name: "Menora Mivtachim Arena", nameHe: "מנורה מבטחים ארנה", city: "Тель-Авив-Яффо", cityHe: "תל אביב-יפו", address: "יגאל אלון 51, תל אביב-יפו" },
  { name: "Pais Arena Jerusalem", nameHe: "פיס ארנה ירושלים", city: "Иерусалим", cityHe: "ירושלים", address: "דרך דוד בנבנישתי 1, ירושלים" },
  { name: "Reading 3", nameHe: "רידינג 3", city: "Тель-Авив-Яффо", cityHe: "תל אביב-יפו", address: "התערוכה 3, נמל תל אביב" },
  { name: "Romema Arena", nameHe: "רוממה ארנה", city: "Хайфа", cityHe: "חיפה", address: "פיק״א 69, חיפה" },
  { name: "Sultan's Pool", nameHe: "בריכת הסולטן", city: "Иерусалим", cityHe: "ירושלים", address: "דרך חברון, ירושלים" },
  { name: "Zappa Haifa", nameHe: "זאפה חיפה", city: "Хайфа", cityHe: "חיפה", address: "משה פלימן 4, חיפה" },
  { name: "Zappa Herzliya", nameHe: "זאפה הרצליה", city: "Герцлия", cityHe: "הרצליה", address: "מדינת היהודים 85, הרצליה" },
  { name: "Другой зал", nameHe: "אולם אחר", city: "", cityHe: "", address: "" },
].sort((a, b) => a.nameHe.localeCompare(b.nameHe, "he"));

export const hebrewLetters = ["א","ב","ג","ד","ה","ו","ז","ח","ט","י","כ","ל","מ","נ","ס","ע","פ","צ","ק","ר","ש","ת"] as const;

export const ageRestrictionOptions = ["Без ограничений", "Детское", "3+", "6+", "12+", "14+", "16+", "18+"] as const;

const ageCopy: Record<string, { ru: string; he: string; en: string }> = {
  "Без ограничений": {
    ru: "Программа без возрастных ограничений. Подходит для семейного посещения, включая детей в сопровождении взрослых.",
    he: "האירוע ללא הגבלת גיל ומתאים לבילוי משפחתי, כולל ילדים בליווי מבוגר.",
    en: "This event has no age restriction and is suitable for families, including children accompanied by an adult.",
  },
  "Детское": {
    ru: "Детская программа. Рекомендуемый возраст зависит от содержания мероприятия и указывается организатором в описании.",
    he: "אירוע לילדים. הגיל המומלץ נקבע לפי תוכן האירוע ומפורט בתיאור.",
    en: "A children’s program. The recommended age depends on the event content and is stated in the description.",
  },
  "3+": { ru: "Посещение разрешено гостям от 3 лет. Дети допускаются только в сопровождении взрослого.", he: "הכניסה מגיל 3 ומעלה. ילדים ייכנסו בליווי מבוגר בלבד.", en: "Admission is permitted from age 3. Children must be accompanied by an adult." },
  "6+": { ru: "Посещение разрешено гостям от 6 лет. Дети допускаются только в сопровождении взрослого.", he: "הכניסה מגיל 6 ומעלה. ילדים ייכנסו בליווי מבוגר בלבד.", en: "Admission is permitted from age 6. Children must be accompanied by an adult." },
  "12+": { ru: "Посещение разрешено гостям от 12 лет. Несовершеннолетние допускаются в соответствии с правилами площадки.", he: "הכניסה מגיל 12 ומעלה. כניסת קטינים כפופה למדיניות המקום.", en: "Admission is permitted from age 12. Minors are admitted subject to the venue policy." },
  "14+": { ru: "Посещение разрешено гостям от 14 лет. Несовершеннолетние допускаются в соответствии с правилами площадки.", he: "הכניסה מגיל 14 ומעלה. כניסת קטינים כפופה למדיניות המקום.", en: "Admission is permitted from age 14. Minors are admitted subject to the venue policy." },
  "16+": { ru: "Посещение разрешено гостям от 16 лет. При входе могут попросить документ, подтверждающий возраст.", he: "הכניסה מגיל 16 ומעלה. ייתכן שתידרש הצגת תעודה מזהה בכניסה.", en: "Admission is permitted from age 16. Proof of age may be required at the entrance." },
  "18+": { ru: "Вход только для гостей от 18 лет. На входе требуется действительное удостоверение личности с фотографией.", he: "הכניסה מגיל 18 ומעלה בלבד. יש להציג תעודה מזהה תקפה עם תמונה.", en: "Admission is restricted to guests aged 18 and over. A valid photo ID is required." },
};

export function getAgeRestrictionDescription(value: string, locale: "ru" | "he" | "en") {
  return (ageCopy[value] || ageCopy["Без ограничений"])[locale];
}

export function findVenue(name: string) {
  return venueCatalog.find((venue) => venue.name === name || venue.nameHe === name);
}
