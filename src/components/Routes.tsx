"use client";

// Stop-to-stop times inside a day. Nothing runs on load: a day is timed only
// when someone taps "Route this day", and the result is cached by the two
// coordinates so later visits show the connectors without calling Mapbox.

import { useCallback, useState } from "react";
import { getLeg, legKey, putLegs } from "@/lib/legCache";
import { crowFlies, hasMapbox, pairTimes, type LatLng, type Travel } from "@/lib/mapbox";
import { isFlight, isPlaceable, stopPlace } from "@/lib/trip";
import type { Day, Stop, Trip } from "@/lib/types";
import { centroid, knownCoords, lookedUp, NO_TIMES, resolveCoords, TravelChips } from "./Distance";

export type ConnectorState = { status: "loading" } | { status: "done"; travel: Travel };

export type DayRouteState = {
  /** Some pair of this day has no time yet and could get one. */
  canRoute: boolean;
  busy: boolean;
  message: string | null;
};

export type RouteApi = {
  connector: (from: Stop, to: Stop) => ConnectorState | null;
  dayState: (day: Day) => DayRouteState;
  routeDay: (day: Day, trip: Trip) => void;
};

/** Closer than this, two stops are the same place: no connector. */
const SAME_PLACE_M = 40;

// Pairs already sent to Mapbox this session, so one with no route doesn't
// keep the button up.
const attempted = new Set<string>();

/** Consecutive top-level stops of a day, minus any pair that touches a flight. */
export function dayPairs(day: Day): [Stop, Stop][] {
  const top = day.stops
    .filter((stop) => !stop.parent_stop_id)
    .sort((a, b) => a.position - b.position);
  const pairs: [Stop, Stop][] = [];
  for (let i = 1; i < top.length; i++) {
    const [a, b] = [top[i - 1], top[i]];
    if (isFlight(a) || isFlight(b)) continue;
    pairs.push([a, b]);
  }
  return pairs;
}

export function stopCoords(stop: Stop) {
  return knownCoords({
    id: stop.id,
    coords: stop.lat != null && stop.lng != null ? { lat: stop.lat, lng: stop.lng } : null,
    mapUrl: stop.map_url,
  });
}

function samePlace(a: LatLng, b: LatLng) {
  return crowFlies(a, b) < SAME_PLACE_M;
}

function cached(from: LatLng, to: LatLng): Travel | null {
  const leg = getLeg(from, to);
  if (!leg || (!leg.walk && !leg.drive)) return null;
  return { from, to, walk: leg.walk, drive: leg.drive };
}

function pending([a, b]: [Stop, Stop]) {
  const from = stopCoords(a);
  const to = stopCoords(b);
  if (from && to) {
    return !samePlace(from, to) && !cached(from, to) && !attempted.has(legKey(from, to));
  }
  // A missing coordinate is worth a tap only if it can still be looked up.
  return [a, b].every((stop) => stopCoords(stop) || (isPlaceable(stop) && !lookedUp(stop.id)));
}

/** The real thing, for TripView. */
export function useDayRoutes(): RouteApi {
  const [busy, setBusy] = useState<ReadonlySet<string>>(new Set());
  const [messages, setMessages] = useState<Record<string, string | null>>({});
  // Bumped after a day is routed: the cache lives outside React.
  const [, setVersion] = useState(0);

  const connector = useCallback(
    (a: Stop, b: Stop): ConnectorState | null => {
      const from = stopCoords(a);
      const to = stopCoords(b);
      if (from && to) {
        if (samePlace(from, to)) return null;
        const travel = cached(from, to);
        if (travel) return { status: "done", travel };
      }
      if (busy.has(a.day_id) && isPlaceable(a) && isPlaceable(b)) return { status: "loading" };
      return null;
    },
    [busy],
  );

  const dayState = useCallback(
    (day: Day): DayRouteState => ({
      canRoute: hasMapbox && dayPairs(day).some(pending),
      busy: busy.has(day.id),
      message: messages[day.id] ?? null,
    }),
    [busy, messages],
  );

  const run = useCallback(async (day: Day, trip: Trip) => {
    setBusy((prev) => new Set(prev).add(day.id));
    setMessages((prev) => ({ ...prev, [day.id]: null }));
    try {
      const pairs = dayPairs(day);
      const stops = [...new Map(pairs.flat().map((stop) => [stop.id, stop])).values()].filter(
        isPlaceable,
      );
      const places = stops.map((stop) => stopPlace(stop, day));
      // Bias lookups toward the day's known stops, else the whole trip.
      const tripKnown = trip.days
        .flatMap((d) => d.stops)
        .map(stopCoords)
        .filter((p): p is LatLng => Boolean(p));
      const coords = await resolveCoords(places, places, centroid(tripKnown));
      const coordOf = (stop: Stop) => coords.get(stop.id) ?? stopCoords(stop);

      const todo = pairs
        .map(([a, b]) => ({ from: coordOf(a), to: coordOf(b) }))
        .filter(
          (pair): pair is { from: LatLng; to: LatLng } =>
            Boolean(pair.from && pair.to) && !samePlace(pair.from!, pair.to!) && !cached(pair.from!, pair.to!),
        );
      const unplaced = stops.filter((stop) => !coordOf(stop)).length;

      let message: string | null = null;
      if (todo.length > 0) {
        try {
          const times = await pairTimes(todo);
          const at = Date.now();
          putLegs(
            todo
              .map((pair, i) => ({ ...pair, leg: { ...times[i], at } }))
              .filter(({ leg }) => leg.walk || leg.drive),
          );
          for (const pair of todo) attempted.add(legKey(pair.from, pair.to));
          if (times.some((t) => !t.walk && !t.drive)) message = "No route between some stops.";
        } catch {
          message = NO_TIMES;
        }
      }
      if (!message && unplaced > 0) {
        message = `Couldn’t place ${unplaced} ${unplaced === 1 ? "stop" : "stops"} on the map.`;
      }
      setMessages((prev) => ({ ...prev, [day.id]: message }));
    } finally {
      setBusy((prev) => {
        const next = new Set(prev);
        next.delete(day.id);
        return next;
      });
      setVersion((v) => v + 1);
    }
  }, []);

  const routeDay = useCallback((day: Day, trip: Trip) => void run(day, trip), [run]);

  return { connector, dayState, routeDay };
}

function RouteIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="6" cy="19" r="2.5" />
      <circle cx="18" cy="5" r="2.5" />
      <path d="M8.5 19H16a3.5 3.5 0 0 0 0-7H8a3.5 3.5 0 0 1 0-7h7.5" />
    </svg>
  );
}

/** The small per-day button in the day header, and its inline error. */
export function RouteDayButton({ state, onTap }: { state: DayRouteState; onTap: () => void }) {
  if (!state.canRoute && !state.busy && !state.message) return null;
  return (
    <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1">
      {(state.canRoute || state.busy) && (
        <button
          type="button"
          onClick={onTap}
          disabled={state.busy}
          className="flex items-center gap-1.5 rounded-full bg-background px-3 py-1.5 font-mono text-[11px] font-semibold uppercase tracking-wide text-ink active:scale-[0.97] disabled:opacity-70 motion-reduce:active:scale-100"
        >
          <RouteIcon className={`h-3.5 w-3.5 ${state.busy ? "motion-safe:animate-pulse" : ""}`} />
          {state.busy ? "Routing…" : "Route this day"}
        </button>
      )}
      {state.message && (
        <span className="text-[12px] leading-snug text-muted" aria-live="polite">
          {state.message}
        </span>
      )}
    </div>
  );
}

/** The slim row between two stops: how to get from the previous one to this one. */
export function Connector({ state }: { state: ConnectorState }) {
  return (
    <li className="flex items-center gap-3.5 border-b-0 px-5 pb-1 pt-2.5" aria-label="From the previous stop">
      <div className="flex w-10 shrink-0 justify-center self-stretch" aria-hidden>
        <span className="w-0 border-l-2 border-dotted border-faint" />
      </div>
      {state.status === "loading" ? (
        <p className="py-1 font-mono text-[11px] uppercase tracking-wide text-muted motion-safe:animate-pulse">
          Timing…
        </p>
      ) : (
        <TravelChips travel={state.travel} />
      )}
    </li>
  );
}
