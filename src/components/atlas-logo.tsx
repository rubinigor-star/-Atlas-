import Image from "next/image";
import Link from "next/link";

export function AtlasLogo({ href = "/", office = false }: { href?: string; office?: boolean }) {
  return (
    <Link href={href} className={`atlas-logo${office ? " atlas-logo-office" : ""}`} aria-label="Atlas One — главная">
      <Image
        src="/atlas-one-logo.svg"
        alt="Atlas One"
        width={904}
        height={257}
        className="atlas-logo-image"
      />
      {office && <small>OFFICE</small>}
    </Link>
  );
}
