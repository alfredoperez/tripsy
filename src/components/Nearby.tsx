"use client";

// The Nearby page: the trip's places, closest first from where you are.
// Nothing asks for location or calls Mapbox until "Use my location".

import Link from "next/link";
import { useEffect, useState } from "react";
import { hotelName } from "@/lib/tickets";
import {
  fetchTrip,
  formatDate,
  isFlight,
  isPlaceable,
  KIND_ICON,
  lodgingByDay,
  stopPlace,
  todayIn,
} from "@/lib/trip";
import type { StopKind, Trip } from "@/lib/types";
import { TravelChips, useNearby, type NearbyApi, type Place, type TravelResult } from "./Distance";

type Filter = "all" | "eat" | "coffee" | "see" | "brewery" | "stay";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "eat", label: "Eat" },
  { value: "coffee", label: "Coffee" },
  { value: "see", label: "See" },
  { value: "brewery", label: "Drinks" },
  { value: "stay", label: "Stay" },
];

function dedupeKey(title: string) {
  return title.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Every stop of today and later, plus earlier days' stops not yet done.
 * Flights are left out, hotels kept (stay stops and the leg's "Your base").
 * One row per title: the upcoming, not-done one wins.
 */
export function nearbyPlaces(trip: Trip, today: string): Place[] {
  const days = [...trip.days].sort((a, b) => a.date.localeCompare(b.date));
  const lodging = lodgingByDay(trip.legs ?? [], days);
  type Candidate = { place: Place; rank: number; order: number };
  const candidates: Candidate[] = [];
  let order = 0;

  for (const day of days) {
    const past = day.date < today;
    const label = formatDate(day.date).replace(",", "");
    const stops = [...day.stops].sort((a, b) => a.position - b.position);
    for (const stop of stops) {
      if (past && stop.done) continue;
      if (isFlight(stop) || !isPlaceable(stop)) continue;
      const place = stopPlace(stop, day, stop.done ? "Done" : label);
      candidates.push({ place, rank: (stop.done ? 2 : 0) + (past ? 1 : 0), order: order++ });
    }
    const leg = lodging.get(day.id);
    if (leg?.lodging_name && !past) {
      candidates.push({
        place: {
          id: leg.id,
          dayId: day.id,
          dayLabel: label,
          kind: "stay",
          icon: KIND_ICON.stay,
          title: hotelName(leg.lodging_name),
          address: leg.lodging_address,
          mapUrl: leg.lodging_map_url,
          coords: null,
          // Legs have no coordinate columns: looked up once per session.
          persist: false,
        },
        rank: 0,
        order: order++,
      });
    }
  }

  const best = new Map<string, Candidate>();
  for (const candidate of candidates) {
    const key = dedupeKey(candidate.place.title);
    const kept = best.get(key);
    if (!kept || candidate.rank < kept.rank) best.set(key, candidate);
  }
  return [...best.values()].sort((a, b) => a.order - b.order).map((c) => c.place);
}

export function NearbyView({ slug }: { slug: string }) {
  const [trip, setTrip] = useState<Trip | null>(null);
  const [missing, setMissing] = useState(false);
  const api = useNearby();

  useEffect(() => {
    let cancelled = false;
    fetchTrip(slug).then((data) => {
      if (cancelled) return;
      if (data) setTrip(data);
      else setMissing(true);
    });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (missing) return <p className="p-8 text-muted">No trip called “{slug}”.</p>;
  if (!trip) {
    return <p className="p-8 font-mono text-xs uppercase tracking-widest text-muted">Loading…</p>;
  }
  return (
    <NearbyScreen
      tripTitle={trip.title}
      backHref={`/t/${slug}`}
      places={nearbyPlaces(trip, todayIn(trip.timezone))}
      api={api}
    />
  );
}

function sortMeters(result: TravelResult | undefined) {
  if (result?.status !== "done") return Infinity;
  return result.travel.walk?.meters ?? result.travel.drive?.meters ?? Infinity;
}

function ago(then: number, now: number) {
  const minutes = Math.floor(Math.max(0, now - then) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  return `${Math.floor(minutes / 60)} h ago`;
}

function LocateIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className} fill="currentColor">
      <path d="M21.4 2.6a1 1 0 0 0-1.1-.2l-17 7.5a1 1 0 0 0 .1 1.9l7.1 2.1 2.1 7.1a1 1 0 0 0 1.9.1l7.5-17a1 1 0 0 0-.6-1.5Z" />
    </svg>
  );
}

/** The page from data alone. Also rendered by the dev preview. */
export function NearbyScreen({
  tripTitle,
  backHref,
  places,
  api,
}: {
  tripTitle: string;
  backHref: string;
  places: Place[];
  api: NearbyApi;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const [now, setNow] = useState(() => Date.now());
  const working = api.status === "locating" || api.status === "timing";
  const timed = api.status === "done" || (working && api.updatedAt !== null);

  useEffect(() => {
    if (!api.updatedAt) return;
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, [api.updatedAt]);

  const counts = new Map<Filter, number>([["all", places.length]]);
  for (const place of places) {
    const kind = place.kind as StopKind;
    if (FILTERS.some((f) => f.value === kind)) {
      counts.set(kind as Filter, (counts.get(kind as Filter) ?? 0) + 1);
    }
  }
  const shown = places.filter((place) => filter === "all" || place.kind === filter);
  const rows = timed
    ? [...shown].sort((a, b) => sortMeters(api.results[a.id]) - sortMeters(api.results[b.id]))
    : shown;
  const untimed = timed ? rows.filter((p) => api.results[p.id]?.status !== "done").length : 0;
  const busyLabel = api.status === "locating" ? "Locating…" : "Timing…";

  return (
    <main className="mx-auto w-full max-w-2xl px-4 pb-24 pt-5">
      <div className="flex items-center justify-between">
        <Link
          href={backHref}
          aria-label={`Back to ${tripTitle}`}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-panel text-ink"
        >
          <svg viewBox="0 0 24 24" aria-hidden className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18 9 12l6-6" />
          </svg>
        </Link>
        {timed && (
          <button
            type="button"
            onClick={() => api.locate(places)}
            disabled={working}
            className="flex items-center gap-1.5 rounded-full bg-accent px-3 py-2 font-mono text-[11px] font-semibold uppercase tracking-widest text-ink active:scale-[0.97] disabled:opacity-70 motion-reduce:active:scale-100"
          >
            <LocateIcon className={`h-3.5 w-3.5 ${working ? "motion-safe:animate-pulse" : ""}`} />
            {working ? busyLabel : "Refresh"}
          </button>
        )}
      </div>

      <h1 className="headline mt-8 text-[clamp(2.4rem,12vw,3.75rem)]">Nearby</h1>
      <p className="headline-light mt-1 text-[clamp(1.5rem,7vw,2.25rem)] [overflow-wrap:anywhere]">
        {tripTitle}
      </p>

      {!timed && (
        <button
          type="button"
          onClick={() => api.locate(places)}
          disabled={working || places.length === 0}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-accent px-5 py-4 text-[15px] font-semibold uppercase tracking-wider text-ink active:scale-[0.98] disabled:opacity-70 motion-reduce:active:scale-100"
        >
          <LocateIcon className={`h-4 w-4 ${working ? "motion-safe:animate-pulse" : ""}`} />
          {working ? busyLabel : "Use my location"}
        </button>
      )}

      {(api.message || api.updatedAt) && (
        <p
          aria-live="polite"
          className={`mt-4 px-1 leading-snug ${
            api.message
              ? "text-[14px] font-medium text-ink"
              : "font-mono text-[11px] uppercase tracking-wide text-muted"
          }`}
        >
          {api.message ?? (api.updatedAt ? `From you · updated ${ago(api.updatedAt, Math.max(now, api.updatedAt))}` : "")}
        </p>
      )}

      <div className="mt-5 flex flex-wrap gap-1.5" role="group" aria-label="Kind of place">
        {FILTERS.map((option) => {
          const count = counts.get(option.value) ?? 0;
          const active = filter === option.value;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={active}
              disabled={count === 0}
              onClick={() => setFilter(option.value)}
              className={`flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[13px] font-semibold uppercase tracking-wide disabled:opacity-35 ${
                active ? "bg-ink text-white" : "bg-panel text-ink"
              }`}
            >
              {option.label}
              <span className={`font-mono text-[11px] tabular-nums ${active ? "text-accent" : "text-muted"}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      <section className="mt-4 overflow-hidden rounded-[28px] bg-panel">
        <ul className="divide-y divide-line">
          {rows.map((place) => {
            const result = api.results[place.id];
            return (
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
                  {timed && result?.status === "done" && (
                    <div className="mt-2">
                      <TravelChips travel={result.travel} />
                    </div>
                  )}
                  {timed && result?.status === "none" && (
                    <p className="mt-1 text-[12px] text-faint">Couldn’t place this one on the map.</p>
                  )}
                </div>
              </li>
            );
          })}
          {rows.length === 0 && (
            <li className="px-5 py-4 text-sm text-muted">No places on this trip yet.</li>
          )}
        </ul>
        {untimed > 0 && (
          <p className="px-5 pb-5 pt-1 text-[13px] text-faint">
            {untimed} {untimed === 1 ? "place" : "places"} without a time.
          </p>
        )}
      </section>
    </main>
  );
}
