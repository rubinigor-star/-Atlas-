export type Locale = "ru" | "he" | "en";

export const locales: Locale[] = ["ru", "he", "en"];

export const localeNames: Record<Locale, string> = {
  ru: "Русский",
  he: "עברית",
  en: "English",
};

const dictionary = {
  ru: {
    common: {
      language: "Язык", events: "События", organizers: "Организаторам", backoffice: "Кабинет организатора", overview: "Обзор", requests: "Заявки", createEvent: "Создать мероприятие", orders: "Заказы", scanner: "Сканер", testOnly: "MVP · только тестовые платежи", continue: "Продолжить", total: "Итого", quantity: "Количество", close: "Закрыть", save: "Сохранить", edit: "Изменить", cancel: "Отмена", loading: "Загрузка…", soldOut: "Продано", available: "Доступно",
    },
    nav: { events: "Мероприятия", guestLists: "Гостевые списки", guests: "Гости", promoters: "Промоутеры", team: "Команда", audit: "Журнал" },
    home: { eyebrow: "Live experiences in Israel", title: "Билеты, ради которых хочется выйти из дома.", subtitle: "Концерты, вечеринки и специальные события. Простой выбор, прозрачная цена и билет сразу после оформления.", upcoming: "Ближайшие события", eventCount: "мероприятий", tour: "Тур", dates: "дат", salesSoon: "Продажи скоро", from: "от", chooseCity: "Выбрать город", choose: "Выбрать" },
    event: { personalLink: "Персональная ссылка", personalLinkInfo: "Доступны условия и инвентарь, назначенные организатором.", doors: "Двери откроются за час до начала", safeCheckout: "Безопасный тестовый checkout", safeCheckoutInfo: "В этой MVP-версии деньги не списываются", videos: "Видео", openVideo: "Открыть видео", links: "Ссылки", salesClosed: "Продажи сейчас закрыты", noTariffs: "Ни один тариф не доступен в текущий период." },
    purchase: { title: "Выберите билет", remaining: "осталось", map: "Выберите место на карте", stage: "СЦЕНА", whole: "целиком", perSeat: "за место", selected: "Выбрано мест", table: "стол", sofa: "диван", row: "ряд", unavailable: "Занято", legend: "Категории и цены", unassigned: "Не продаётся", endsSoon: "Текущий этап продаж заканчивается скоро", sold: "Уже куплено", tickets: "билетов", next: "Следующая цена", priceRisesIn: "Цена повысится через", days: "дн.", hours: "ч.", minutes: "мин." },
    office: { denied: "Доступ закрыт", deniedText: "Выберите демонстрационного сотрудника организации или войдите в рабочий аккаунт.", backToSite: "Вернуться на сайт" },
  },
  he: {
    common: {
      language: "שפה", events: "אירועים", organizers: "למפיקים", backoffice: "אזור המפיקים", overview: "סקירה", requests: "בקשות", createEvent: "יצירת אירוע", orders: "הזמנות", scanner: "סריקת כרטיסים", testOnly: "גרסת הדגמה · ללא חיוב אמיתי", continue: "המשך", total: "סה״כ", quantity: "כמות", close: "סגירה", save: "שמירה", edit: "עריכה", cancel: "ביטול", loading: "טוען…", soldOut: "אזל", available: "זמין",
    },
    nav: { events: "אירועים", guestLists: "רשימות אורחים", guests: "אורחים", promoters: "יחצנים", team: "צוות", audit: "יומן פעילות" },
    home: { eyebrow: "חוויות חיות בישראל", title: "כרטיסים ששווה לצאת בשבילם מהבית.", subtitle: "הופעות, מסיבות ואירועים מיוחדים — בחירה פשוטה, מחיר ברור וכרטיס שמגיע מיד לאחר ההזמנה.", upcoming: "אירועים קרובים", eventCount: "אירועים", tour: "סיבוב הופעות", dates: "תאריכים", salesSoon: "המכירה תיפתח בקרוב", from: "החל מ־", chooseCity: "בחרו עיר", choose: "בחרו" },
    event: { personalLink: "קישור אישי", personalLinkInfo: "בקישור הזה זמינים התנאים והמלאי שהמפיק הקצה לכם.", doors: "פתיחת דלתות שעה לפני תחילת האירוע", safeCheckout: "תשלום מאובטח במצב הדגמה", safeCheckoutInfo: "בגרסת ההדגמה לא מתבצע חיוב אמיתי", videos: "וידאו", openVideo: "צפייה בווידאו", links: "קישורים", salesClosed: "המכירה סגורה כרגע", noTariffs: "אין כרגע קטגוריות כרטיסים זמינות לרכישה." },
    purchase: { title: "בחרו כרטיס", remaining: "נותרו", map: "בחרו מקום במפה", stage: "במה", whole: "ליחידה", perSeat: "למושב", selected: "מקומות שנבחרו", table: "שולחן", sofa: "ספה", row: "שורה", unavailable: "תפוס", legend: "קטגוריות ומחירים", unassigned: "לא למכירה", endsSoon: "שלב המכירה הנוכחי מסתיים בקרוב", sold: "כבר נרכשו", tickets: "כרטיסים", next: "המחיר הבא", priceRisesIn: "המחיר יעלה בעוד", days: "ימים", hours: "שעות", minutes: "דקות" },
    office: { denied: "אין לכם הרשאה להיכנס", deniedText: "בחרו משתמש הדגמה של הארגון או התחברו לחשבון העבודה שלכם.", backToSite: "חזרה לאתר" },
  },
  en: {
    common: {
      language: "Language", events: "Events", organizers: "For organizers", backoffice: "Organizer dashboard", overview: "Overview", requests: "Requests", createEvent: "Create event", orders: "Orders", scanner: "Ticket scanner", testOnly: "Demo mode · no real charges", continue: "Continue", total: "Total", quantity: "Quantity", close: "Close", save: "Save", edit: "Edit", cancel: "Cancel", loading: "Loading…", soldOut: "Sold out", available: "Available",
    },
    nav: { events: "Events", guestLists: "Guest lists", guests: "Guests", promoters: "Promoters", team: "Team", audit: "Activity log" },
    home: { eyebrow: "Live experiences in Israel", title: "Tickets worth leaving home for.", subtitle: "Concerts, parties and special events — simple choices, clear pricing and instant ticket delivery.", upcoming: "Upcoming events", eventCount: "events", tour: "Tour", dates: "dates", salesSoon: "Sales open soon", from: "from", chooseCity: "Choose a city", choose: "Select" },
    event: { personalLink: "Personal link", personalLinkInfo: "This link includes the terms and ticket inventory assigned to you by the organizer.", doors: "Doors open one hour before the event", safeCheckout: "Secure demo checkout", safeCheckoutInfo: "No real payment is charged in demo mode", videos: "Videos", openVideo: "Watch video", links: "Links", salesClosed: "Sales are currently closed", noTariffs: "No ticket categories are currently available." },
    purchase: { title: "Choose your ticket", remaining: "remaining", map: "Choose a seat on the map", stage: "STAGE", whole: "per unit", perSeat: "per seat", selected: "Selected seats", table: "table", sofa: "sofa", row: "row", unavailable: "Unavailable", legend: "Categories and prices", unassigned: "Not for sale", endsSoon: "The current sales phase ends soon", sold: "Already purchased", tickets: "tickets", next: "Next price", priceRisesIn: "Price increases in", days: "days", hours: "hours", minutes: "minutes" },
    office: { denied: "You do not have access", deniedText: "Select an organization demo user or sign in with your work account.", backToSite: "Back to site" },
  },
} as const;

export type Dictionary = typeof dictionary.ru;

export function normalizeLocale(value?: string | null): Locale {
  return value === "he" || value === "en" || value === "ru" ? value : "ru";
}

export function getDictionary(locale: Locale): Dictionary {
  return dictionary[locale] as Dictionary;
}

export function isRtl(locale: Locale) { return locale === "he"; }
