"use client";

// The stop actions: Done, Do next, Move day, Remove, and swipe-to-remove with
// Undo. Each one changes the screen at once, then writes to Supabase; the
// realtime refetch brings everyone else (and this phone) back in line.

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  doNextChanges,
  endOfDay,
  patchMoveDay,
  patchPositions,
  patchStop,
} from "@/lib/stopEdits";
import { formatDate } from "@/lib/trip";
import type { Day, Stop, Trip } from "@/lib/types";

/** How long a swiped stop waits before it is really deleted. */
export const UNDO_MS = 5000;
const TOAST_MS = 4000;

export type ToastState = { key: number; text: string; undo?: () => void } | null;

export type StopEditApi = {
  toggleDone: (stop: Stop) => void;
  doNext: (stop: Stop) => void;
  moveTo: (stop: Stop, day: Day) => void;
  /** After the inline confirm: deleted now. */
  remove: (stop: Stop) => void;
  /** After a swipe: deleted when the Undo toast runs out. */
  swipeRemove: (stop: Stop) => void;
  /** Stops removed here, kept off screen even if a refetch still has them. */
  hidden: ReadonlySet<string>;
};

function shortTitle(stop: Stop) {
  return stop.title.length > 28 ? `${stop.title.slice(0, 26).trimEnd()}…` : stop.title;
}

function dayName(day: Day) {
  return formatDate(day.date).replace(",", "");
}

async function check(request: PromiseLike<{ error: unknown }>) {
  const { error } = await request;
  if (error) throw error;
}

export function useStopEdits({
  trip,
  setTrip,
  persist,
  reload,
}: {
  trip: Trip | null;
  setTrip: (update: (prev: Trip | null) => Trip | null) => void;
  /** False in the dev preview: change the screen only. */
  persist: boolean;
  /** Fetch the truth again after a failed write. */
  reload: () => void;
}) {
  const [toast, setToast] = useState<ToastState>(null);
  const [hidden, setHidden] = useState<ReadonlySet<string>>(new Set());
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef(new Map<string, { timer: ReturnType<typeof setTimeout>; run: () => void }>());
  const tripRef = useRef(trip);
  const hiddenRef = useRef(hidden);
  useEffect(() => {
    tripRef.current = trip;
    hiddenRef.current = hidden;
  });

  const show = useCallback((text: string, undo?: () => void) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ key: Date.now(), text, undo });
    toastTimer.current = setTimeout(() => setToast(null), undo ? UNDO_MS : TOAST_MS);
  }, []);

  const dismiss = useCallback(() => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(null);
  }, []);

  const hide = useCallback((id: string, on: boolean) => {
    setHidden((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const write = useCallback(
    (run: () => Promise<unknown>, onFail?: () => void) => {
      if (!persist) return;
      run().catch(() => {
        onFail?.();
        show("Couldn’t save that. Check your connection.");
        reload();
      });
    },
    [persist, reload, show],
  );

  const deleteNow = useCallback(
    (stop: Stop) => {
      write(
        () => check(supabase.from("stops").delete().eq("id", stop.id)),
        () => hide(stop.id, false),
      );
    },
    [write, hide],
  );

  // Leaving the page with an Undo still open: delete those now.
  useEffect(() => {
    const map = pending.current;
    const flush = () => {
      for (const { timer, run } of map.values()) {
        clearTimeout(timer);
        run();
      }
      map.clear();
    };
    const onHide = () => {
      if (document.visibilityState === "hidden") flush();
    };
    document.addEventListener("visibilitychange", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      flush();
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  const toggleDone = useCallback(
    (stop: Stop) => {
      const done = !stop.done;
      setTrip((prev) => prev && patchStop(prev, stop.id, { done }));
      write(() => check(supabase.from("stops").update({ done }).eq("id", stop.id)));
    },
    [setTrip, write],
  );

  const doNext = useCallback(
    (stop: Stop) => {
      const day = tripRef.current?.days.find((d) => d.id === stop.day_id);
      if (!day) return;
      const changes = doNextChanges(day, stop.id, hiddenRef.current);
      if (changes.length === 0) {
        show(`${shortTitle(stop)} is already next`);
        return;
      }
      setTrip((prev) => prev && patchPositions(prev, day.id, changes));
      show(`${shortTitle(stop)} is next`);
      write(() =>
        Promise.all(
          changes.map((c) => check(supabase.from("stops").update({ position: c.position }).eq("id", c.id))),
        ),
      );
    },
    [setTrip, show, write],
  );

  const moveTo = useCallback(
    (stop: Stop, day: Day) => {
      if (day.id === stop.day_id) return;
      const position = endOfDay(day);
      setTrip((prev) => prev && patchMoveDay(prev, stop.id, day.id, position));
      show(`Moved ${shortTitle(stop)} to ${dayName(day)}`);
      write(async () => {
        await check(supabase.from("stops").update({ day_id: day.id, position }).eq("id", stop.id));
        // Stops nested in it go along.
        await check(supabase.from("stops").update({ day_id: day.id }).eq("parent_stop_id", stop.id));
      });
    },
    [setTrip, show, write],
  );

  const remove = useCallback(
    (stop: Stop) => {
      hide(stop.id, true);
      show(`Removed ${shortTitle(stop)}`);
      deleteNow(stop);
    },
    [hide, show, deleteNow],
  );

  const swipeRemove = useCallback(
    (stop: Stop) => {
      hide(stop.id, true);
      const run = () => deleteNow(stop);
      const timer = setTimeout(() => {
        pending.current.delete(stop.id);
        run();
      }, UNDO_MS);
      pending.current.set(stop.id, { timer, run });
      show(`Removed ${shortTitle(stop)}`, () => {
        const entry = pending.current.get(stop.id);
        if (entry) clearTimeout(entry.timer);
        pending.current.delete(stop.id);
        hide(stop.id, false);
        dismiss();
      });
    },
    [hide, show, dismiss, deleteNow],
  );

  const api: StopEditApi = { toggleDone, doNext, moveTo, remove, swipeRemove, hidden };
  return { api, toast, dismiss, show };
}

/** The black pill above the tab bar. */
export function Toast({ toast }: { toast: ToastState }) {
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 z-40 flex justify-center px-4"
      style={{ bottom: "calc(86px + env(safe-area-inset-bottom, 0px))" }}
    >
      {toast && (
        <div
          key={toast.key}
          className="toast-in pointer-events-auto flex max-w-full items-center gap-3 rounded-full bg-ink py-2.5 pl-4 pr-3 text-[13px] text-white shadow-[0_10px_30px_rgba(17,17,17,0.25)]"
        >
          <span className="truncate">{toast.text}</span>
          {toast.undo && (
            <button
              type="button"
              onClick={toast.undo}
              className="shrink-0 rounded-full px-2 py-1 text-[13px] font-semibold text-accent focus-visible:outline-2 focus-visible:outline-accent"
            >
              Undo
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/** The small bottom sheet that picks a day. */
export function MoveDaySheet({
  stop,
  days,
  onPick,
  onClose,
}: {
  stop: Stop;
  days: Day[];
  onPick: (day: Day) => void;
  onClose: () => void;
}) {
  const sheet = useRef<HTMLDivElement>(null);
  useEffect(() => {
    sheet.current?.querySelector<HTMLButtonElement>("button[data-current='false']")?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const sorted = [...days].sort((a, b) => a.date.localeCompare(b.date));
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-ink/40"
        tabIndex={-1}
      />
      <div
        ref={sheet}
        role="dialog"
        aria-modal="true"
        aria-label={`Move ${stop.title} to another day`}
        className="sheet-in relative max-h-[70vh] w-full max-w-[440px] overflow-y-auto rounded-t-[28px] bg-panel px-4 pt-3"
        style={{ paddingBottom: "calc(16px + env(safe-area-inset-bottom, 0px))" }}
      >
        <div className="mx-auto h-1 w-10 rounded-full bg-line" aria-hidden />
        <p className="mt-4 px-1 font-mono text-[11px] uppercase tracking-wider text-muted">Move to</p>
        <p className="mt-0.5 px-1 text-[16px] font-semibold leading-snug">{stop.title}</p>
        <ul className="mt-3 space-y-1.5">
          {sorted.map((day, i) => {
            const current = day.id === stop.day_id;
            return (
              <li key={day.id}>
                <button
                  type="button"
                  data-current={current}
                  disabled={current}
                  onClick={() => onPick(day)}
                  className="flex w-full items-center gap-3 rounded-2xl bg-background px-3 py-2.5 text-left focus-visible:outline-2 focus-visible:outline-ink disabled:opacity-50"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-panel text-[14px] font-semibold tabular-nums">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-semibold uppercase">{dayName(day)}</span>
                    {day.title && <span className="block truncate text-[13px] text-muted">{day.title}</span>}
                  </span>
                  {current && <span className="font-mono text-[10px] uppercase text-muted">Now</span>}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
