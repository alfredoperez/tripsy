// What each stop action changes, as plain data. The hook in StopEdits.tsx
// applies these to the screen right away and writes them to Supabase.

import type { Day, Stop, Trip } from "@/lib/types";

export type PositionChange = { id: string; position: number };

function topLevel(day: Day) {
  return day.stops.filter((s) => !s.parent_stop_id).sort((a, b) => a.position - b.position);
}

/**
 * "Do next": the stop goes right after the last done stop of its day, or first
 * when nothing is done yet. Returns only the rows whose position changes;
 * empty means it is already next.
 */
export function doNextChanges(day: Day, stopId: string, hidden: ReadonlySet<string> = new Set()): PositionChange[] {
  const all = topLevel(day);
  const stop = all.find((s) => s.id === stopId);
  if (!stop) return [];
  const rest = all.filter((s) => s.id !== stopId);
  const visible = rest.filter((s) => !hidden.has(s.id));
  const lastDone = visible.findLastIndex((s) => s.done);
  // Insert after the last done visible stop, counted in the full list.
  const anchor = lastDone >= 0 ? rest.indexOf(visible[lastDone]) + 1 : 0;
  const order = [...rest.slice(0, anchor), stop, ...rest.slice(anchor)];
  const changes: PositionChange[] = [];
  order.forEach((s, i) => {
    if (s.position !== i + 1) changes.push({ id: s.id, position: i + 1 });
  });
  // Same order, only renumbered: nothing to say.
  return order.every((s, i) => s.id === all[i]?.id) ? [] : changes;
}

/** The position that puts a stop at the end of a day. */
export function endOfDay(day: Day) {
  return day.stops.reduce((max, s) => Math.max(max, s.position), 0) + 1;
}

export function patchPositions(trip: Trip, dayId: string, changes: PositionChange[]): Trip {
  const next = new Map(changes.map((c) => [c.id, c.position]));
  return {
    ...trip,
    days: trip.days.map((day) =>
      day.id !== dayId
        ? day
        : { ...day, stops: day.stops.map((s) => (next.has(s.id) ? { ...s, position: next.get(s.id)! } : s)) },
    ),
  };
}

export function patchStop(trip: Trip, id: string, fields: Partial<Stop>): Trip {
  return {
    ...trip,
    days: trip.days.map((day) =>
      day.stops.some((s) => s.id === id)
        ? { ...day, stops: day.stops.map((s) => (s.id === id ? { ...s, ...fields } : s)) }
        : day,
    ),
  };
}

/** Moves a stop, and the stops nested in it, to the end of another day. */
export function patchMoveDay(trip: Trip, id: string, toDayId: string, position: number): Trip {
  const moving = trip.days
    .flatMap((d) => d.stops)
    .filter((s) => s.id === id || s.parent_stop_id === id)
    .map((s) => ({ ...s, day_id: toDayId, ...(s.id === id ? { position } : {}) }));
  const ids = new Set(moving.map((s) => s.id));
  return {
    ...trip,
    days: trip.days.map((day) => {
      const kept = day.stops.filter((s) => !ids.has(s.id));
      return day.id === toDayId ? { ...day, stops: [...kept, ...moving] } : { ...day, stops: kept };
    }),
  };
}
