"use client";

import { useEffect, useRef, useState } from "react";
import type { Flight } from "@/lib/tickets";

/** A booking code, big, that copies itself when tapped. */
export function CopyCode({
  code,
  label = "Booking",
  tone,
}: {
  code: string;
  label?: string;
  tone: "dark" | "light";
}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked: the code is on screen and selectable anyway.
    }
  }

  const dark = tone === "dark";
  return (
    <button
      type="button"
      onClick={copy}
      aria-label={`Copy ${label.toLowerCase()} code ${code}`}
      className="min-w-0 select-text text-left active:scale-[0.97] motion-reduce:active:scale-100"
    >
      <span
        className={`block font-mono text-[10px] uppercase tracking-[0.18em] ${
          dark ? "text-white/45" : "text-muted"
        }`}
        aria-live="polite"
      >
        {copied ? "Copied ✓" : label}
      </span>
      <span className="flex items-center gap-1.5">
        <span
          className={`block truncate font-mono text-[22px] font-semibold leading-tight tracking-wider ${
            dark ? "text-accent" : "text-ink"
          }`}
        >
          {code}
        </span>
        <svg viewBox="0 0 24 24" aria-hidden className={`h-4 w-4 shrink-0 ${dark ? "text-white/40" : "text-faint"}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="9" y="9" width="11" height="11" rx="2.5" />
          <path d="M5 15V6a2 2 0 0 1 2-2h8" />
        </svg>
      </span>
    </button>
  );
}

function PlaneIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className} fill="currentColor">
      <path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5Z" />
    </svg>
  );
}

function ArrowIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 17 17 7M8 7h9v9" />
    </svg>
  );
}

function StatusPills({ booked, done, dark }: { booked?: boolean; done?: boolean; dark: boolean }) {
  if (!booked && !done) return null;
  return (
    <div className="flex gap-1.5">
      {booked && (
        <span className="rounded-full bg-accent px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-wider text-ink">
          Booked
        </span>
      )}
      {done && (
        <span
          className={`rounded-full px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-wider ${
            dark ? "bg-white text-ink" : "bg-ink text-white"
          }`}
        >
          Done
        </span>
      )}
    </div>
  );
}

export function FlightTicket({
  flight,
  bookingCode,
  mapUrl,
  note,
  booked,
  done,
}: {
  flight: Flight;
  bookingCode: string | null;
  mapUrl: string;
  note: string | null;
  booked: boolean;
  done: boolean;
}) {
  const carrier = [flight.airline, flight.flightNumber].filter(Boolean).join(" · ");
  return (
    <article
      aria-label={`Flight ${flight.from} to ${flight.to}`}
      className={`ticket bg-ink text-white ${done ? "opacity-55" : ""}`}
      style={{ "--notch-y": "76px" } as React.CSSProperties}
    >
      <div className="px-5 pb-5 pt-4">
        <div className="flex min-h-8 items-center justify-between gap-2">
          <StatusPills booked={booked} done={done} dark />
          <a
            href={mapUrl}
            target="_blank"
            rel="noreferrer"
            aria-label={`${flight.from} airport on Google Maps`}
            className="ml-auto flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white"
          >
            <ArrowIcon className="h-4 w-4" />
          </a>
        </div>

        <div className="mt-2 grid grid-cols-[1fr_auto_1fr] items-start gap-2">
          <div className="min-w-0">
            <div className="text-[34px] font-semibold leading-none tracking-tight">({flight.from})</div>
            {flight.fromCity && (
              <div className="mt-1.5 truncate text-[13px] text-white/55">{flight.fromCity}</div>
            )}
          </div>
          <div className="pt-3 text-center font-mono text-[11px] text-white/45">
            {flight.duration ?? ""}
          </div>
          <div className="min-w-0 text-right">
            <div className="text-[34px] font-semibold leading-none tracking-tight">({flight.to})</div>
            {flight.toCity && (
              <div className="mt-1.5 truncate text-[13px] text-white/55">{flight.toCity}</div>
            )}
          </div>
        </div>

        <div className="mt-5 flex items-center gap-3">
          {flight.depart && (
            <span className="shrink-0 text-[15px] font-semibold tabular-nums">{flight.depart}</span>
          )}
          <div className="relative flex h-6 flex-1 items-center" aria-hidden>
            <span className="h-1.5 w-1.5 rounded-full bg-white/50" />
            <span className="mx-1 flex-1 border-t border-dashed border-white/30" />
            <span className="h-1.5 w-1.5 rounded-full bg-white/50" />
            <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-ink px-1.5">
              <PlaneIcon className="h-5 w-5 rotate-90 text-accent" />
            </span>
          </div>
          {flight.arrive && (
            <span className="shrink-0 text-[15px] font-semibold tabular-nums">{flight.arrive}</span>
          )}
        </div>

        {note && <p className="mt-4 line-clamp-3 text-[13px] leading-snug text-white/50">{note}</p>}
      </div>

      <div className="mx-5 border-t border-dashed border-white/15" />

      <div className="flex h-[76px] items-center justify-between gap-3 px-5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-ink">
            <PlaneIcon className="h-5 w-5" />
          </span>
          <span className="truncate text-[14px] text-white/80">{carrier || "Boarding pass"}</span>
        </div>
        {bookingCode && (
          <div className="shrink-0 text-right">
            <CopyCode code={bookingCode} tone="dark" />
          </div>
        )}
      </div>
    </article>
  );
}

export function HotelTicket({
  label,
  name,
  time,
  address,
  note,
  bookingCode,
  mapUrl,
  booked,
  done,
  children,
}: {
  label: string;
  name: string;
  time?: string | null;
  address?: string | null;
  note?: string | null;
  bookingCode?: string | null;
  mapUrl: string;
  booked?: boolean;
  done?: boolean;
  /** Extra lines under the address, such as travel times. */
  children?: React.ReactNode;
}) {
  return (
    <article
      aria-label={`${label}: ${name}`}
      className={`ticket bg-paper text-ink ${done ? "opacity-55" : ""}`}
      style={{ "--notch-y": "76px" } as React.CSSProperties}
    >
      <div className="px-5 pb-5 pt-4">
        <div className="flex min-h-8 flex-wrap items-center gap-1.5">
          <span className="rounded-full bg-ink px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-wider text-accent">
            {label}
          </span>
          <StatusPills booked={booked} done={done} dark={false} />
          {time && (
            <span className="ml-auto font-mono text-[12px] font-medium uppercase text-muted">{time}</span>
          )}
        </div>
        <h3 className="headline mt-4 text-[26px] [overflow-wrap:anywhere]">{name}</h3>
        {address && <p className="mt-2 text-[14px] font-light leading-snug text-muted">{address}</p>}
        {note && <p className="mt-2 text-[13px] leading-snug text-muted">{note}</p>}
        {children}
      </div>

      <div className="mx-5 border-t border-dashed border-ink/15" />

      <div className="flex h-[76px] items-center justify-between gap-3 px-5">
        <div className="min-w-0">
          {bookingCode ? (
            <CopyCode code={bookingCode} tone="light" />
          ) : (
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">Hotel</span>
          )}
        </div>
        <a
          href={mapUrl}
          target="_blank"
          rel="noreferrer"
          className="flex shrink-0 items-center gap-1.5 rounded-full bg-ink py-2.5 pl-4 pr-3 text-[13px] font-semibold uppercase tracking-wide text-white"
        >
          Directions
          <ArrowIcon className="h-4 w-4 text-accent" />
        </a>
      </div>
    </article>
  );
}
