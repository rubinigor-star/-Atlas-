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
      <span className="atlas-logo-image" aria-hidden="true">
        <img
          className="atlas-logo-asset atlas-logo-on-light"
          src="/brand/atlas-one-logo-light.png"
          width="540"
          height="159"
          alt=""
          draggable="false"
        />
        <img
          className="atlas-logo-asset atlas-logo-on-dark"
          src="/brand/atlas-one-logo-dark.png"
          width="540"
          height="159"
          alt=""
          draggable="false"
        />
      </span>
      {office && <small>OFFICE</small>}
    </Link>
  );
}
