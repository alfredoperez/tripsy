"use client";

// On-demand distance and travel times. Nothing here runs on load: location is
// asked for, and Mapbox is called, only from a tap on "Near me" or "How far?".

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import {
  coordsFromMapUrl,
  crowFlies,
  directionsUrl,
  formatKm,
  formatMinutes,
  geocode,
  hasMapbox,
  travelTimes,
  type LatLng,
  type Travel,
} from "@/lib/mapbox";
import { supabase } from "@/lib/supabase";

/** Something on the itinerary you could walk or drive to. */
export type Place = {
  id: string;
  dayId: string;
  dayLabel: string;
  icon: string;
  title: string;
  address: string | null;
  mapUrl: string | null;
  coords: LatLng | null;
  /** A stop row: coordinates found for it are saved so they are looked up once. */
  persist: boolean;
};

export type TravelResult =
  | { status: "done"; travel: Travel }
  | { status: "none" }
  | { status: "error"; message: string };

export type DistanceApi = {
  results: Record<string, TravelResult>;
  loading: ReadonlySet<string>;
  busy: false | "locating" | "timing";
  message: string | null;
  updatedAt: number | null;
  nearMe: (places: Place[]) => void;
  howFar: (place: Place, all: Place[]) => void;
};

const ORIGIN_FRESH_MS = 2 * 60 * 1000;
const WALK_TOO_LONG_MIN = 60;
const GEOCODE_CONCURRENCY = 3;

const DENIED = "Location is off for this app. Allow it in Settings to see travel times.";
const UNAVAILABLE = "Couldn’t find where you are. Try again in a moment.";
const NO_TIMES = "Couldn’t get travel times. Try again.";

function currentPosition() {
  return new Promise<LatLng>((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error(UNAVAILABLE));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => reject(new Error(err.code === err.PERMISSION_DENIED ? DENIED : UNAVAILABLE)),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 },
    );
  });
}

function centroid(points: LatLng[]): LatLng | undefined {
  if (points.length === 0) return undefined;
  const sum = points.reduce((acc, p) => ({ lat: acc.lat + p.lat, lng: acc.lng + p.lng }), {
    lat: 0,
    lng: 0,
  });
  return { lat: sum.lat / points.length, lng: sum.lng / points.length };
}

function saveCoords(id: string, point: LatLng) {
  // Best effort: a failed save only means the lookup happens again next time.
  supabase
    .from("stops")
    .update({ lat: point.lat, lng: point.lng })
    .eq("id", id)
    .then(
      () => undefined,
      () => undefined,
    );
}

/** The real thing, for TripView. Undefined without a Mapbox token: no buttons. */
export function useDistances(): DistanceApi | undefined {
  const [results, setResults] = useState<Record<string, TravelResult>>({});
  const [loading, setLoading] = useState<ReadonlySet<string>>(new Set());
  const [busy, setBusy] = useState<DistanceApi["busy"]>(false);
  const [message, setMessage] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const origin = useRef<{ at: number; point: LatLng } | null>(null);
  // Coordinates found this session; null = looked and found nothing, don't retry.
  const found = useRef(new Map<string, LatLng | null>());

  const coordsOf = useCallback((place: Place) => place.coords ?? found.current.get(place.id), []);

  const resolve = useCallback(
    async (places: Place[], all: Place[], me: LatLng) => {
      const out = new Map<string, LatLng>();
      const missing: Place[] = [];
      for (const place of places) {
        const known = coordsOf(place);
        if (known) {
          out.set(place.id, known);
          continue;
        }
        if (known === null) continue;
        const parsed = coordsFromMapUrl(place.mapUrl);
        if (parsed) {
          found.current.set(place.id, parsed);
          out.set(place.id, parsed);
          if (place.persist) saveCoords(place.id, parsed);
        } else {
          missing.push(place);
        }
      }

      // Bias each lookup toward that day's other known places, else the person.
      const near = (place: Place) =>
        centroid(
          all
            .filter((other) => other.dayId === place.dayId && other.id !== place.id)
            .map((other) => out.get(other.id) ?? coordsOf(other))
            .filter((p): p is LatLng => Boolean(p)),
        ) ?? me;

      let next = 0;
      const worker = async () => {
        while (next < missing.length) {
          const place = missing[next++];
          const point = await geocode(place.address || place.title, near(place));
          found.current.set(place.id, point);
          if (!point) continue;
          out.set(place.id, point);
          if (place.persist) saveCoords(place.id, point);
        }
      };
      await Promise.all(Array.from({ length: GEOCODE_CONCURRENCY }, worker));
      return out;
    },
    [coordsOf],
  );

  const run = useCallback(
    async (places: Place[], all: Place[], whole: boolean) => {
      const ids = places.map((p) => p.id);
      const mark = (on: boolean) =>
        setLoading((prev) => {
          const nextSet = new Set(prev);
          for (const id of ids) {
            if (on) nextSet.add(id);
            else nextSet.delete(id);
          }
          return nextSet;
        });
      const fail = (text: string) => {
        if (whole) setMessage(text);
        else setResults((prev) => ({ ...prev, [ids[0]]: { status: "error", message: text } }));
      };

      mark(true);
      if (whole) {
        setMessage(null);
        setBusy("locating");
      }
      try {
        let me: LatLng;
        const fresh = origin.current && Date.now() - origin.current.at < ORIGIN_FRESH_MS;
        if (!whole && fresh && origin.current) {
          me = origin.current.point;
        } else {
          try {
            me = await currentPosition();
          } catch (err) {
            fail(err instanceof Error ? err.message : UNAVAILABLE);
            return;
          }
          origin.current = { at: Date.now(), point: me };
        }

        if (whole) setBusy("timing");
        const coords = await resolve(places, all, me);
        const targets = places.filter((p) => coords.has(p.id));
        let travel: Travel[];
        try {
          travel = await travelTimes(
            me,
            targets.map((p) => coords.get(p.id)!),
          );
        } catch {
          if (targets.length > 0) {
            fail(NO_TIMES);
            return;
          }
          travel = [];
        }

        const update: Record<string, TravelResult> = {};
        for (const place of places) update[place.id] = { status: "none" };
        targets.forEach((place, i) => {
          const t = travel[i];
          if (t && (t.walk || t.drive)) update[place.id] = { status: "done", travel: t };
        });
        setResults((prev) => ({ ...prev, ...update }));
        if (whole) setUpdatedAt(Date.now());
      } finally {
        mark(false);
        if (whole) setBusy(false);
      }
    },
    [resolve],
  );

  const nearMe = useCallback((places: Place[]) => void run(places, places, true), [run]);
  const howFar = useCallback(
    (place: Place, all: Place[]) => void run([place], all, false),
    [run],
  );

  if (!hasMapbox) return undefined;
  return { results, loading, busy, message, updatedAt, nearMe, howFar };
}

const DistanceContext = createContext<{ api: DistanceApi; places: Place[] } | null>(null);

export const DistanceProvider = DistanceContext.Provider;

function LocateIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className} fill="currentColor">
      <path d="M21.4 2.6a1 1 0 0 0-1.1-.2l-17 7.5a1 1 0 0 0 .1 1.9l7.1 2.1 2.1 7.1a1 1 0 0 0 1.9.1l7.5-17a1 1 0 0 0-.6-1.5Z" />
    </svg>
  );
}

/** The header pill. First tap asks for location; later taps refresh. */
export function NearMeButton({ api, onTap }: { api: DistanceApi; onTap: () => void }) {
  const label =
    api.busy === "locating"
      ? "Locating…"
      : api.busy === "timing"
        ? "Timing…"
        : api.updatedAt
          ? "Refresh"
          : "Near me";
  return (
    <button
      type="button"
      onClick={onTap}
      disabled={Boolean(api.busy)}
      className="flex items-center gap-1.5 rounded-full bg-accent px-3 py-2 font-mono text-[11px] font-semibold uppercase tracking-widest text-ink active:scale-[0.97] disabled:opacity-70 motion-reduce:active:scale-100"
    >
      <LocateIcon className={`h-3.5 w-3.5 ${api.busy ? "motion-safe:animate-pulse" : ""}`} />
      {label}
    </button>
  );
}

function useNow(active: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, [active]);
  return now;
}

function ago(then: number, now: number) {
  const minutes = Math.floor(Math.max(0, now - then) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  return `${Math.floor(minutes / 60)} h ago`;
}

/** Status under the date pills, and the by-day / closest-first switch. */
export function NearMeBar({
  api,
  closest,
  onClosest,
}: {
  api: DistanceApi;
  closest: boolean;
  onClosest: (value: boolean) => void;
}) {
  const now = useNow(Boolean(api.updatedAt));
  if (!api.message && !api.updatedAt) return null;
  return (
    <div className="mt-4 rounded-[22px] bg-panel p-1.5">
      <p
        aria-live="polite"
        className={`px-3 pb-2 pt-1.5 text-[13px] leading-snug ${
          api.message ? "font-medium text-ink" : "font-mono text-[11px] uppercase tracking-wide text-muted"
        }`}
      >
        {api.message ??
          (api.updatedAt ? `From you · updated ${ago(api.updatedAt, Math.max(now, api.updatedAt))}` : "")}
      </p>
      {api.updatedAt && (
        <div className="grid grid-cols-2 gap-1 rounded-full bg-background p-1" role="group" aria-label="Order">
          {[
            { value: false, label: "By day" },
            { value: true, label: "Closest first" },
          ].map((option) => (
            <button
              key={option.label}
              type="button"
              aria-pressed={closest === option.value}
              onClick={() => onClosest(option.value)}
              className={`rounded-full py-2 text-[12px] font-semibold uppercase tracking-wide ${
                closest === option.value ? "bg-ink text-white" : "text-muted"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Chip({
  href,
  label,
  children,
  dim,
  raised,
}: {
  href?: string;
  label?: string;
  children: React.ReactNode;
  dim?: boolean;
  raised?: boolean;
}) {
  const className = `inline-flex items-center gap-1 whitespace-nowrap rounded-full ${
    raised ? "bg-panel" : "bg-background"
  } px-2.5 py-1 font-mono text-[11px] font-medium tabular-nums text-ink ${
    dim ? "opacity-45" : ""
  }`;
  if (!href) return <span className={className}>{children}</span>;
  return (
    <a href={href} target="_blank" rel="noreferrer" aria-label={label} className={className}>
      {children}
    </a>
  );
}

/** `🚶 18 min · 🚗 7 min · 1.4 km`, each time a link to Google Maps directions. */
export function TravelChips({ travel, raised }: { travel: Travel; raised?: boolean }) {
  const meters = travel.walk?.meters ?? travel.drive?.meters ?? null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {travel.walk && (
        <Chip
          href={directionsUrl(travel.to, "walking")}
          label={`Walk ${formatMinutes(travel.walk.minutes)}, walking directions`}
          dim={travel.walk.minutes > WALK_TOO_LONG_MIN}
          raised={raised}
        >
          <span aria-hidden>🚶</span>
          {formatMinutes(travel.walk.minutes)}
        </Chip>
      )}
      {travel.drive && (
        <Chip
          href={directionsUrl(travel.to, "driving")}
          label={`Drive ${formatMinutes(travel.drive.minutes)}, driving directions`}
          raised={raised}
        >
          <span aria-hidden>🚗</span>
          {formatMinutes(travel.drive.minutes)}
        </Chip>
      )}
      {meters !== null && <Chip raised={raised}>{formatKm(meters)}</Chip>}
    </div>
  );
}

/**
 * Under a stop: its chips once known, else a "How far?" button. Renders
 * nothing for stops that are not routed to (flights, done, past days).
 */
export function TravelLine({
  id,
  className = "",
  raised,
}: {
  id: string;
  className?: string;
  /** On a gray surface (hotel card, nested stop): white chips. */
  raised?: boolean;
}) {
  const ctx = useContext(DistanceContext);
  if (!ctx) return null;
  const place = ctx.places.find((p) => p.id === id);
  if (!place) return null;
  const { api } = ctx;
  const result = api.results[id];

  if (api.loading.has(id)) {
    return (
      <p
        className={`font-mono text-[11px] uppercase tracking-wide text-muted motion-safe:animate-pulse ${className}`}
        aria-live="polite"
      >
        Timing…
      </p>
    );
  }
  if (result?.status === "done") {
    return (
      <div className={className}>
        <TravelChips travel={result.travel} raised={raised} />
      </div>
    );
  }
  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <button
        type="button"
        onClick={() => api.howFar(place, ctx.places)}
        className={`rounded-full ${raised ? "bg-panel" : "bg-background"} px-2.5 py-1 font-mono text-[11px] font-semibold uppercase tracking-wide text-ink active:scale-[0.97] motion-reduce:active:scale-100`}
      >
        How far?
      </button>
      {result?.status === "none" && (
        <span className="text-[12px] text-faint">Couldn’t place this one on the map.</span>
      )}
      {result?.status === "error" && (
        <span className="text-[12px] text-muted" aria-live="polite">
          {result.message}
        </span>
      )}
    </div>
  );
}

function sortMeters(travel: Travel) {
  return travel.walk?.meters ?? travel.drive?.meters ?? Infinity;
}

/** Every timed place in one list, nearest first. */
export function ClosestList({ api, places }: { api: DistanceApi; places: Place[] }) {
  const timed = places
    .map((place) => ({ place, result: api.results[place.id] }))
    .filter(
      (entry): entry is { place: Place; result: { status: "done"; travel: Travel } } =>
        entry.result?.status === "done",
    )
    .sort((a, b) => sortMeters(a.result.travel) - sortMeters(b.result.travel));
  const untimed = places.length - timed.length;

  return (
    <section className="overflow-hidden rounded-[28px] bg-panel">
      <header className="flex items-baseline gap-2 px-5 pb-3 pt-5">
        <h2 className="headline text-[26px]">Closest</h2>
        <span className="headline-light text-[22px]">first</span>
      </header>
      <ul className="divide-y divide-line pb-1">
        {timed.map(({ place, result }) => (
          <li key={place.id} className="flex gap-3.5 px-5 py-4">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-background text-[17px]"
              aria-hidden
            >
              {place.icon}
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-mono text-[11px] font-medium uppercase tracking-wide text-muted">
                {place.dayLabel}
              </div>
              <div className="text-[16px] font-semibold leading-snug [overflow-wrap:anywhere]">
                {place.title}
              </div>
              <div className="mt-2">
                <TravelChips travel={result.travel} />
              </div>
            </div>
          </li>
        ))}
        {timed.length === 0 && (
          <li className="px-5 py-4 text-sm text-muted">No travel times yet.</li>
        )}
      </ul>
      {untimed > 0 && (
        <p className="px-5 pb-5 pt-1 text-[13px] text-faint">
          {untimed} {untimed === 1 ? "place" : "places"} without a time.
        </p>
      )}
    </section>
  );
}

/** For fake data in the dev preview: straight-line distance, no network. */
export function fakeTravel(from: LatLng, to: LatLng): Travel {
  const meters = crowFlies(from, to) * 1.3;
  return {
    to,
    walk: { minutes: meters / 80, meters },
    drive: { minutes: 3 + meters / 400, meters: meters * 1.15 },
  };
}
