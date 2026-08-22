import type { Locale } from "@/lib/i18n";

export const officeOrdersCopy = {
  ru: {
    title:"Заказы", atlasDescription:"Оплаченные заказы, заявки и выпущенные билеты Atlas.", importedDescription:"Импортированные продажи хранятся отдельно от продаж Atlas и не запускают оплату, approve, выдачу билетов или сообщения клиентам.", shown:"Показано", of:"из",
    importedOrders:"Импортированных заказов", onPage:"На этой странице", mode:"Режим", readOnly:"Read-only", noAtlasAutomation:"без автоматик Atlas",
    male:"Мужчины", female:"Женщины", averageAge:"Средний возраст", basedOn:"по", ordersGenitive:"заказам", noData:"нет данных",
    number:"Номер", event:"Событие", customer:"Клиент", tickets:"Билетов", amount:"Сумма", status:"Статус",
    noNumber:"Без номера", importedCustomer:"Клиент из импорта", customersSuffix:"клиента", withoutPhone:"без телефона", entered:"вошли", cancelled:"отменены", noImported:"Импортированных заказов пока нет.", noOrders:"Заказов пока нет.",
    back:"Назад", next:"Дальше", page:"Страница", pagesAria:"Страницы заказов", importedPagesAria:"Страницы импортированных заказов",
    gender:{MALE:"Мужчина",FEMALE:"Женщина",UNKNOWN:"Не указан"}, years:"лет",
    export:{externalOrder:"Номер внешнего заказа",order:"Номер заказа",event:"Мероприятие",eventDate:"Дата мероприятия",customer:"Клиент",phone:"Телефон",email:"Email",uniqueCustomers:"Уникальных клиентов",tickets:"Билетов",entered:"Вошли",cancelled:"Отменены",amount:"Сумма",type:"Тип",importedAt:"Дата импорта",gender:"Пол",age:"Возраст",status:"Статус",orderedAt:"Дата заказа"}
  },
  he: {
    title:"הזמנות", atlasDescription:"הזמנות Atlas ששולמו, בקשות וכרטיסים שהופקו.", importedDescription:"מכירות שיובאו נשמרות בנפרד ממכירות Atlas ואינן מפעילות חיוב, אישור, הפקת כרטיסים או הודעות ללקוחות.", shown:"מוצגות", of:"מתוך",
    importedOrders:"הזמנות שיובאו", onPage:"בעמוד הזה", mode:"מצב", readOnly:"לקריאה בלבד", noAtlasAutomation:"ללא אוטומציות של Atlas",
    male:"גברים", female:"נשים", averageAge:"גיל ממוצע", basedOn:"לפי", ordersGenitive:"הזמנות", noData:"אין נתונים",
    number:"מספר", event:"אירוע", customer:"לקוח", tickets:"כרטיסים", amount:"סכום", status:"סטטוס",
    noNumber:"ללא מספר", importedCustomer:"לקוח שיובא", customersSuffix:"לקוחות", withoutPhone:"ללא טלפון", entered:"נכנסו", cancelled:"בוטלו", noImported:"עדיין אין הזמנות שיובאו.", noOrders:"עדיין אין הזמנות.",
    back:"הקודם", next:"הבא", page:"עמוד", pagesAria:"עמודי הזמנות", importedPagesAria:"עמודי הזמנות שיובאו",
    gender:{MALE:"גבר",FEMALE:"אישה",UNKNOWN:"לא צוין"}, years:"שנים",
    export:{externalOrder:"מספר הזמנה חיצונית",order:"מספר הזמנה",event:"אירוע",eventDate:"תאריך האירוע",customer:"לקוח",phone:"טלפון",email:"Email",uniqueCustomers:"לקוחות ייחודיים",tickets:"כרטיסים",entered:"נכנסו",cancelled:"בוטלו",amount:"סכום",type:"סוג",importedAt:"תאריך ייבוא",gender:"מין",age:"גיל",status:"סטטוס",orderedAt:"תאריך הזמנה"}
  },
  en: {
    title:"Orders", atlasDescription:"Paid Atlas orders, approval requests, and issued tickets.", importedDescription:"Imported sales are stored separately from Atlas sales and do not trigger payment, approval, ticket issuance, or customer messaging.", shown:"Showing", of:"of",
    importedOrders:"Imported orders", onPage:"On this page", mode:"Mode", readOnly:"Read-only", noAtlasAutomation:"no Atlas automations",
    male:"Men", female:"Women", averageAge:"Average age", basedOn:"based on", ordersGenitive:"orders", noData:"no data",
    number:"Number", event:"Event", customer:"Customer", tickets:"Tickets", amount:"Amount", status:"Status",
    noNumber:"No number", importedCustomer:"Imported customer", customersSuffix:"customers", withoutPhone:"no phone", entered:"entered", cancelled:"cancelled", noImported:"No imported orders yet.", noOrders:"No orders yet.",
    back:"Back", next:"Next", page:"Page", pagesAria:"Order pages", importedPagesAria:"Imported order pages",
    gender:{MALE:"Man",FEMALE:"Woman",UNKNOWN:"Not specified"}, years:"years",
    export:{externalOrder:"External order number",order:"Order number",event:"Event",eventDate:"Event date",customer:"Customer",phone:"Phone",email:"Email",uniqueCustomers:"Unique customers",tickets:"Tickets",entered:"Entered",cancelled:"Cancelled",amount:"Amount",type:"Type",importedAt:"Imported at",gender:"Gender",age:"Age",status:"Status",orderedAt:"Order date"}
  }
} as const satisfies Record<Locale, unknown>;
