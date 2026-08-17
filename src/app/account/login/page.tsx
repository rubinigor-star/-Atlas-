import { AtlasLogo } from "@/components/atlas-logo";
import { CustomerLoginForm } from "@/components/customer-login-form";
import { OfficeLanguageControl } from "@/app/office/login/office-login-branding";
import styles from "@/app/office/login/office-login.module.css";
import brandingStyles from "@/app/office/login/office-login-branding.module.css";

export default async function CustomerLoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const params = await searchParams;

  return <main className={styles.page}>
    <div className={brandingStyles.loginTopbar}>
      <AtlasLogo surface="dark" />
      <OfficeLanguageControl />
    </div>

    <div className={styles.cardFrame}>
      <section className={styles.card}>
        <CustomerLoginForm expired={params.error === "expired"} />
      </section>
    </div>
  </main>;
}
