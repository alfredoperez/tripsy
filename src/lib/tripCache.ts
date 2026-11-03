// The last trip data this phone saw, kept in localStorage so a trip opens
// instantly and still opens with no signal. The network copy always replaces
// it once it arrives. Storage may be missing, full or blocked; that only means
// the app waits for the network like before.

import type { TripRow } from "@/components/TripList";
import type { Trip } from "@/lib/types";

const TRIP_PREFIX = "tripsy:trip:v1:";
const LIST_KEY = "tripsy:trips:v1";

export type Saved<T> = { data: T; syncedAt: number };

function read<T>(key: string): Saved<T> | null {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const saved = JSON.parse(raw) as Saved<T>;
    return saved && saved.data && typeof saved.syncedAt === "number" ? saved : null;
  } catch {
    return null;
  }
}

function write<T>(key: string, data: T, syncedAt: number) {
  try {
    window.localStorage.setItem(key, JSON.stringify({ data, syncedAt }));
  } catch {
    // Full or blocked: the in-memory copy still serves this visit.
  }
}

export const readTrip = (slug: string) => read<Trip>(TRIP_PREFIX + slug);
export const writeTrip = (slug: string, trip: Trip, syncedAt: number) => write(TRIP_PREFIX + slug, trip, syncedAt);
export const readTripList = () => read<TripRow[]>(LIST_KEY);
export const writeTripList = (trips: TripRow[], syncedAt: number) => write(LIST_KEY, trips, syncedAt);

export function forgetTrip(slug: string) {
  try {
    window.localStorage.removeItem(TRIP_PREFIX + slug);
  } catch {
    // Nothing saved to forget.
  }
}

/** On sign-out: saved trips and the service worker's photo and page caches. */
export function clearSavedTrips() {
  try {
    for (const key of Object.keys(window.localStorage)) {
      if (key.startsWith(TRIP_PREFIX) || key === LIST_KEY) window.localStorage.removeItem(key);
    }
  } catch {
    // Storage blocked: nothing was saved.
  }
  navigator.serviceWorker?.controller?.postMessage("tripsy:clear");
}

/** "3:42 PM" today, "Nov 2, 3:42 PM" before that. */
export function syncedLabel(syncedAt: number, now = Date.now()) {
  const at = new Date(syncedAt);
  const time = at.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  if (new Date(now).toDateString() === at.toDateString()) return time;
  return `${at.toLocaleDateString("en-US", { month: "short", day: "numeric" })}, ${time}`;
}
