import type { StaffPermission, StaffRole } from "@prisma/client";

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
