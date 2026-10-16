"use client";

// The Nearby tab: the trip's places, closest first from where you are.
// Nothing asks for location or calls Mapbox until "Use my location".

import { useEffect, useState } from "react";
import { hotelName } from "@/lib/tickets";
import { formatDate, isFlight, isPlaceable, lodgingByDay, stopPlace } from "@/lib/trip";
import type { Trip } from "@/lib/types";
import { TravelLine, type NearbyApi, type Place, type TravelResult } from "./Distance";
import { KindIcon, NearIcon } from "./icons";
import { Photo } from "./Photo";

type Filter = "all" | "eat" | "coffee" | "see" | "brewery" | "stay" | "hike" | "work";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "eat", label: "Eat" },
  { value: "coffee", label: "Coffee" },
  { value: "see", label: "See" },
  { value: "brewery", label: "Drinks" },
  { value: "stay", label: "Stay" },
  { value: "hike", label: "Hike" },
  { value: "work", label: "Work" },
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
          imageUrl: null,
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

function kmNumber(meters: number) {
  const km = meters / 1000;
  return km < 10 ? km.toFixed(1) : String(Math.round(km));
}

const chip =
  "flex flex-none items-center gap-1.5 rounded-full px-3 py-2 text-[13px] font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";

/** The Nearby tab of a trip: its places, closest first from where you are. */
export function NearbyPanel({ places, api }: { places: Place[]; api: NearbyApi }) {
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
    const kind = place.kind as Filter;
    if (FILTERS.some((f) => f.value === kind)) counts.set(kind, (counts.get(kind) ?? 0) + 1);
  }
  const shown = places.filter((place) => filter === "all" || place.kind === filter);
  const rows = timed
    ? [...shown].sort((a, b) => sortMeters(api.results[a.id]) - sortMeters(api.results[b.id]))
    : shown;
  const untimed = timed ? rows.filter((p) => api.results[p.id]?.status !== "done").length : 0;
  const busyLabel = api.status === "locating" ? "Locating…" : "Timing…";

  return (
    <section aria-label="Nearby">
      {timed ? (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-2.5">
          <span className="font-mono text-[11px] text-muted">
            {api.updatedAt ? `From you · updated ${ago(api.updatedAt, Math.max(now, api.updatedAt))}` : "From you"}
          </span>
          <button
            type="button"
            onClick={() => api.locate(places)}
            disabled={working}
            className={`${chip} bg-panel text-ink disabled:opacity-70`}
          >
            <NearIcon className={`h-[15px] w-[15px] ${working ? "motion-safe:animate-pulse" : ""}`} />
            {working ? busyLabel : "Refresh"}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => api.locate(places)}
          disabled={working || places.length === 0}
          className="mt-6 flex h-[50px] w-full items-center justify-center gap-2 rounded-full bg-accent text-[15px] font-semibold text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink active:scale-[0.98] disabled:opacity-70 motion-reduce:active:scale-100"
        >
          <NearIcon className={`h-[18px] w-[18px] ${working ? "motion-safe:animate-pulse" : ""}`} />
          {working ? busyLabel : "Use my location"}
        </button>
      )}

      {api.message && (
        <p aria-live="polite" className="mt-3 px-1 text-[14px] font-medium leading-snug text-ink">
          {api.message}
        </p>
      )}

      <div className="-mx-4 mt-3.5 flex gap-1.5 overflow-x-auto px-4 pb-1" role="group" aria-label="Kind of place">
        {FILTERS.filter((option) => option.value === "all" || (counts.get(option.value) ?? 0) > 0).map(
          (option) => {
            const active = filter === option.value;
            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={active}
                onClick={() => setFilter(option.value)}
                className={`${chip} ${active ? "bg-ink text-white" : "bg-panel text-ink"}`}
              >
                {option.value === "all" ? (
                  `All · ${places.length}`
                ) : (
                  <>
                    <KindIcon kind={option.value} className="h-[15px] w-[15px]" />
                    {option.label}
                  </>
                )}
              </button>
            );
          },
        )}
      </div>

      <ul className="mt-1">
        {rows.map((place) => {
          const result = api.results[place.id];
          const done = timed && result?.status === "done" ? result.travel : null;
          const meters = done ? (done.walk?.meters ?? done.drive?.meters ?? null) : null;
          return (
            <li
              key={place.id}
              className="mt-2.5 grid grid-cols-[56px_1fr_auto] items-center gap-3 rounded-[22px] bg-panel p-2.5"
            >
              <Photo url={place.imageUrl} kind={place.kind} className="h-14 w-14 rounded-[14px]">
                <span className="absolute bottom-1 left-1 flex h-6 w-6 items-center justify-center rounded-full bg-panel text-ink">
                  <KindIcon kind={place.kind} className="h-3.5 w-3.5" />
                </span>
              </Photo>
              <div className="min-w-0">
                <div className="font-mono text-[10px] uppercase text-muted">{place.dayLabel}</div>
                <div className="text-[15px] font-semibold leading-snug [overflow-wrap:anywhere]">
                  {place.title}
                </div>
                {done && (
                  <div className="mt-0.5">
                    <TravelLine travel={done} km={false} />
                  </div>
                )}
                {timed && result?.status === "none" && (
                  <p className="mt-0.5 text-[12px] text-faint">Couldn’t place this one on the map.</p>
                )}
              </div>
              {meters !== null ? (
                <div className="pr-1.5 text-right text-[18px] font-extrabold leading-none">
                  {kmNumber(meters)}
                  <small className="mt-0.5 block font-mono text-[10px] font-normal text-muted">KM</small>
                </div>
              ) : (
                <span />
              )}
            </li>
          );
        })}
        {rows.length === 0 && <li className="mt-4 px-1 text-sm text-muted">No places on this trip yet.</li>}
      </ul>
      {untimed > 0 && (
        <p className="mt-3 px-1 text-[13px] text-faint">
          {untimed} {untimed === 1 ? "place" : "places"} without a time.
        </p>
      )}
    </section>
  );
}
