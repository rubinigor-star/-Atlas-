import { AdminShell } from "@/components/admin-shell";
import { OrganizerTermsForm } from "@/components/organizer-terms-form";
import { requirePermission } from "@/lib/auth";
import { getOrganizerTerms } from "@/lib/commercial-terms";

export const dynamic="force-dynamic";

export default async function OrganizerCompanyPage(){
  const staff=await requirePermission("FINANCE_VIEW");
  const organizationId=staff.organizationId!;
  const terms=await getOrganizerTerms(organizationId);
  return <AdminShell>
    <div className="office-page-heading"><div><span className="eyebrow">Компания и договор</span><h1>{staff.organization?.name}</h1><p>Твои действующие условия работы с Atlas. Комиссию и базовые правила назначает суперадминистратор платформы.</p></div><span className="pill">Организатор</span></div>
    <div className="stats"><div className="stat"><span className="muted">Роль</span><strong style={{fontSize:20}}>Владелец кабинета</strong></div><div className="stat"><span className="muted">Статус договора</span><strong style={{fontSize:20}}>Не загружен</strong><small>Тестовый режим</small></div><div className="stat"><span className="muted">Организация</span><strong style={{fontSize:20}}>{staff.organization?.name}</strong></div></div>
    <OrganizerTermsForm organizationId={organizationId} readOnly initial={{salesFeePercentBps:terms.salesFeePercentBps,salesFeeFixedMinor:terms.salesFeeFixedMinor,serviceFeePayer:terms.serviceFeePayer,refundsEnabled:terms.refundsEnabled,refundFeePercentBps:terms.refundFeePercentBps,refundFeeFixedMinor:terms.refundFeeFixedMinor,refundDeadlineHours:terms.refundDeadlineHours,transferRefundWindowDays:terms.transferRefundWindowDays}}/>
    <div className="platform-section-card"><span className="eyebrow">Договоры</span><h2>Документы компании</h2><p className="muted">После загрузки договора здесь будут доступны подписанный документ, приложения и банковские реквизиты. Организатор сможет просматривать и скачивать актуальные версии.</p><div className="toast">Документы ещё не загружены суперадминистратором.</div></div>
  </AdminShell>;
}
