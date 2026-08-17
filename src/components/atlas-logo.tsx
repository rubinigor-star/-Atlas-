import Link from "next/link";

type AtlasLogoProps = {
  href?: string;
  office?: boolean;
  dark?: boolean;
};

export function AtlasLogo({ href = "/", office = false, dark = false }: AtlasLogoProps) {
  const useDarkLogo = dark || office;

  return (
    <Link
      href={href}
      className={`atlas-logo${office ? " atlas-logo-office" : ""}${useDarkLogo ? " atlas-logo-dark" : " atlas-logo-adaptive"}`}
      aria-label="Atlas One - главная"
    >
      <span className="atlas-logo-image" aria-hidden="true" />
      {office && <small>OFFICE</small>}
    </Link>
  );
}
