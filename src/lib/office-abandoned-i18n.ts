import type { Locale } from "@/lib/i18n";

export type OfficeAbandonedMessages = {
  stage: {
    paymentStarted: string;
    contactsEntered: string;
    checkoutOpened: string;
  };
  status: {
    recovered: string;
    optedOut: string;
    stopped: string;
    emailSent: string;
    sendFailed: string;
    channelUnavailable: string;
    lostSale: string;
    paymentPage: string;
    checkingOut: string;
  };
  customer: {
    unknownName: string;
    noContact: string;
    promoterSource: (name: string) => string;
    directSource: string;
  };
  page: {
    eyebrow: string;
    title: string;
    description: string;
    settings: string;
    checkingOutNow: string;
    lostPurchases: string;
    potentialRevenue: string;
    recovered: string;
    recoveryRate: string;
    automation: string;
    currentScenario: string;
    active: string;
    firstDelay: string;
    firstEmail: string;
    secondDelay: string;
    finalEmail: string;
    afterPaymentOrStop: string;
    scenarioClosed: string;
    scenarioHint: string;
    recentActivity: string;
    rowOpensCustomer: string;
  };
  table: {
    customer: string;
    event: string;
    source: string;
    stage: string;
    amount: string;
    lastActivity: string;
    status: string;
    empty: string;
  };
};

export const officeAbandonedMessages: Record<Locale, OfficeAbandonedMessages> = {
  ru: {
    stage: {
      paymentStarted: "Перешёл к оплате",
      contactsEntered: "Оставил контакты",
      checkoutOpened: "Открыл оформление",
    },
    status: {
      recovered: "Восстановлено",
      optedOut: "Клиент отказался",
      stopped: "Напоминания остановлены",
      emailSent: "Email отправлен",
      sendFailed: "Ошибка отправки",
      channelUnavailable: "Канал недоступен",
      lostSale: "Потерянная продажа",
      paymentPage: "На странице оплаты",
      checkingOut: "Сейчас оформляет",
    },
    customer: {
      unknownName: "Не представился",
      noContact: "Контакт не оставлен",
      promoterSource: (name) => `Промоутер · ${name}`,
      directSource: "Прямой / другой источник",
    },
    page: {
      eyebrow: "Recovery Center",
      title: "Потерянные продажи",
      description: "Текущие оформления, брошенные покупки и восстановленная выручка по каждому мероприятию.",
      settings: "Настроить сценарий",
      checkingOutNow: "Сейчас оформляют",
      lostPurchases: "Потерянные покупки",
      potentialRevenue: "Потенциальная выручка",
      recovered: "Восстановлено",
      recoveryRate: "Конверсия восстановления",
      automation: "Автоматизация",
      currentScenario: "Текущий сценарий",
      active: "Активен",
      firstDelay: "По настроенному таймеру без активности",
      firstEmail: "Первый Email",
      secondDelay: "По второй задержке",
      finalEmail: "Финальный Email",
      afterPaymentOrStop: "После оплаты или ручной остановки",
      scenarioClosed: "Сценарий закрывается",
      scenarioHint: "Нажмите «Настроить сценарий», чтобы изменить задержки или временно отключить автоматические письма.",
      recentActivity: "Последняя активность клиентов",
      rowOpensCustomer: "Вся строка открывает карточку клиента",
    },
    table: {
      customer: "Клиент",
      event: "Мероприятие",
      source: "Источник",
      stage: "Этап",
      amount: "Сумма",
      lastActivity: "Последняя активность",
      status: "Статус",
      empty: "Пока нет активных или незавершённых покупок.",
    },
  },
  he: {
    stage: {
      paymentStarted: "עבר לתשלום",
      contactsEntered: "השאיר פרטי קשר",
      checkoutOpened: "פתח את תהליך הרכישה",
    },
    status: {
      recovered: "שוחזרה",
      optedOut: "הלקוח ביקש להפסיק",
      stopped: "התזכורות הופסקו",
      emailSent: "האימייל נשלח",
      sendFailed: "שליחת האימייל נכשלה",
      channelUnavailable: "ערוץ התקשורת אינו זמין",
      lostSale: "מכירה שננטשה",
      paymentPage: "בעמוד התשלום",
      checkingOut: "בתהליך רכישה",
    },
    customer: {
      unknownName: "ללא שם",
      noContact: "לא הושארו פרטי קשר",
      promoterSource: (name) => `יחצן · ${name}`,
      directSource: "ישיר / מקור אחר",
    },
    page: {
      eyebrow: "Recovery Center",
      title: "מכירות שננטשו",
      description: "רכישות שנמצאות בתהליך, רכישות שננטשו והכנסות ששוחזרו - לפי אירוע.",
      settings: "הגדרת תהליך השחזור",
      checkingOutNow: "בתהליך רכישה עכשיו",
      lostPurchases: "רכישות שננטשו",
      potentialRevenue: "הכנסה פוטנציאלית",
      recovered: "שוחזרו",
      recoveryRate: "שיעור שחזור",
      automation: "אוטומציה",
      currentScenario: "תהליך פעיל",
      active: "פעיל",
      firstDelay: "לאחר פרק הזמן שהוגדר ללא פעילות",
      firstEmail: "אימייל ראשון",
      secondDelay: "לאחר ההמתנה השנייה",
      finalEmail: "אימייל אחרון",
      afterPaymentOrStop: "לאחר תשלום או עצירה ידנית",
      scenarioClosed: "התהליך נסגר",
      scenarioHint: "לחצו על „הגדרת תהליך השחזור” כדי לשנות את זמני ההמתנה או להשהות זמנית את שליחת האימיילים האוטומטיים.",
      recentActivity: "פעילות לקוחות אחרונה",
      rowOpensCustomer: "לחיצה על שורה פותחת את כרטיס הלקוח",
    },
    table: {
      customer: "לקוח",
      event: "אירוע",
      source: "מקור",
      stage: "שלב",
      amount: "סכום",
      lastActivity: "פעילות אחרונה",
      status: "סטטוס",
      empty: "אין כרגע רכישות פעילות או רכישות שלא הושלמו.",
    },
  },
  en: {
    stage: {
      paymentStarted: "Went to payment",
      contactsEntered: "Entered contact details",
      checkoutOpened: "Opened checkout",
    },
    status: {
      recovered: "Recovered",
      optedOut: "Customer opted out",
      stopped: "Reminders stopped",
      emailSent: "Email sent",
      sendFailed: "Sending failed",
      channelUnavailable: "Channel unavailable",
      lostSale: "Abandoned sale",
      paymentPage: "On payment page",
      checkingOut: "Checking out now",
    },
    customer: {
      unknownName: "Name not provided",
      noContact: "No contact details provided",
      promoterSource: (name) => `Promoter · ${name}`,
      directSource: "Direct / other source",
    },
    page: {
      eyebrow: "Recovery Center",
      title: "Abandoned sales",
      description: "Live checkouts, abandoned purchases and recovered revenue for each event.",
      settings: "Configure recovery",
      checkingOutNow: "Checking out now",
      lostPurchases: "Abandoned purchases",
      potentialRevenue: "Potential revenue",
      recovered: "Recovered",
      recoveryRate: "Recovery rate",
      automation: "Automation",
      currentScenario: "Current recovery flow",
      active: "Active",
      firstDelay: "After the configured inactivity timer",
      firstEmail: "First email",
      secondDelay: "After the second delay",
      finalEmail: "Final email",
      afterPaymentOrStop: "After payment or manual stop",
      scenarioClosed: "Recovery flow closes",
      scenarioHint: "Select “Configure recovery” to change the delays or temporarily disable automatic emails.",
      recentActivity: "Recent customer activity",
      rowOpensCustomer: "Select a row to open the customer record",
    },
    table: {
      customer: "Customer",
      event: "Event",
      source: "Source",
      stage: "Stage",
      amount: "Amount",
      lastActivity: "Last activity",
      status: "Status",
      empty: "There are no active or incomplete purchases yet.",
    },
  },
};
