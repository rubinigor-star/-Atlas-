import Link from "next/link";

type LogoSurface = "dark" | "light" | "adaptive";

type AtlasLogoProps = {
  href?: string;
  surface?: LogoSurface;
  office?: boolean;
  dark?: boolean;
  className?: string;
};

export function AtlasLogo({
  href = "/",
  surface,
  office = false,
  dark = false,
  className = "",
}: AtlasLogoProps) {
  const resolvedSurface: LogoSurface = surface ?? (dark || office ? "dark" : "light");
  const classes = ["atlas-brand-logo", `atlas-brand-logo--${resolvedSurface}`, office ? "atlas-brand-logo--office" : "", className]
    .filter(Boolean)
    .join(" ");

  return (
    <Link href={href} className={classes} aria-label="Atlas One - главная">
      <span className="atlas-brand-logo__mark" aria-hidden="true">
        <img
          className="atlas-brand-logo__image atlas-brand-logo__image--dark"
          src="/brand/atlas-logo-dark.svg"
          width="270"
          height="80"
          alt=""
        />
        <img
          className="atlas-brand-logo__image atlas-brand-logo__image--light"
          src="/brand/atlas-logo-light.svg"
          width="270"
          height="80"
          alt=""
        />
      </span>
      {office && <small>OFFICE</small>}
    </Link>
  );
}
