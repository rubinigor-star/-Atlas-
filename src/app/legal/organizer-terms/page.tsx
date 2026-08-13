import Link from "next/link";
import { AtlasLogo } from "@/components/atlas-logo";
import { ORGANIZER_AGREEMENT_EFFECTIVE_DATE, ORGANIZER_AGREEMENT_SECTIONS, ORGANIZER_AGREEMENT_VERSION } from "@/lib/organizer-agreement";

export const metadata = { title: "Условия для организаторов | Atlas One" };

export default function OrganizerTermsPage() {
  return <main className="container" style={{maxWidth:900,paddingTop:40,paddingBottom:80}}>
    <div className="panel" style={{padding:32}}>
      <AtlasLogo office />
      <div style={{marginTop:24}}><span className="eyebrow">Юридическая информация</span><h1>Условия использования для организаторов</h1><p className="muted">Редакция от {ORGANIZER_AGREEMENT_EFFECTIVE_DATE} · версия {ORGANIZER_AGREEMENT_VERSION}</p></div>
      <div className="form" style={{lineHeight:1.65}}>
        {ORGANIZER_AGREEMENT_SECTIONS.map(section=><section key={section.title}><h2>{section.title}</h2><p>{section.body}</p></section>)}
      </div>
      <div className="row" style={{marginTop:28,flexWrap:"wrap"}}><Link className="btn dark" href="/office/register">Вернуться к регистрации</Link><Link className="btn secondary" href="/legal/privacy">Политика конфиденциальности</Link></div>
    </div>
  </main>;
}
