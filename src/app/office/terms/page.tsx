import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin-shell";
import { OrganizerTermsForm } from "@/components/organizer-terms-form";
import { getCurrentStaff } from "@/lib/auth";
import { getOrganizerTerms } from "@/lib/commercial-terms";

export const dynamic = "force-dynamic";

export default async function OrganizerTermsPage() {
  const staff = await getCurrentStaff();
  if (!staff) redirect("/office/login");
  if (!staff.organizationId) redirect("/office");
  const terms = await getOrganizerTerms(staff.organizationId);
  return <AdminShell>
    <span className="eyebrow">Финансы</span><h1>Мои условия</h1>
    <p className="muted">Здесь всегда отображаются действующие базовые условия Atlas. Изменение условий выполняется администрацией Atlas.</p>
    <OrganizerTermsForm readOnly organizationId={staff.organizationId} initial={{ salesFeePercentBps: terms.salesFeePercentBps, salesFeeFixedMinor: terms.salesFeeFixedMinor, serviceFeePayer: terms.serviceFeePayer, refundsEnabled: terms.refundsEnabled, refundFeePercentBps: terms.refundFeePercentBps, refundFeeFixedMinor: terms.refundFeeFixedMinor, refundDeadlineHours: terms.refundDeadlineHours, transferRefundWindowDays: terms.transferRefundWindowDays }} />
    <div className="card"><h2>Есть вопрос по условиям?</h2><p className="muted">Обратитесь в поддержку Atlas и укажите название организации. История изменений сохраняется в системе.</p></div>
  </AdminShell>;
}
