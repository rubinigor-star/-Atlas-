"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const concepts = [
  { key: "a", label: "A", title: "Balanced" },
  { key: "b", label: "B", title: "Event First" },
  { key: "c", label: "C", title: "Mission Control" },
  { key: "d", label: "D", title: "Minimal" },
] as const;

export function ConceptSwitcher() {
  const pathname = usePathname();

  return <section style={{
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14,
    marginBottom: 22,
    padding: "12px 14px",
    border: "1px solid #dfe5ed",
    borderRadius: 16,
    background: "#fff",
    flexWrap: "wrap",
  }}>
    <div style={{display:"grid", gap:2}}>
      <strong style={{fontSize:13}}>Сравнение интерфейсов</strong>
      <small style={{color:"#7b8798"}}>Нажмите A, B, C или D, чтобы сменить концепт</small>
    </div>
    <nav aria-label="Варианты интерфейса" style={{display:"flex", gap:7, flexWrap:"wrap"}}>
      {concepts.map(concept => {
        const href = `/office/concepts/${concept.key}`;
        const active = pathname === href;
        return <Link
          key={concept.key}
          href={href}
          title={concept.title}
          aria-current={active ? "page" : undefined}
          style={{
            minWidth: 44,
            height: 40,
            padding: "0 13px",
            borderRadius: 11,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 7,
            background: active ? "#07172e" : "#f2f5f8",
            color: active ? "#fff" : "#07172e",
            border: active ? "1px solid #07172e" : "1px solid #dfe5ed",
            fontWeight: 900,
            textDecoration: "none",
          }}
        >
          <span>{concept.label}</span>
          <small style={{fontWeight:700, opacity:.72}}>{concept.title}</small>
        </Link>;
      })}
    </nav>
  </section>;
}
