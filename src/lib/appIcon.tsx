// The Tripsy app icon: a bold lime map pin on a black square. Drawn once
// here and rendered by next/og for the favicon, the iPhone home screen and
// the manifest, so every size matches.

import { ImageResponse } from "next/og";

const INK = "#111111";
const LIME = "#d4f53c";

/**
 * `rounded` cuts the corners (favicon, Android "any"); iOS rounds its own.
 * `scale` is the pin's height as a share of the square: smaller for the
 * maskable icon, which Android may crop to a circle.
 */
export function appIcon(size: number, { rounded = false, scale = 0.66 } = {}) {
  const pin = Math.round(size * scale * 1.1);
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: INK,
          borderRadius: rounded ? size * 0.22 : 0,
        }}
      >
        <svg width={pin} height={pin} viewBox="1.5 1.5 21 21">
          <path
            d="M12 1.5c-4.3 0-7.5 3.2-7.5 7.4 0 5.4 7.5 13.6 7.5 13.6s7.5-8.2 7.5-13.6c0-4.2-3.2-7.4-7.5-7.4z"
            fill={LIME}
          />
          <circle cx="12" cy="8.9" r="3" fill={INK} />
        </svg>
      </div>
    ),
    { width: size, height: size },
  );
}
