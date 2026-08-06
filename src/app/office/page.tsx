import { redirect } from "next/navigation";
import AdminPage from "@/app/admin/page";
import { getCurrentStaff } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function OfficePage() {
  let staff: Awaited<ReturnType<typeof getCurrentStaff>> = null;

  try {
    staff = await getCurrentStaff();
  } catch {
    redirect("/office/login");
  }

  if (!staff) redirect("/office/login");

  return <AdminPage />;
}
