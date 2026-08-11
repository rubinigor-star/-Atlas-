"use client";

import { useRouter } from "next/navigation";

type Item = {
  id: string;
  customerName: string;
  customerContact: string;
  eventTitle: string;
  sourceLabel: string;
  stageLabel: string;
  amountLabel: string;
  activityLabel: string;
  statusLabel: string;
  statusTone: "live" | "payment" | "lost" | "sent" | "failed" | "recovered" | "neutral";
};

const toneStyle: Record<Item["statusTone"], React.CSSProperties> = {
  live: { background: "#e8f7ee", color: "#18794e" },
  payment: { background: "#e8f1ff", color: "#175cd3" },
  lost: { background: "#fff0ed", color: "#c4320a" },
  sent: { background: "#f3e8ff", color: "#7e22ce" },
  failed: { background: "#fee4e2", color: "#b42318" },
  recovered: { background: "#dcfae6", color: "#067647" },
  neutral: { background: "#f2f4f7", color: "#344054" },
};

export function AbandonedTable({ items }: { items: Item[] }) {
  const router = useRouter();
  return <div className="table-wrap"><table><thead><tr><th>Клиент</th><th>Мероприятие</th><th>Источник</th><th>Этап</th><th>Сумма</th><th>Последняя активность</th><th>Статус</th></tr></thead><tbody>
    {items.map(item => <tr key={item.id} tabIndex={0} role="link" onClick={() => router.push(`/office/abandoned/${item.id}`)} onKeyDown={event => { if (event.key === "Enter" || event.key === " ") router.push(`/office/abandoned/${item.id}`); }} style={{cursor:"pointer"}}>
      <td><strong>{item.customerName}</strong><br/><small>{item.customerContact}</small></td>
      <td>{item.eventTitle}</td><td>{item.sourceLabel}</td><td>{item.stageLabel}</td><td>{item.amountLabel}</td><td>{item.activityLabel}</td>
      <td><span className="pill" style={toneStyle[item.statusTone]}>{item.statusLabel}</span></td>
    </tr>)}
    {!items.length && <tr><td colSpan={7}>Пока нет активных или незавершённых покупок.</td></tr>}
  </tbody></table></div>;
}
