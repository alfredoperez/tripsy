"use client";

import { useState } from "react";
import { isStoredPhoto } from "@/lib/photos";
import type { StopKind } from "@/lib/types";

/** A warm wash per kind, shown when a stop has no photo or it fails to load. */
const WASH: Record<StopKind, string> = {
  eat: "wash-1",
  coffee: "wash-4",
  see: "wash-2",
  brewery: "wash-3",
  stay: "wash-5",
  hike: "wash-6",
  work: "wash-4",
  travel: "wash-5",
};

/** The stop's photo, cover-fitted, or its kind's gradient. Any host: plain <img>, no next/image. */
export function Photo({
  url,
  kind,
  className = "",
  children,
}: {
  url: string | null | undefined;
  kind: StopKind;
  className?: string;
  /** Laid over the photo, such as the kind badge. */
  children?: React.ReactNode;
}) {
  const [failed, setFailed] = useState<string | null>(null);
  const show = url && failed !== url;
  return (
    <div className={`relative overflow-hidden ${WASH[kind] ?? "wash-2"} ${className}`}>
      {show && (
        // eslint-disable-next-line @next/next/no-img-element -- photos come from any host
        <img
          src={url}
          alt=""
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          // Our Storage copies allow CORS, so they cache as real responses, not opaque ones.
          crossOrigin={isStoredPhoto(url) ? "anonymous" : undefined}
          onError={() => setFailed(url)}
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}
      {children}
    </div>
  );
}
