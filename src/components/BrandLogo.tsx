import Image from "next/image";
import type { CSSProperties } from "react";

const LOGO_SRC = "/logoupdated-transparent61926.png";
const LOGO_WIDTH = 907;
const LOGO_HEIGHT = 249;

export type BrandLogoSize =
  | "landing"
  | "landing-footer"
  | "auth-desktop"
  | "auth-mobile"
  | "sidebar"
  | "sidebar-mobile"
  | "legal";

const sizeConfig: Record<
  BrandLogoSize,
  { style: CSSProperties; className: string }
> = {
  landing: {
    style: { height: 56, width: "auto", maxWidth: 280 },
    className: "h-14 md:h-16 w-auto max-w-[280px] shrink-0 object-contain",
  },
  "landing-footer": {
    style: { height: 40, width: "auto", maxWidth: 200 },
    className: "w-[180px] md:w-[200px] h-auto max-h-10 object-contain opacity-40",
  },
  "auth-desktop": {
    style: { height: 48, width: "auto", maxWidth: 320 },
    className:
      "h-12 xl:h-14 w-auto max-w-[280px] xl:max-w-[320px] object-contain drop-shadow-lg",
  },
  "auth-mobile": {
    style: { height: 40, width: "auto", maxWidth: 200 },
    className: "h-10 w-auto max-w-full object-contain",
  },
  sidebar: {
    style: { height: 32, width: "auto", maxWidth: 160 },
    className:
      "w-[160px] h-auto max-h-8 object-contain transition-opacity duration-150 group-hover:opacity-80",
  },
  "sidebar-mobile": {
    style: { height: 28, width: "auto", maxWidth: 120 },
    className: "w-[120px] h-auto max-h-7 object-contain",
  },
  legal: {
    style: { height: 40, width: "auto", maxWidth: 240 },
    className: "w-[200px] md:w-[240px] h-auto max-h-10 object-contain",
  },
};

interface BrandLogoProps {
  size: BrandLogoSize;
  className?: string;
  priority?: boolean;
}

/** MyProfitPulse logo with inline size constraints so layout stays stable if CSS fails to load. */
export function BrandLogo({ size, className = "", priority = false }: BrandLogoProps) {
  const config = sizeConfig[size];

  return (
    <Image
      src={LOGO_SRC}
      alt="MyProfitPulse"
      width={LOGO_WIDTH}
      height={LOGO_HEIGHT}
      priority={priority}
      style={config.style}
      className={[config.className, className].filter(Boolean).join(" ")}
    />
  );
}
