import Link from "next/link";

export function AtlasLogo({ href = "/", office = false }: { href?: string; office?: boolean }) {
  return (
    <Link href={href} className={`atlas-logo${office ? " atlas-logo-office" : ""}`} aria-label="Atlas One — главная">
      <span className="atlas-logo-word">ATL<b>AS</b></span>
      <span className="atlas-logo-one"><i />ONE<i /></span>
      {office && <small>OFFICE</small>}
    </Link>
  );
}
