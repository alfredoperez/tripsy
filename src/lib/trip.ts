// Trip helpers shared by the trip page, the Nearby page and the preview.

import { supabase } from "@/lib/supabase";
import { hotelName, parseFlight } from "@/lib/tickets";
import type { Day, Leg, Stop, StopKind, Trip } from "@/lib/types";

export const KIND_ICON: Record<StopKind, string> = {
  travel: "✈️",
  eat: "🍽️",
  coffee: "☕",
  work: "💻",
  hike: "🥾",
  see: "🏛️",
  stay: "🛏️",
  brewery: "🍺",
};

export async function fetchTrip(slug: string) {
  const { data } = await supabase
    .from("trips")
    .select("*, legs(*), days(*, stops(*))")
    .eq("slug", slug)
    .maybeSingle();
  return data as Trip | null;
}

export function todayIn(timezone: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(new Date());
}

/** "Sat, Oct 31". */
export function formatDate(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function shortDate(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function isFlight(stop: Stop) {
  return parseFlight(stop) !== null;
}

/**
 * Whether a stop names a place we can look up. A travel stop without an
 * address or map link ("Uber to the airport", "Bus to Tequila") is a
 * journey, not a place, so its title is never geocoded.
 */
export function isPlaceable(stop: Stop) {
  if (isFlight(stop)) return false;
  if (stop.kind !== "travel") return true;
  return Boolean(stop.address || stop.map_url || (stop.lat != null && stop.lng != null));
}

export function stopPlace(stop: Stop, day: Day, dayLabel = formatDate(day.date).replace(",", "")) {
  return {
    id: stop.id,
    dayId: day.id,
    dayLabel,
    kind: stop.kind,
    icon: KIND_ICON[stop.kind],
    title: stop.kind === "stay" ? hotelName(stop.title) : stop.title,
    address: stop.address,
    mapUrl: stop.map_url,
    coords: stop.lat != null && stop.lng != null ? { lat: stop.lat, lng: stop.lng } : null,
    persist: true,
  };
}

/**
 * A leg's hotel shows as a card on the first day of that leg, unless the leg
 * already has a `stay` stop, which renders its own card.
 */
export function lodgingByDay(legs: Leg[], days: Day[]) {
  const map = new Map<string, Leg>();
  for (const leg of legs) {
    if (!leg.lodging_name) continue;
    const legDays = days.filter((day) => day.leg_id === leg.id);
    if (legDays.some((day) => day.stops.some((stop) => stop.kind === "stay"))) continue;
    const first =
      legDays.find((day) => day.date === leg.start_date) ??
      legDays[0] ??
      days.find((day) => day.date === leg.start_date);
    if (first && !map.has(first.id)) map.set(first.id, leg);
  }
  return map;
}
