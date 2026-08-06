import { redirect } from "next/navigation";
import { requirePlatformAdmin } from "@/lib/auth";
import { SmsTestPanel } from "@/components/sms-test-panel";

export const dynamic = "force-dynamic";

export default async function SmsTestPage() {
  try {
    await requirePlatformAdmin();
  } catch {
    redirect("/office/login");
  }

  return <SmsTestPanel initialPhone="0547997275" />;
}
