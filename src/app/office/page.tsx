import { redirect } from "next/navigation";
import { getCurrentStaff } from "@/lib/auth";

export const dynamic = "force-dynamic";

const LOGIN_PATH = "/office/login?next=%2Foffice";

export default async function OfficePage() {
  let staff: Awaited<ReturnType<typeof getCurrentStaff>> = null;

  try {
    staff = await getCurrentStaff();
  } catch {
    redirect(LOGIN_PATH);
  }

  if (!staff) redirect(LOGIN_PATH);

  const { default: AdminPage } = await import("@/app/admin/page");
  return <AdminPage />;
}
