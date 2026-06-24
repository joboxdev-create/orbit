import { siGithub } from "simple-icons";
import { Plug } from "lucide-react";

interface SimpleIcon {
  title: string;
  hex: string;
  path: string;
}

// Real brand logos via Simple Icons. Add connectors here as they are built;
// keeping an explicit map keeps the bundle to the icons we actually use
// instead of pulling in the entire Simple Icons set.
const BRAND_ICONS: Record<string, SimpleIcon> = {
  github: siGithub,
};

// On the dark UI, near-black brand marks (e.g. GitHub #181717) would vanish.
// Lift only those to the theme foreground; keep colored brands in brand color.
function pickFill(hex: string): string {
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luminance < 0.25 ? "#e6e9ef" : `#${hex}`;
}

export function BrandIcon({
  slug,
  size = 28,
}: {
  slug?: string | null;
  size?: number;
}) {
  const icon = slug ? BRAND_ICONS[slug] : undefined;
  if (!icon) {
    // Unknown/missing brand: neutral fallback.
    return <Plug size={size} aria-hidden />;
  }
  return (
    <svg
      role="img"
      aria-label={icon.title}
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill={pickFill(icon.hex)}
    >
      <path d={icon.path} />
    </svg>
  );
}
