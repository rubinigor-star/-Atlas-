import Link from "next/link";

export function AdminShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="dashboard">
      <aside className="sidebar">
        <Link href="/admin"><strong>Обзор</strong></Link>
        <Link href="/admin/requests">Заявки на вход</Link>
        <Link href="/admin/events/new">Создать событие</Link>
        <Link href="/admin/orders">Заказы</Link>
        <Link href="/scanner">Сканер</Link>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
