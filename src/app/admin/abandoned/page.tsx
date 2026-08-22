import Link from "next/link";
import { AdminShell } from "@/components/admin-shell";
import { AbandonedTable } from "@/components/abandoned-table";
import { requirePermission } from "@/lib/auth";
import { money } from "@/lib/format";
import { recoveryDashboard } from "@/lib/abandoned-checkout";
import { refreshAbandonedCheckoutStatuses } from "@/lib/abandoned-maintenance";
import { cleanupFalseRecoveredCheckouts, getAbandonedPromoterSources } from "@/lib/abandoned-order-attribution";
import { localeTag, resolveStaffLocale } from "@/lib/i18n";
import { officeAbandonedMessages } from "@/lib/office-abandoned-i18n";

export const dynamic = "force-dynamic";

function number(value: bigint | number) { return Number(value || 0); }

export default async function AbandonedSalesPage() {
  const staff = await requirePermission("ANALYTICS_VIEW");
  await refreshAbandonedCheckoutStatuses();
  await cleanupFalseRecoveredCheckouts();

  const locale = resolveStaffLocale({
    memberOverride: staff.interfaceLocaleOverride,
    userPreference: staff.preferredLocale,
    organizationDefault: staff.organization?.defaultStaffLocale,
  });
  const t = officeAbandonedMessages[locale];

  const stageLabel = (stage: string) => {
    if (stage === "PAYMENT_STARTED") return t.stage.paymentStarted;
    if (stage === "CONTACTS_ENTERED") return t.stage.contactsEntered;
    return t.stage.checkoutOpened;
  };

  const statusInfo = (status: string, abandonedAt: Date | null, action: string | null, stage: string) => {
    if (status === "RECOVERED") return { label: t.status.recovered, tone: "recovered" as const };
    if (status === "OPTED_OUT") return { label: t.status.optedOut, tone: "neutral" as const };
    if (status === "STOPPED") return { label: t.status.stopped, tone: "neutral" as const };
    if (action === "SENT") return { label: t.status.emailSent, tone: "sent" as const };
    if (action === "FAILED") return { label: t.status.sendFailed, tone: "failed" as const };
    if (action === "SKIPPED") return { label: t.status.channelUnavailable, tone: "neutral" as const };
    if (abandonedAt) return { label: t.status.lostSale, tone: "lost" as const };
    if (stage === "PAYMENT_STARTED") return { label: t.status.paymentPage, tone: "payment" as const };
    return { label: t.status.checkingOut, tone: "live" as const };
  };

  const allowedEventIds = staff.eventAccess.map(item => item.eventId);
  const data = await recoveryDashboard(staff.organizationId!, allowedEventIds.length ? allowedEventIds : undefined);
  const sources = await getAbandonedPromoterSources(data.recent.map(item => item.id));
  const sourceByCheckout = new Map(sources.map(source => [source.checkoutId, source]));
  const active = number(data.totals.activeCount);
  const recovered = number(data.totals.recoveredCount);
  const live = number(data.totals.inProgressCount);
  const totalFinished = active + recovered;
  const recoveryRate = totalFinished ? Math.round(recovered / totalFinished * 100) : 0;
  const formatter = new Intl.DateTimeFormat(localeTag(locale), { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Jerusalem" });

  const items = data.recent.map(item => {
    const status = statusInfo(item.status, item.abandonedAt, item.actionStatus, item.stage);
    const source = sourceByCheckout.get(item.id);
    return {
      id: item.id,
      customerName: [item.customerFirstName, item.customerLastName].filter(Boolean).join(" ") || t.customer.unknownName,
      customerContact: item.customerEmail || item.customerPhone || t.customer.noContact,
      eventTitle: item.eventTitle,
      sourceLabel: source ? t.customer.promoterSource(source.promoterName) : t.customer.directSource,
      stageLabel: stageLabel(item.stage),
      amountLabel: money(item.amountMinor),
      activityLabel: formatter.format(new Date(item.lastActivityAt)),
      statusLabel: status.label,
      statusTone: status.tone,
    };
  });

  return <AdminShell>
    <div className="office-page-heading">
      <div>
        <span className="eyebrow">{t.page.eyebrow}</span>
        <h1>{t.page.title}</h1>
        <p>{t.page.description}</p>
      </div>
      <Link href="/office/abandoned/settings" prefetch={false} className="btn">{t.page.settings}</Link>
    </div>

    <div className="stats">
      <div className="stat"><span className="muted">{t.page.checkingOutNow}</span><strong>{live}</strong></div>
      <div className="stat"><span className="muted">{t.page.lostPurchases}</span><strong>{active}</strong></div>
      <div className="stat"><span className="muted">{t.page.potentialRevenue}</span><strong>{money(number(data.totals.potentialMinor))}</strong></div>
      <div className="stat"><span className="muted">{t.page.recovered}</span><strong>{recovered}</strong><small>{money(number(data.totals.recoveredMinor))}</small></div>
      <div className="stat"><span className="muted">{t.page.recoveryRate}</span><strong>{recoveryRate}%</strong></div>
    </div>

    <div className="panel" style={{ marginTop: 24 }}>
      <div className="row between">
        <div><span className="eyebrow">{t.page.automation}</span><h2 style={{ marginBottom: 4 }}>{t.page.currentScenario}</h2></div>
        <span className="pill" style={{ background: "#dcfae6", color: "#067647" }}>{t.page.active}</span>
      </div>
      <div className="row" style={{ flexWrap: "wrap", gap: 10, marginTop: 16 }}>
        <div className="stat"><span className="muted">{t.page.firstDelay}</span><strong style={{ fontSize: 18 }}>{t.page.firstEmail}</strong></div>
        <span style={{ fontSize: 24 }}>→</span>
        <div className="stat"><span className="muted">{t.page.secondDelay}</span><strong style={{ fontSize: 18 }}>{t.page.finalEmail}</strong></div>
        <span style={{ fontSize: 24 }}>→</span>
        <div className="stat"><span className="muted">{t.page.afterPaymentOrStop}</span><strong style={{ fontSize: 18 }}>{t.page.scenarioClosed}</strong></div>
      </div>
      <p className="muted" style={{ marginBottom: 0 }}>{t.page.scenarioHint}</p>
    </div>

    <div className="row between" style={{ marginTop: 30 }}>
      <h2 className="section-title">{t.page.recentActivity}</h2>
      <span className="muted">{t.page.rowOpensCustomer}</span>
    </div>
    <AbandonedTable items={items} />
  </AdminShell>;
}
