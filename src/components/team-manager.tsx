"use client";

import { useState } from "react";
import type { StaffPermission, StaffRole } from "@prisma/client";
import { Check, ChevronDown, Mail, Plus, ShieldCheck, Trash2, UserRoundCog } from "lucide-react";
import type { StaffEventScope } from "@/lib/auth";
import { localeNames, locales, type Locale } from "@/lib/i18n";
import { useLocale } from "@/components/locale-provider";

type Staff = {
  id: string;
  name: string;
  email: string;
  jobTitle: string | null;
  staffRole: StaffRole;
  interfaceLocaleOverride: string | null;
  active: boolean;
  permissions: StaffPermission[];
  eventIds: string[];
  eventScope: StaffEventScope;
  credentialExists: boolean;
};

type Props = {
  currentUserId: string;
  currentUserRole: StaffRole;
  organizationDefaultLocale: string;
  initialStaff: Staff[];
  events: { id: string; title: string }[];
  permissionLabels: Record<StaffPermission, string>;
  roleLabels: Record<StaffRole, string>;
  allPermissions: StaffPermission[];
  rolePermissions: Record<StaffRole, StaffPermission[]>;
};

const roles: StaffRole[] = ["ADMIN", "EVENT_MANAGER", "APPROVER", "CHECKIN", "ANALYST", "CUSTOM"];

const copy = {
  ru: {
    eyebrow: "Управление доступом", title: "Команда и права", intro: "Каждый сотрудник видит только разрешённые инструменты и мероприятия. Язык интерфейса не зависит от роли и прав.",
    organizationLanguage: "Язык команды по умолчанию", organizationLanguageHelp: "Используется в Atlas Office и мобильном приложении, если сотруднику не назначен другой язык.", savedDefault: "Язык команды по умолчанию сохранён.",
    employees: "сотрудников", team: "Рабочая команда", you: "Вы", active: "активен", inactive: "отключён", activated: "доступ активирован", waiting: "ждёт активации",
    accountActive: "Аккаунт активирован", passwordMissing: "Пароль ещё не создан", accessOn: "Доступ включён", accessOff: "Доступ отключён",
    ownerLocked: "Роль владельца нельзя изменить из управления командой. Передача владения должна быть отдельной защищённой операцией.", selfLocked: "Нельзя менять собственные права из текущей сессии.",
    role: "Роль", jobTitle: "Должность", interfaceLanguage: "Язык интерфейса", organizationDefault: "По умолчанию организации",
    permissions: "Разрешения", permissionHelp: "Шаблон роли задаёт стартовый набор. Ручное изменение переводит сотрудника в режим индивидуальных прав.",
    eventAccess: "Доступ к мероприятиям", eventHelp: "Можно разрешить работу со всеми мероприятиями или только с выбранными, не связывая язык с разрешениями.", scope: "Область доступа", all: "Все мероприятия", selected: "Только выбранные", none: "Нет доступа к мероприятиям",
    saving: "Сохраняем…", save: "Сохранить права", saved: "Права и язык сотрудника сохранены", reset: "Восстановление доступа", resend: "Повторить приглашение", remove: "Удалить сотрудника", removed: "Сотрудник удалён.",
    inviteEyebrow: "Новый сотрудник", inviteTitle: "Добавить сотрудника", inviteHelp: "После добавления назначьте сотруднику мероприятия и права. На email будет отправлена персональная ссылка для создания пароля.", name: "Имя", email: "Email", roleTemplate: "Шаблон роли", invite: "Добавить и пригласить", cancel: "Отмена",
    inviteSent: "Сотрудник добавлен. Приглашение отправлено по email.", invitePartial: "Сотрудник добавлен, но письмо не отправилось. Используйте повторную отправку.", invitationResent: "Приглашение повторно отправлено на email сотрудника.", resetSent: "Ссылка восстановления доступа отправлена на email сотрудника.", confirmDelete: "Удалить сотрудника {name}? Его доступ к Atlas будет полностью удалён.", genericError: "Не удалось выполнить действие",
  },
  he: {
    eyebrow: "ניהול הרשאות", title: "צוות והרשאות", intro: "כל עובד רואה רק את הכלים והאירועים שהוגדרו עבורו. שפת הממשק אינה תלויה בתפקיד או בהרשאות.",
    organizationLanguage: "שפת ברירת המחדל של הצוות", organizationLanguageHelp: "משמשת ב-Atlas Office ובאפליקציה, אלא אם הוגדרה לעובד שפה אחרת.", savedDefault: "שפת ברירת המחדל של הצוות נשמרה.",
    employees: "אנשי צוות", team: "צוות העבודה", you: "אתם", active: "פעיל", inactive: "מושבת", activated: "הגישה הופעלה", waiting: "ממתין להפעלה",
    accountActive: "החשבון פעיל", passwordMissing: "עדיין לא הוגדרה סיסמה", accessOn: "הגישה פעילה", accessOff: "הגישה מושבתת",
    ownerLocked: "לא ניתן לשנות כאן את תפקיד הבעלים. העברת בעלות מתבצעת בפעולה מאובטחת נפרדת.", selfLocked: "לא ניתן לשנות את ההרשאות של החשבון הנוכחי מתוך אותה התחברות.",
    role: "תפקיד", jobTitle: "תפקיד בארגון", interfaceLanguage: "שפת הממשק", organizationDefault: "ברירת המחדל של הארגון",
    permissions: "הרשאות", permissionHelp: "תבנית התפקיד קובעת הרשאות התחלתיות. שינוי ידני יעביר את העובד להרשאות מותאמות.",
    eventAccess: "גישה לאירועים", eventHelp: "אפשר לאפשר עבודה עם כל האירועים או רק עם אירועים נבחרים, בלי לקשור בין השפה להרשאות.", scope: "היקף הגישה", all: "כל האירועים", selected: "אירועים נבחרים בלבד", none: "ללא גישה לאירועים",
    saving: "שומרים…", save: "שמירת הרשאות", saved: "ההרשאות והשפה של העובד נשמרו", reset: "שחזור גישה", resend: "שליחת ההזמנה מחדש", remove: "מחיקת עובד", removed: "העובד נמחק.",
    inviteEyebrow: "עובד חדש", inviteTitle: "הוספת עובד", inviteHelp: "לאחר ההוספה תוכלו להגדיר אירועים והרשאות. קישור אישי ליצירת סיסמה יישלח במייל.", name: "שם", email: "אימייל", roleTemplate: "תבנית תפקיד", invite: "הוספה ושליחת הזמנה", cancel: "ביטול",
    inviteSent: "העובד נוסף וההזמנה נשלחה במייל.", invitePartial: "העובד נוסף, אך ההודעה לא נשלחה. אפשר לנסות לשלוח שוב.", invitationResent: "ההזמנה נשלחה שוב במייל.", resetSent: "קישור לשחזור הגישה נשלח במייל.", confirmDelete: "למחוק את {name}? הגישה ל-Atlas תוסר לחלוטין.", genericError: "לא ניתן להשלים את הפעולה",
  },
  en: {
    eyebrow: "Access control", title: "Team and permissions", intro: "Each employee sees only the tools and events assigned to them. Interface language is independent from roles and permissions.",
    organizationLanguage: "Default staff language", organizationLanguageHelp: "Used in Atlas Office and the mobile app unless an employee has a language override.", savedDefault: "Default staff language saved.",
    employees: "team members", team: "Work team", you: "You", active: "active", inactive: "disabled", activated: "access activated", waiting: "awaiting activation",
    accountActive: "Account activated", passwordMissing: "Password not created yet", accessOn: "Access enabled", accessOff: "Access disabled",
    ownerLocked: "The owner role cannot be changed here. Ownership transfer must be a separate protected operation.", selfLocked: "You cannot change your own permissions from the current session.",
    role: "Role", jobTitle: "Job title", interfaceLanguage: "Interface language", organizationDefault: "Organization default",
    permissions: "Permissions", permissionHelp: "The role template provides a starting set. Manual changes switch the employee to custom permissions.",
    eventAccess: "Event access", eventHelp: "Allow access to all events or selected events without tying language to permissions.", scope: "Access scope", all: "All events", selected: "Selected events only", none: "No event access",
    saving: "Saving…", save: "Save permissions", saved: "Employee permissions and language saved", reset: "Reset access", resend: "Resend invitation", remove: "Delete employee", removed: "Employee deleted.",
    inviteEyebrow: "New teammate", inviteTitle: "Add employee", inviteHelp: "After adding the employee, assign events and permissions. A personal password-setup link will be sent by email.", name: "Name", email: "Email", roleTemplate: "Role template", invite: "Add and invite", cancel: "Cancel",
    inviteSent: "Employee added. The invitation was sent by email.", invitePartial: "Employee added, but the email was not sent. Use resend invitation.", invitationResent: "The invitation was sent again by email.", resetSent: "The access recovery link was sent by email.", confirmDelete: "Delete {name}? Their Atlas access will be removed completely.", genericError: "Could not complete the action",
  },
} as const;

function localeFromValue(value: string | null | undefined): Locale {
  return value === "he" || value === "en" ? value : "ru";
}

export function TeamManager({
  currentUserId, currentUserRole, organizationDefaultLocale, initialStaff, events,
  permissionLabels, roleLabels, allPermissions, rolePermissions,
}: Props) {
  const { locale } = useLocale();
  const t = copy[locale];
  const [staff, setStaff] = useState(initialStaff);
  const [selectedId, setSelectedId] = useState(initialStaff[0]?.id ?? "");
  const [defaultLocale, setDefaultLocale] = useState<Locale>(localeFromValue(organizationDefaultLocale));
  const [showInvite, setShowInvite] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const selected = staff.find((member) => member.id === selectedId);
  const actorIsOwner = currentUserRole === "OWNER";
  const availableRoles = roles.filter((role) => actorIsOwner || role !== "ADMIN");
  const locked = selected ? selected.staffRole === "OWNER" || selected.id === currentUserId : false;

  function update(patch: Partial<Staff>) {
    setStaff((current) => current.map((member) => member.id === selectedId ? { ...member, ...patch } : member));
  }
  function changeRole(role: StaffRole) { update({ staffRole: role, permissions: role === "CUSTOM" ? [] : rolePermissions[role] }); }
  function togglePermission(permission: StaffPermission) {
    if (!selected) return;
    const permissions = selected.permissions.includes(permission) ? selected.permissions.filter((item) => item !== permission) : [...selected.permissions, permission];
    update({ staffRole: "CUSTOM", permissions });
  }

  async function save(member: Staff) {
    setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/office/team/${member.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ staffRole: member.staffRole, jobTitle: member.jobTitle, interfaceLocaleOverride: member.interfaceLocaleOverride, active: member.active, permissions: member.permissions, eventIds: member.eventIds, eventScope: member.eventScope }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || t.genericError);
      setMessage(t.saved);
    } catch (error) { setMessage(error instanceof Error ? error.message : t.genericError); } finally { setBusy(false); }
  }
  async function saveDefaultLocale(nextLocale: Locale) {
    const previous = defaultLocale; setDefaultLocale(nextLocale); setMessage("");
    try {
      const response = await fetch("/api/office/locale", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ mode: "organization", locale: nextLocale }) });
      if (!response.ok) throw new Error(t.genericError);
      setMessage(t.savedDefault);
    } catch (error) { setDefaultLocale(previous); setMessage(error instanceof Error ? error.message : t.genericError); }
  }
  async function invite(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage("");
    try {
      const form = new FormData(event.currentTarget);
      const response = await fetch("/api/office/team", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: form.get("name"), email: form.get("email"), jobTitle: form.get("jobTitle"), staffRole: form.get("staffRole"), interfaceLocaleOverride: form.get("interfaceLocaleOverride") || null }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || t.genericError);
      setStaff((current) => [...current, { ...data.staff, credentialExists: false }]); setSelectedId(data.staff.id); setShowInvite(false);
      setMessage(data.invitationSent ? t.inviteSent : t.invitePartial);
    } catch (error) { setMessage(error instanceof Error ? error.message : t.genericError); } finally { setBusy(false); }
  }
  async function resendAccess(member: Staff) {
    setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/office/team/${member.id}`, { method: "POST" }); const data = await response.json();
      if (!response.ok) throw new Error(data.error || t.genericError);
      setMessage(data.mode === "INVITE" ? t.invitationResent : t.resetSent);
    } catch (error) { setMessage(error instanceof Error ? error.message : t.genericError); } finally { setBusy(false); }
  }
  async function removeMember(member: Staff) {
    if (!window.confirm(t.confirmDelete.replace("{name}", member.name))) return;
    setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/office/team/${member.id}`, { method: "DELETE" }); const data = await response.json();
      if (!response.ok) throw new Error(data.error || t.genericError);
      const remaining = staff.filter((item) => item.id !== member.id); setStaff(remaining); setSelectedId(remaining[0]?.id ?? ""); setMessage(t.removed);
    } catch (error) { setMessage(error instanceof Error ? error.message : t.genericError); } finally { setBusy(false); }
  }

  return <>
    <div className="office-page-heading"><div><span className="eyebrow">{t.eyebrow}</span><h1>{t.title}</h1><p>{t.intro}</p></div></div>
    <section className="panel form" style={{ marginBottom: 18 }}><label className="field"><span>{t.organizationLanguage}</span><select value={defaultLocale} onChange={(event) => void saveDefaultLocale(event.target.value as Locale)}>{locales.map((item) => <option key={item} value={item}>{localeNames[item]}</option>)}</select><small className="muted">{t.organizationLanguageHelp}</small></label></section>
    <div className="team-layout">
      <section className="team-list">
        <div className="team-list-head"><div><strong>{staff.length} {t.employees}</strong><small>{t.team}</small></div><button type="button" aria-label={t.inviteTitle} onClick={() => setShowInvite(true)}><Plus size={18}/></button></div>
        {staff.map((member) => <button type="button" key={member.id} className={member.id === selectedId ? "active" : ""} onClick={() => { setSelectedId(member.id); setMessage(""); }}><span className="team-avatar">{member.name.split(" ").map((part) => part[0]).slice(0, 2).join("")}</span><div><strong>{member.name}{member.id === currentUserId && <i>{t.you}</i>}</strong><small>{roleLabels[member.staffRole]} · {member.active ? t.active : t.inactive} · {member.credentialExists ? t.activated : t.waiting}</small></div><ChevronDown size={17}/></button>)}
      </section>
      {selected && <section className="team-editor">
        <header><div className="team-avatar large">{selected.name.split(" ").map((part) => part[0]).slice(0, 2).join("")}</div><div><h2>{selected.name}</h2><span dir="ltr">{selected.email}</span><small className="muted">{selected.credentialExists ? t.accountActive : t.passwordMissing}</small></div><label className="active-switch"><input type="checkbox" checked={selected.active} disabled={locked} onChange={(event) => update({ active: event.target.checked })}/><span/>{selected.active ? t.accessOn : t.accessOff}</label></header>
        {locked && <div className="toast">{selected.staffRole === "OWNER" ? t.ownerLocked : t.selfLocked}</div>}
        <div className="team-form-grid">
          <label className="field"><span>{t.role}</span><select value={selected.staffRole} disabled={locked} onChange={(event) => changeRole(event.target.value as StaffRole)}>{selected.staffRole === "OWNER" && <option value="OWNER">{roleLabels.OWNER}</option>}{availableRoles.map((role) => <option key={role} value={role}>{roleLabels[role]}</option>)}</select></label>
          <label className="field"><span>{t.jobTitle}</span><input className="input" value={selected.jobTitle ?? ""} disabled={locked} onChange={(event) => update({ jobTitle: event.target.value })}/></label>
          <label className="field"><span>{t.interfaceLanguage}</span><select value={selected.interfaceLocaleOverride ?? ""} disabled={locked} onChange={(event) => update({ interfaceLocaleOverride: event.target.value || null })}><option value="">{t.organizationDefault} ({localeNames[defaultLocale]})</option>{locales.map((item) => <option key={item} value={item}>{localeNames[item]}</option>)}</select></label>
        </div>
        <div className="permission-heading"><div><ShieldCheck/><h3>{t.permissions}</h3></div><p>{t.permissionHelp}</p></div>
        <div className="permission-grid">{allPermissions.map((permission) => { const checked = selected.permissions.includes(permission); const disabled = locked || (!actorIsOwner && permission === "TEAM_MANAGE"); return <button type="button" key={permission} className={checked ? "checked" : ""} disabled={disabled} aria-pressed={checked} onClick={() => togglePermission(permission)}><i>{checked && <Check size={14}/>}</i><span>{permissionLabels[permission]}</span></button>; })}</div>
        <div className="permission-heading"><div><UserRoundCog/><h3>{t.eventAccess}</h3></div><p>{t.eventHelp}</p></div>
        <label className="field"><span>{t.scope}</span><select value={selected.eventScope} disabled={locked} onChange={(event) => update({ eventScope: event.target.value as StaffEventScope, eventIds: event.target.value === "SELECTED" ? selected.eventIds : [] })}><option value="ALL">{t.all}</option><option value="SELECTED">{t.selected}</option><option value="NONE">{t.none}</option></select></label>
        {selected.eventScope === "SELECTED" && <div className="event-access-list">{events.map((event) => <label key={event.id}><input type="checkbox" disabled={locked} checked={selected.eventIds.includes(event.id)} onChange={() => update({ eventIds: selected.eventIds.includes(event.id) ? selected.eventIds.filter((id) => id !== event.id) : [...selected.eventIds, event.id] })}/><span>{event.title}</span></label>)}</div>}
        {message && <div className="toast" role="status">{message}</div>}
        <div className="row" style={{ flexWrap: "wrap" }}><button className="btn" disabled={busy || locked} onClick={() => void save(selected)}>{busy ? t.saving : t.save}</button><button className="btn secondary" type="button" disabled={busy || locked || !selected.active} onClick={() => void resendAccess(selected)}><Mail size={16}/>{selected.credentialExists ? t.reset : t.resend}</button><button className="btn secondary" type="button" disabled={busy || locked} onClick={() => void removeMember(selected)} style={{ color: "#b42318" }}><Trash2 size={16}/>{t.remove}</button></div>
      </section>}
      {showInvite && <div className="office-modal" onClick={() => setShowInvite(false)}><form className="panel form" onSubmit={invite} onClick={(event) => event.stopPropagation()}><span className="eyebrow">{t.inviteEyebrow}</span><h2>{t.inviteTitle}</h2><p className="muted">{t.inviteHelp}</p><label className="field"><span>{t.name}</span><input className="input" name="name" required/></label><label className="field"><span>{t.email}</span><input className="input" name="email" type="email" required dir="ltr"/></label><label className="field"><span>{t.jobTitle}</span><input className="input" name="jobTitle"/></label><label className="field"><span>{t.roleTemplate}</span><select name="staffRole" defaultValue="CHECKIN">{availableRoles.map((role) => <option key={role} value={role}>{roleLabels[role]}</option>)}</select></label><label className="field"><span>{t.interfaceLanguage}</span><select name="interfaceLocaleOverride" defaultValue=""><option value="">{t.organizationDefault} ({localeNames[defaultLocale]})</option>{locales.map((item) => <option key={item} value={item}>{localeNames[item]}</option>)}</select></label><div className="row"><button className="btn" disabled={busy}>{t.invite}</button><button type="button" className="btn secondary" onClick={() => setShowInvite(false)}>{t.cancel}</button></div></form></div>}
    </div>
  </>;
}
