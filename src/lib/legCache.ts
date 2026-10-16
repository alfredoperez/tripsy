// Stop-to-stop travel times, remembered by the two coordinates. A day routed
// once shows its connectors on every later visit without calling Mapbox.
// Kept in memory and in localStorage; storage may be missing or full, and
// that only means the day is routed again.

import type { LatLng, Leg } from "@/lib/mapbox";

export type CachedLeg = { walk: Leg | null; drive: Leg | null; at: number };

const STORAGE_KEY = "tripsy:legs:v1";
const MAX_ENTRIES = 600;

let memory: Map<string, CachedLeg> | null = null;

function load() {
  if (memory) return memory;
  memory = new Map();
  if (typeof window === "undefined") return memory;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const entries = JSON.parse(raw) as [string, CachedLeg][];
      if (Array.isArray(entries)) for (const [key, value] of entries) memory.set(key, value);
    }
  } catch {
    // Unreadable storage: start empty.
  }
  return memory;
}

function point(p: LatLng) {
  return `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`;
}

export function legKey(from: LatLng, to: LatLng) {
  return `${point(from)}>${point(to)}`;
}

export function getLeg(from: LatLng, to: LatLng) {
  return load().get(legKey(from, to));
}

export function putLegs(entries: { from: LatLng; to: LatLng; leg: CachedLeg }[]) {
  const map = load();
  for (const { from, to, leg } of entries) {
    const key = legKey(from, to);
    map.delete(key);
    map.set(key, leg);
  }
  // Oldest first in insertion order: drop from the front.
  while (map.size > MAX_ENTRIES) {
    const oldest = map.keys().next().value;
    if (oldest === undefined) break;
    map.delete(oldest);
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...map]));
  } catch {
    // Private mode or full: the memory copy still serves this session.
  }
}
