// Line icons from the approved mockup, plus the Google Maps pin and the Claude spark.
// All 24×24, drawn with currentColor so they follow the text color.

import { useId } from "react";
import type { StopKind } from "@/lib/types";

type IconProps = { className?: string };

function Line({
  className,
  width = 1.8,
  children,
}: IconProps & { width?: number; children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={width}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

export const EatIcon = (p: IconProps) => (
  <Line {...p}>
    <path d="M7 3v18M4.5 3v5a2.5 2.5 0 0 0 5 0V3M17.5 21V3c-2 0-3.5 2.5-3.5 6s1.5 4.5 3.5 4.5" />
  </Line>
);
export const CoffeeIcon = (p: IconProps) => (
  <Line {...p}>
    <path d="M4 9h12v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5zM16 10.5h1.5a2.5 2.5 0 0 1 0 5H16M8 3v3M12 3v3" />
  </Line>
);
export const SeeIcon = (p: IconProps) => (
  <Line {...p}>
    <path d="M3 21h18M5 21V10M19 21V10M9.5 21v-6h5v6M3 10l9-6 9 6z" />
  </Line>
);
export const DrinkIcon = (p: IconProps) => (
  <Line {...p}>
    <path d="M6 3h12l-1.5 8a4.5 4.5 0 0 1-9 0zM12 15.5V21M8 21h8M6.6 7h10.8" />
  </Line>
);
export const StayIcon = (p: IconProps) => (
  <Line {...p}>
    <path d="M3 19V6M3 14h18v5M21 14v-2a3 3 0 0 0-3-3h-7v5" />
    <circle cx="7" cy="11" r="1.6" />
  </Line>
);
/** Two peaks and a trail. */
export const HikeIcon = (p: IconProps) => (
  <Line {...p}>
    <path d="M2.5 20l6.5-11 4 6.5M11 12.2l3-4.7 7.5 12.5zM2.5 20H21.5" />
  </Line>
);
/** An open laptop. */
export const WorkIcon = (p: IconProps) => (
  <Line {...p}>
    <rect x="4.5" y="5" width="15" height="10.5" rx="1.8" />
    <path d="M2.5 19h19" />
  </Line>
);
/** A rolling suitcase: flights, buses and rides alike. */
export const TravelIcon = (p: IconProps) => (
  <Line {...p}>
    <rect x="5.5" y="7" width="13" height="12" rx="2.5" />
    <path d="M9.5 7V4.5h5V7M9.5 11v4M14.5 11v4M8 19v1.5M16 19v1.5" />
  </Line>
);

export const WalkIcon = (p: IconProps) => (
  <Line {...p} width={2}>
    <circle cx="13" cy="4" r="1.6" />
    <path d="M10 21l2.5-6.5L15 17v4M8 11l3-3.5 3 1 2 3M12.5 14.5L11 8.5" />
  </Line>
);
export const CarIcon = (p: IconProps) => (
  <Line {...p} width={2}>
    <path d="M4 16v-4l2-5h12l2 5v4zM4 16v2.5M20 16v2.5M4 12h16" />
    <circle cx="7.5" cy="14" r=".6" />
    <circle cx="16.5" cy="14" r=".6" />
  </Line>
);
export const ChevIcon = (p: IconProps) => (
  <Line {...p} width={2.2}>
    <path d="M6 9l6 6 6-6" />
  </Line>
);
export const BackIcon = (p: IconProps) => (
  <Line {...p} width={2.2}>
    <path d="M15 6l-6 6 6 6" />
  </Line>
);
export const CheckIcon = (p: IconProps) => (
  <Line {...p} width={2}>
    <circle cx="12" cy="12" r="9" />
    <path d="M8 12.5l2.7 2.7L16 9.8" />
  </Line>
);
export const MoveIcon = (p: IconProps) => (
  <Line {...p} width={2}>
    <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
    <path d="M3.5 10h17M8 3v4M16 3v4M10 15h5M13 13l2 2-2 2" />
  </Line>
);
export const TrashIcon = (p: IconProps) => (
  <Line {...p} width={2}>
    <path d="M4 7h16M10 3h4M6 7l1 13h10l1-13M10 11v6M14 11v6" />
  </Line>
);
export const ListIcon = (p: IconProps) => (
  <Line {...p} width={2}>
    <path d="M9 6h11M9 12h11M9 18h11" />
    <circle cx="4.5" cy="6" r="1" />
    <circle cx="4.5" cy="12" r="1" />
    <circle cx="4.5" cy="18" r="1" />
  </Line>
);
export const NearIcon = (p: IconProps) => (
  <Line {...p} width={2}>
    <path d="M20 4L3.5 10.5l7 2.5 2.5 7z" />
  </Line>
);
export const NextIcon = (p: IconProps) => (
  <Line {...p} width={2}>
    <path d="M12 20V8M6.5 13.5L12 8l5.5 5.5M5 4h14" />
  </Line>
);

const SPARK: [string, number][] = [
  ["M12 12L11.2 2.2Q12 1.4 12.8 2.2Z", 0],
  ["M12 12L11.3 3.6Q12 2.9 12.7 3.6Z", 33],
  ["M12 12L11.2 2.6Q12 1.9 12.8 2.6Z", 68],
  ["M12 12L11.4 4.2Q12 3.6 12.6 4.2Z", 100],
  ["M12 12L11.2 2.4Q12 1.7 12.8 2.4Z", 134],
  ["M12 12L11.3 3.2Q12 2.5 12.7 3.2Z", 166],
  ["M12 12L11.2 2.3Q12 1.6 12.8 2.3Z", 200],
  ["M12 12L11.4 3.9Q12 3.3 12.6 3.9Z", 232],
  ["M12 12L11.2 2.5Q12 1.8 12.8 2.5Z", 266],
  ["M12 12L11.3 3.4Q12 2.7 12.7 3.4Z", 298],
  ["M12 12L11.2 2.7Q12 2 12.8 2.7Z", 330],
];

export function ClaudeIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className} fill="currentColor">
      {SPARK.map(([d, deg]) => (
        <path key={deg} d={d} transform={deg ? `rotate(${deg} 12 12)` : undefined} />
      ))}
    </svg>
  );
}

const PIN = "M12 1.5c-4.3 0-7.5 3.2-7.5 7.4 0 5.4 7.5 13.6 7.5 13.6s7.5-8.2 7.5-13.6c0-4.2-3.2-7.4-7.5-7.4z";

/** The Google Maps pin, in its own colors. */
export function GoogleMapsIcon({ className }: IconProps) {
  const id = `pin-${useId().replace(/:/g, "")}`;
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className}>
      <clipPath id={id}>
        <path d={PIN} />
      </clipPath>
      <g clipPath={`url(#${id})`}>
        <rect width="24" height="24" fill="#34A853" />
        <path d="M0 0h24v9L0 17z" fill="#4285F4" />
        <path d="M0 0h12L0 12z" fill="#FBBC04" />
        <path d="M8 0h16v11z" fill="#EA4335" />
      </g>
      <circle cx="12" cy="8.9" r="2.8" fill="#fff" />
    </svg>
  );
}

const KIND: Record<StopKind, (p: IconProps) => React.ReactElement> = {
  eat: EatIcon,
  coffee: CoffeeIcon,
  see: SeeIcon,
  brewery: DrinkIcon,
  stay: StayIcon,
  hike: HikeIcon,
  work: WorkIcon,
  travel: TravelIcon,
};

export function KindIcon({ kind, className }: { kind: StopKind } & IconProps) {
  const Icon = KIND[kind] ?? SeeIcon;
  return <Icon className={className} />;
}

/** The app icon as a mark: a lime pin on a black rounded square. Matches src/lib/appIcon.tsx. */
export function AppMark({ className }: IconProps) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden className={className}>
      <rect width="64" height="64" rx="14" fill="#111111" />
      <svg x="8.8" y="8.8" width="46.4" height="46.4" viewBox="1.5 1.5 21 21">
        <path d={PIN} fill="#d4f53c" />
        <circle cx="12" cy="8.9" r="3" fill="#111111" />
      </svg>
    </svg>
  );
}
