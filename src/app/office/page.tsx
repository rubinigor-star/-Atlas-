import { redirect } from "next/navigation";
import AdminPage from "@/app/admin/page";
import { getCurrentStaff } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function OfficePage() {
  const staff = await getCurrentStaff();
  if (!staff) redirect("/office/login");

  return <AdminPage />;
}
