"use client";

// Shared pieces for travel times: finding a place's coordinates, the person's
// position, and the walk / drive chips. Nothing here runs on load: location
// is asked for, and Mapbox is called, only from a tap.

import { useCallback, useState } from "react";
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
import type { StopKind } from "@/lib/types";
import { CarIcon, WalkIcon } from "./icons";

/** Something on the itinerary you could walk or drive to. */
export type Place = {
  id: string;
  dayId: string;
  /** "Sat Oct 31", or "Done". */
  dayLabel: string;
  kind: StopKind;
  imageUrl: string | null;
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

const WALK_TOO_LONG_MIN = 60;
const GEOCODE_CONCURRENCY = 3;

export const DENIED = "Location is off for this app. Allow it in Settings to see travel times.";
export const UNAVAILABLE = "Couldn’t find where you are. Try again in a moment.";
export const NO_TIMES = "Couldn’t get travel times. Try again.";
export const NO_TOKEN = "Travel times aren’t set up.";

export function currentPosition() {
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

export function centroid(points: LatLng[]): LatLng | undefined {
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

// Coordinates found this session, shared by the trip page and Nearby.
// null = looked and found nothing, don't retry.
const found = new Map<string, LatLng | null>();

/** Known coordinates without any network: saved, found this session, or in the map link. */
export function knownCoords(place: Pick<Place, "id" | "coords" | "mapUrl">) {
  return place.coords ?? found.get(place.id) ?? coordsFromMapUrl(place.mapUrl);
}

/** True once a lookup for this place has run this session (found or not). */
export function lookedUp(id: string) {
  return found.has(id);
}

/**
 * Coordinates for every place: saved ones, then ones read from the map link,
 * then a Mapbox geocode biased toward that day's other places (else `near`).
 * Anything found for a stop is saved back to it.
 */
export async function resolveCoords(places: Place[], all: Place[], near?: LatLng) {
  const out = new Map<string, LatLng>();
  const missing: Place[] = [];
  for (const place of places) {
    const known = place.coords ?? found.get(place.id);
    if (known) {
      out.set(place.id, known);
      continue;
    }
    if (known === null) continue;
    const parsed = coordsFromMapUrl(place.mapUrl);
    if (parsed) {
      found.set(place.id, parsed);
      out.set(place.id, parsed);
      if (place.persist) saveCoords(place.id, parsed);
    } else {
      missing.push(place);
    }
  }

  const bias = (place: Place) =>
    centroid(
      all
        .filter((other) => other.dayId === place.dayId && other.id !== place.id)
        .map((other) => out.get(other.id) ?? knownCoords(other))
        .filter((p): p is LatLng => Boolean(p)),
    ) ?? near;

  let next = 0;
  const worker = async () => {
    while (next < missing.length) {
      const place = missing[next++];
      const point = await geocode(place.address || place.title, bias(place));
      found.set(place.id, point);
      if (!point) continue;
      out.set(place.id, point);
      if (place.persist) saveCoords(place.id, point);
    }
  };
  await Promise.all(Array.from({ length: GEOCODE_CONCURRENCY }, worker));
  return out;
}

export type NearbyApi = {
  status: "idle" | "locating" | "timing" | "done";
  message: string | null;
  results: Record<string, TravelResult>;
  updatedAt: number | null;
  locate: (places: Place[]) => void;
};

/** GPS, then one set of times from the person to every place. Runs only on tap. */
export function useNearby(): NearbyApi {
  const [status, setStatus] = useState<NearbyApi["status"]>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, TravelResult>>({});
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);

  const locate = useCallback(async (places: Place[]) => {
    setMessage(null);
    if (!hasMapbox) {
      setMessage(NO_TOKEN);
      return;
    }
    setStatus("locating");
    let me: LatLng;
    try {
      me = await currentPosition();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : UNAVAILABLE);
      setStatus(updatedAt ? "done" : "idle");
      return;
    }

    setStatus("timing");
    const coords = await resolveCoords(places, places, me);
    const targets = places.filter((p) => coords.has(p.id));
    let travel: Travel[] = [];
    try {
      travel = await travelTimes(
        me,
        targets.map((p) => coords.get(p.id)!),
      );
    } catch {
      setMessage(NO_TIMES);
      setStatus(updatedAt ? "done" : "idle");
      return;
    }

    const next: Record<string, TravelResult> = {};
    for (const place of places) next[place.id] = { status: "none" };
    targets.forEach((place, i) => {
      const t = travel[i];
      if (t && (t.walk || t.drive)) next[place.id] = { status: "done", travel: { ...t, from: me } };
    });
    setResults(next);
    setUpdatedAt(Date.now());
    setStatus("done");
  }, [updatedAt]);

  return { status, message, results, updatedAt, locate: (places) => void locate(places) };
}

/** `walk 18 min · car 7 min · 1.4 km`, each time a link to Google Maps directions. */
export function TravelLine({ travel, km = true }: { travel: Travel; km?: boolean }) {
  const meters = travel.walk?.meters ?? travel.drive?.meters ?? null;
  const link =
    "inline-flex items-center gap-1 whitespace-nowrap rounded-full tabular-nums focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";
  return (
    <span className="inline-flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 font-mono text-[11px] text-muted">
      {travel.walk && (
        <a
          href={directionsUrl(travel.to, "walking", travel.from)}
          target="_blank"
          rel="noreferrer"
          aria-label={`Walk ${formatMinutes(travel.walk.minutes)}, walking directions`}
          className={`${link} ${travel.walk.minutes > WALK_TOO_LONG_MIN ? "opacity-55" : ""}`}
        >
          <WalkIcon className="h-[13px] w-[13px]" />
          {formatMinutes(travel.walk.minutes)}
        </a>
      )}
      {travel.walk && travel.drive && <span aria-hidden>·</span>}
      {travel.drive && (
        <a
          href={directionsUrl(travel.to, "driving", travel.from)}
          target="_blank"
          rel="noreferrer"
          aria-label={`Drive ${formatMinutes(travel.drive.minutes)}, driving directions`}
          className={link}
        >
          <CarIcon className="h-[13px] w-[13px]" />
          {formatMinutes(travel.drive.minutes)}
        </a>
      )}
      {km && meters !== null && (
        <>
          <span aria-hidden>·</span>
          <span className="whitespace-nowrap">{formatKm(meters)}</span>
        </>
      )}
    </span>
  );
}

/** For fake data in the dev preview: straight-line distance, no network. */
export function fakeTravel(from: LatLng, to: LatLng): Travel {
  const meters = crowFlies(from, to) * 1.3;
  return {
    from,
    to,
    walk: { minutes: meters / 80, meters },
    drive: { minutes: 3 + meters / 400, meters: meters * 1.15 },
  };
}
