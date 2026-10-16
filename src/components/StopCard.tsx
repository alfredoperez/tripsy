"use client";

// A stop on the itinerary: the row with its photo, the card it opens into,
// and swipe-left-to-remove.

import { useRef, useState } from "react";
import { CLAUDE_PROJECT_URL, stopMapUrl } from "@/lib/links";
import type { Stop } from "@/lib/types";
import {
  CheckIcon,
  ChevIcon,
  ClaudeIcon,
  GoogleMapsIcon,
  KindIcon,
  MoveIcon,
  NextIcon,
  TrashIcon,
} from "./icons";
import { Photo } from "./Photo";
import type { StopEditApi } from "./StopEdits";
import { CopyCode } from "./Tickets";

/** Past this share of the row's width, letting go removes the stop. */
const SWIPE_THRESHOLD = 0.4;
const COLLAPSE_MS = 250;

function reducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Drag the row left to remove it. Vertical drags scroll the page as usual,
 * and a drag never counts as a tap.
 */
export function SwipeRow({ onRemove, children }: { onRemove: () => void; children: React.ReactNode }) {
  const wrap = useRef<HTMLDivElement>(null);
  const layer = useRef<HTMLDivElement>(null);
  const drag = useRef({ down: false, x: 0, y: 0, dx: 0, horizontal: null as boolean | null, moved: false });
  const [gone, setGone] = useState(false);

  function setX(px: number | null, animate: boolean) {
    const el = layer.current;
    if (!el) return;
    el.style.transition = animate ? "" : "none";
    el.style.transform = px === null ? "" : `translateX(${px}px)`;
  }

  function onPointerDown(event: React.PointerEvent) {
    if (event.button !== 0 || gone) return;
    drag.current = { down: true, x: event.clientX, y: event.clientY, dx: 0, horizontal: null, moved: false };
  }

  function onPointerMove(event: React.PointerEvent) {
    const d = drag.current;
    if (!d.down) return;
    const dx = event.clientX - d.x;
    const dy = event.clientY - d.y;
    if (d.horizontal === null) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      d.horizontal = Math.abs(dx) > Math.abs(dy) && dx < 0;
      if (!d.horizontal) {
        d.down = false;
        return;
      }
      d.moved = true;
      try {
        layer.current?.setPointerCapture(event.pointerId);
      } catch {
        // The pointer is already gone; the drag still works without capture.
      }
    }
    d.dx = Math.min(0, dx);
    setX(d.dx, false);
  }

  function onPointerEnd() {
    const d = drag.current;
    if (!d.down) return;
    d.down = false;
    if (!d.horizontal) return;
    const width = wrap.current?.offsetWidth ?? 1;
    if (d.dx < -width * SWIPE_THRESHOLD) {
      const el = layer.current;
      if (el) {
        el.style.transition = "";
        el.style.transform = "translateX(-100%)";
      }
      if (reducedMotion()) {
        onRemove();
        return;
      }
      if (wrap.current) wrap.current.style.maxHeight = `${wrap.current.offsetHeight}px`;
      requestAnimationFrame(() => setGone(true));
      setTimeout(onRemove, COLLAPSE_MS);
    } else {
      setX(null, true);
    }
  }

  return (
    <div ref={wrap} className={`swipe ${gone ? "swipe-gone" : ""}`}>
      <div className="swipe-bg" aria-hidden>
        <TrashIcon className="h-5 w-5" />
        Remove
      </div>
      <div
        ref={layer}
        className="swipe-layer"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        onClickCapture={(event) => {
          if (drag.current.moved) {
            event.preventDefault();
            event.stopPropagation();
            drag.current.moved = false;
          }
        }}
      >
        {children}
      </div>
    </div>
  );
}

function Tag({ children, tone }: { children: React.ReactNode; tone: "lime" | "ink" }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wider ${
        tone === "lime" ? "bg-accent text-ink" : "bg-ink text-white"
      }`}
    >
      {children}
    </span>
  );
}

/** The tappable row: photo, time, title, one line of note, the chevron. */
export function StopRowButton({
  stop,
  open,
  panelId,
  onToggle,
  flash,
}: {
  stop: Stop;
  open: boolean;
  panelId: string;
  onToggle: () => void;
  /** Just changed on another phone. */
  flash?: boolean;
}) {
  return (
    <button
      type="button"
      aria-expanded={open}
      aria-controls={panelId}
      onClick={onToggle}
      className={`grid w-full cursor-pointer grid-cols-[64px_1fr_auto] items-center gap-3 bg-panel px-[18px] py-3 text-left focus-visible:rounded-[18px] focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-ink ${
        flash ? "just-changed-solid" : ""
      }`}
    >
      <Photo url={stop.image_url} kind={stop.kind} className="h-16 w-16 rounded-[18px]">
        <span className="absolute bottom-1 left-1 flex h-6 w-6 items-center justify-center rounded-full bg-panel text-ink">
          <KindIcon kind={stop.kind} className="h-3.5 w-3.5" />
        </span>
      </Photo>
      <span className="min-w-0">
        {(stop.time_label || stop.booked || stop.done) && (
          <span className="flex items-center gap-1.5">
            {stop.time_label && (
              <span className="font-mono text-[11px] uppercase text-muted">{stop.time_label}</span>
            )}
            {stop.done && <Tag tone="ink">Done</Tag>}
            {stop.booked && <Tag tone="lime">Booked</Tag>}
          </span>
        )}
        <span
          className={`mt-0.5 block text-[16px] font-semibold leading-snug [overflow-wrap:anywhere] ${
            stop.done ? "text-faint line-through" : ""
          }`}
        >
          {stop.title}
        </span>
        {(stop.note || stop.address) && (
          <span className="mt-0.5 block truncate text-[13px] text-muted">{stop.note || stop.address}</span>
        )}
      </span>
      <span
        aria-hidden
        className={`flex h-[30px] w-[30px] items-center justify-center rounded-full transition-transform duration-200 ${
          open ? "rotate-180 bg-ink text-white" : "bg-paper text-ink"
        }`}
      >
        <ChevIcon className="h-4 w-4" />
      </span>
    </button>
  );
}

function weekday(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString("en-US", { weekday: "long" });
}

/** What a stop opens into: photo, note, address, the two big links, the four actions. */
export function StopDetails({
  stop,
  id,
  dayDate,
  api,
  onMove,
  ticket,
}: {
  stop: Stop;
  id: string;
  dayDate: string;
  api: StopEditApi;
  onMove: () => void;
  /** Boarding passes and hotel cards show their own note, address and code. */
  ticket?: boolean;
}) {
  const [confirming, setConfirming] = useState(false);
  const short = stop.title.length > 24 ? `${stop.title.slice(0, 22).trimEnd()}…` : stop.title;
  const action =
    "grid cursor-pointer justify-items-center gap-1 rounded-2xl bg-panel px-1 pb-2 pt-2.5 text-[11px] font-medium text-ink focus-visible:outline-2 focus-visible:outline-ink active:scale-[0.97] motion-reduce:active:scale-100";

  return (
    <div id={id} className={`${ticket ? "mt-2" : "mx-3 mb-2.5"} overflow-hidden rounded-[22px] bg-paper`}>
      {!ticket && <Photo url={stop.image_url} kind={stop.kind} className="h-[190px] w-full" />}
      <div className="px-4 pb-4 pt-3">
        {!ticket && stop.note && <p className="text-[14px] leading-normal text-muted">{stop.note}</p>}
        {!ticket && stop.address && (
          <p className="mt-1.5 font-mono text-[11px] leading-snug text-faint">{stop.address}</p>
        )}
        {!ticket && stop.booking_code && (
          <div className="mt-3 inline-block max-w-full rounded-2xl bg-panel px-3 py-2">
            <CopyCode code={stop.booking_code} tone="light" />
          </div>
        )}
        <div className={`${ticket ? "" : "mt-3.5"} grid grid-cols-2 gap-2`}>
          <a
            href={stopMapUrl(stop)}
            target="_blank"
            rel="noreferrer"
            className="flex h-[46px] items-center justify-center gap-2 rounded-full bg-ink text-[14px] font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            <GoogleMapsIcon className="h-[18px] w-[18px] shrink-0" />
            Google Maps
          </a>
          <a
            href={CLAUDE_PROJECT_URL}
            target="_blank"
            rel="noreferrer"
            className="flex h-[46px] items-center justify-center gap-2 rounded-full bg-accent text-[14px] font-semibold text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            <ClaudeIcon className="h-[18px] w-[18px] shrink-0" />
            Ask Claude
          </a>
        </div>
        <div className="mt-2 grid grid-cols-4 gap-1.5">
          <button
            type="button"
            aria-pressed={stop.done}
            onClick={() => api.toggleDone(stop)}
            className={`${action} ${stop.done ? "!bg-ink !text-white" : ""}`}
          >
            <CheckIcon className="h-5 w-5" />
            Done
          </button>
          <button type="button" onClick={() => api.doNext(stop)} className={action}>
            <NextIcon className="h-5 w-5" />
            Do next
          </button>
          <button type="button" onClick={onMove} className={action}>
            <MoveIcon className="h-5 w-5" />
            Move day
          </button>
          <button
            type="button"
            aria-expanded={confirming}
            onClick={() => setConfirming(true)}
            className={`${action} !text-danger`}
          >
            <TrashIcon className="h-5 w-5" />
            Remove
          </button>
        </div>
        {confirming && (
          <div className="mt-2 flex items-center justify-between gap-2 rounded-2xl bg-panel p-3 text-[13px]">
            <span className="min-w-0">
              Remove {short} from {weekday(dayDate)}?
            </span>
            <span className="flex shrink-0 gap-1.5">
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="rounded-full bg-paper px-3 py-2 text-[12px] font-semibold focus-visible:outline-2 focus-visible:outline-ink"
              >
                Keep
              </button>
              <button
                type="button"
                onClick={() => api.remove(stop)}
                className="rounded-full bg-danger px-3 py-2 text-[12px] font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-danger"
              >
                Remove
              </button>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * A boarding pass or hotel card that opens on tap like a row, keeping its
 * ticket look. Taps on its own links and the code button do their own thing.
 */
export function TicketShell({
  title,
  open,
  panelId,
  onToggle,
  children,
}: {
  title: string;
  open: boolean;
  panelId: string;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="relative">
      <div
        className="cursor-pointer"
        onClick={(event) => {
          if ((event.target as HTMLElement).closest("a, button")) return;
          onToggle();
        }}
      >
        {children}
      </div>
      {/* Keyboard and screen readers: the same toggle as a real button. */}
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={onToggle}
        className="sr-only focus:not-sr-only focus:mt-2 focus:block focus:w-full focus:rounded-full focus:bg-ink focus:px-4 focus:py-2.5 focus:text-[13px] focus:font-semibold focus:text-white"
      >
        {open ? "Hide" : "Show"} actions for {title}
      </button>
    </div>
  );
}
