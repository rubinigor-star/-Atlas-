import Image from "next/image";
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
      className={`atlas-logo${office ? " atlas-logo-office" : ""}${useDarkLogo ? " atlas-logo-dark" : ""}`}
      aria-label="Atlas One — главная"
    >
      <Image
        src={useDarkLogo ? "/atlas-one-logo-dark.png" : "/atlas-one-logo.svg"}
        alt="Atlas One"
        width={useDarkLogo ? 1080 : 904}
        height={useDarkLogo ? 318 : 257}
        className="atlas-logo-image"
      />
      {office && <small>OFFICE</small>}
    </Link>
  );
}
