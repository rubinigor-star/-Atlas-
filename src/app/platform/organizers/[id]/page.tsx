import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AdminShell } from "@/components/admin-shell";
import { OrganizerTermsForm } from "@/components/organizer-terms-form";
import { getCurrentStaff } from "@/lib/auth";
import { getOrganizerTerms } from "@/lib/commercial-terms";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function OrganizerCommercialCard({ params }: { params: Promise<{ id: string }> }) {
  const actor = await getCurrentStaff();
  if (!actor) redirect("/office/login");
  if (actor.role !== "ADMIN") redirect("/office");
  const { id } = await params;
  const organization = await db.organization.findUnique({ where: { id }, include: { _count: { select: { users: true, events: true } } } });
  if (!organization) notFound();
  const terms = await getOrganizerTerms(id);
  return <AdminShell>
    <div className="row between"><div><span className="eyebrow">Карточка организатора</span><h1>{organization.name}</h1></div><Link className="btn secondary" href="/platform/organizers">Все организаторы</Link></div>
    <div className="stats"><div className="stat"><span className="muted">Пользователей</span><strong>{organization._count.users}</strong></div><div className="stat"><span className="muted">Мероприятий</span><strong>{organization._count.events}</strong></div><div className="stat"><span className="muted">Статус</span><strong>Активен</strong></div></div>
    <OrganizerTermsForm organizationId={id} initial={{ salesFeePercentBps: terms.salesFeePercentBps, salesFeeFixedMinor: terms.salesFeeFixedMinor, serviceFeePayer: terms.serviceFeePayer, refundsEnabled: terms.refundsEnabled, refundFeePercentBps: terms.refundFeePercentBps, refundFeeFixedMinor: terms.refundFeeFixedMinor, refundDeadlineHours: terms.refundDeadlineHours, transferRefundWindowDays: terms.transferRefundWindowDays }} />
  </AdminShell>;
}
