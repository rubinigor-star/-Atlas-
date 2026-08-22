import type { StaffPermission, StaffRole } from "@prisma/client";
import type { Locale } from "@/lib/i18n";

export const permissionLabels: Record<StaffPermission, string> = {
  EVENT_VIEW: "Просмотр мероприятий",
  EVENT_MANAGE: "Создание и изменение мероприятий",
  TICKET_MANAGE: "Билеты, тарифы и схемы",
  REQUEST_REVIEW: "Одобрение и отклонение заявок",
  ORDER_VIEW: "Просмотр заказов",
  ORDER_MANAGE: "Изменение заказов и билетов",
  SCAN: "Сканирование билетов",
  ANALYTICS_VIEW: "Статистика продаж",
  TEAM_MANAGE: "Сотрудники и права",
  FINANCE_VIEW: "Финансовые отчёты",
};

export const roleLabels: Record<StaffRole, string> = {
  OWNER: "Владелец",
  ADMIN: "Администратор",
  EVENT_MANAGER: "Менеджер мероприятий",
  APPROVER: "Контроль заявок",
  CHECKIN: "Контроль входа",
  ANALYST: "Аналитик",
  CUSTOM: "Индивидуальные права",
};

export const permissionLabelsByLocale: Record<Locale, Record<StaffPermission, string>> = {
  ru: permissionLabels,
  he: {
    EVENT_VIEW: "צפייה באירועים",
    EVENT_MANAGE: "יצירה ועריכה של אירועים",
    TICKET_MANAGE: "כרטיסים, קטגוריות ומפות ישיבה",
    REQUEST_REVIEW: "אישור ודחייה של בקשות",
    ORDER_VIEW: "צפייה בהזמנות",
    ORDER_MANAGE: "ניהול הזמנות וכרטיסים",
    SCAN: "סריקת כרטיסים",
    ANALYTICS_VIEW: "נתוני מכירות",
    TEAM_MANAGE: "ניהול צוות והרשאות",
    FINANCE_VIEW: "דוחות כספיים",
  },
  en: {
    EVENT_VIEW: "View events",
    EVENT_MANAGE: "Create and edit events",
    TICKET_MANAGE: "Tickets, categories and seat maps",
    REQUEST_REVIEW: "Approve and reject requests",
    ORDER_VIEW: "View orders",
    ORDER_MANAGE: "Manage orders and tickets",
    SCAN: "Scan tickets",
    ANALYTICS_VIEW: "Sales analytics",
    TEAM_MANAGE: "Team and permissions",
    FINANCE_VIEW: "Financial reports",
  },
};

export const roleLabelsByLocale: Record<Locale, Record<StaffRole, string>> = {
  ru: roleLabels,
  he: {
    OWNER: "בעלים",
    ADMIN: "מנהל מערכת",
    EVENT_MANAGER: "מנהל אירועים",
    APPROVER: "אישור בקשות",
    CHECKIN: "בקרת כניסה",
    ANALYST: "אנליסט",
    CUSTOM: "הרשאות מותאמות",
  },
  en: {
    OWNER: "Owner",
    ADMIN: "Administrator",
    EVENT_MANAGER: "Event manager",
    APPROVER: "Request approver",
    CHECKIN: "Door staff",
    ANALYST: "Analyst",
    CUSTOM: "Custom permissions",
  },
};

export const allPermissions = Object.keys(permissionLabels) as StaffPermission[];

export const rolePermissions: Record<StaffRole, StaffPermission[]> = {
  OWNER: allPermissions,
  ADMIN: allPermissions,
  EVENT_MANAGER: ["EVENT_VIEW", "EVENT_MANAGE", "TICKET_MANAGE", "REQUEST_REVIEW", "ORDER_VIEW", "ORDER_MANAGE", "ANALYTICS_VIEW"],
  APPROVER: ["EVENT_VIEW", "REQUEST_REVIEW", "ORDER_VIEW"],
  CHECKIN: ["EVENT_VIEW", "SCAN"],
  ANALYST: ["EVENT_VIEW", "ORDER_VIEW", "ANALYTICS_VIEW", "FINANCE_VIEW"],
  CUSTOM: [],
};
