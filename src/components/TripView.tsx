"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { hotelName, isCheckOut, mapsSearch, parseFlight } from "@/lib/tickets";
import type { Day, Leg, Stop, StopKind, Trip } from "@/lib/types";
import { CopyCode, FlightTicket, HotelTicket } from "./Tickets";

const KIND_ICON: Record<StopKind, string> = {
  travel: "✈️",
  eat: "🍽️",
  coffee: "☕",
  work: "💻",
  hike: "🥾",
  see: "🏛️",
  stay: "🛏️",
  brewery: "🍺",
};

const HIGHLIGHT_MS = 4000;

function todayIn(timezone: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(new Date());
}

function formatDate(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function shortDate(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

async function fetchTrip(slug: string) {
  const { data } = await supabase
    .from("trips")
    .select("*, legs(*), days(*, stops(*))")
    .eq("slug", slug)
    .maybeSingle();
  return data as Trip | null;
}

export function TripView({ slug }: { slug: string }) {
  const [trip, setTrip] = useState<Trip | null>(null);
  const [missing, setMissing] = useState(false);
  const [live, setLive] = useState(false);
  const [showPast, setShowPast] = useState(false);
  const [changed, setChanged] = useState<Set<string>>(new Set());
  const todayRef = useRef<HTMLElement | null>(null);
  const scrolled = useRef(false);

  useEffect(() => {
    let cancelled = false;
    fetchTrip(slug).then((data) => {
      if (cancelled) return;
      if (data) setTrip(data);
      else setMissing(true);
    });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const tripId = trip?.id;

  useEffect(() => {
    if (!tripId) return;

    const flag = (id: string) => {
      setChanged((prev) => new Set(prev).add(id));
      setTimeout(() => {
        setChanged((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }, HIGHLIGHT_MS);
    };

    const channel = supabase.channel(`trip-${tripId}`);
    for (const table of ["stops", "days", "legs"]) {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table, filter: `trip_id=eq.${tripId}` },
        (payload) => {
          const row = payload.new as { id?: string };
          if (row.id) flag(row.id);
          fetchTrip(slug).then((data) => data && setTrip(data));
        },
      );
    }
    channel.subscribe((status) => setLive(status === "SUBSCRIBED"));

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tripId, slug]);

  const today = trip ? todayIn(trip.timezone) : "";

  const visibleCount = useMemo(() => {
    if (!trip) return 0;
    return showPast ? trip.days.length : trip.days.filter((day) => day.date >= today).length;
  }, [trip, showPast, today]);

  useEffect(() => {
    if (scrolled.current || !todayRef.current) return;
    scrolled.current = true;
    todayRef.current.scrollIntoView({ block: "start" });
  }, [visibleCount]);

  if (missing) {
    return <p className="p-8 text-muted">No trip called “{slug}”.</p>;
  }
  if (!trip) {
    return (
      <p className="p-8 font-mono text-xs uppercase tracking-widest text-muted">Loading…</p>
    );
  }

  return (
    <TripScreen
      trip={trip}
      today={today}
      live={live}
      showPast={showPast}
      onTogglePast={() => setShowPast((value) => !value)}
      changed={changed}
      todayRef={todayRef}
    />
  );
}

/** The trip page itself, from data alone. Also rendered by the dev preview. */
export function TripScreen({
  trip,
  today,
  live,
  showPast,
  onTogglePast,
  changed,
  todayRef,
}: {
  trip: Trip;
  today: string;
  live: boolean;
  showPast: boolean;
  onTogglePast: () => void;
  changed: Set<string>;
  todayRef?: React.Ref<HTMLElement>;
}) {
  const days = [...trip.days].sort((a, b) => a.date.localeCompare(b.date));
  const pastDays = days.filter((day) => day.date < today);
  const visibleDays = showPast ? days : days.filter((day) => day.date >= today);
  const lodgingDays = lodgingByDay(trip.legs ?? [], days);
  const shortSubtitle = trip.subtitle && trip.subtitle.length <= 32;

  return (
    <main className="mx-auto w-full max-w-2xl px-4 pb-24 pt-5">
      <div className="flex items-center justify-between">
        <Link
          href="/"
          aria-label="All trips"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-panel text-ink"
        >
          <svg viewBox="0 0 24 24" aria-hidden className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18 9 12l6-6" />
          </svg>
        </Link>
        <div
          className={`flex items-center gap-2 rounded-full px-3 py-2 font-mono text-[11px] uppercase tracking-widest ${
            live ? "bg-ink text-white" : "bg-panel text-muted"
          }`}
        >
          <span className={`h-2 w-2 rounded-full ${live ? "bg-live" : "bg-faint"}`} aria-hidden />
          {live ? "Live" : "Connecting"}
        </div>
      </div>

      <h1 className="headline mt-8 text-[clamp(2.4rem,12vw,3.75rem)] [overflow-wrap:anywhere]">
        {trip.title}
      </h1>
      {trip.subtitle &&
        (shortSubtitle ? (
          <p className="headline-light mt-1 text-[clamp(1.5rem,7vw,2.25rem)]">{trip.subtitle}</p>
        ) : (
          <p className="mt-3 text-[15px] font-light leading-snug text-muted">{trip.subtitle}</p>
        ))}

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-accent px-3.5 py-1.5 text-[13px] font-semibold uppercase tracking-wide text-ink">
          {shortDate(trip.start_date)} → {shortDate(trip.end_date)}
        </span>
        <span className="rounded-full bg-panel px-3.5 py-1.5 text-[13px] font-medium uppercase tracking-wide text-muted">
          {days.length} days
        </span>
      </div>

      {pastDays.length > 0 && (
        <button
          type="button"
          onClick={onTogglePast}
          className="mt-8 w-full rounded-full bg-ink px-5 py-3.5 text-[13px] font-semibold uppercase tracking-wider text-white"
        >
          {showPast ? "Hide" : "Show"} past days · {pastDays.length}
        </button>
      )}

      <div className="mt-6 space-y-4">
        {visibleDays.map((day) => (
          <DayCard
            key={day.id}
            day={day}
            number={days.indexOf(day) + 1}
            isToday={day.date === today}
            isPast={day.date < today}
            changed={changed}
            lodging={lodgingDays.get(day.id)}
            sectionRef={day.date === today ? todayRef : undefined}
          />
        ))}
        {visibleDays.length === 0 && (
          <p className="text-muted">This trip is over. Show past days to look back.</p>
        )}
      </div>
    </main>
  );
}

/**
 * A leg's hotel shows as a card on the first day of that leg, unless the leg
 * already has a `stay` stop, which renders its own card.
 */
function lodgingByDay(legs: Leg[], days: Day[]) {
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

function DayCard({
  day,
  number,
  isToday,
  isPast,
  changed,
  lodging,
  sectionRef,
}: {
  day: Day;
  number: number;
  isToday: boolean;
  isPast: boolean;
  changed: Set<string>;
  lodging?: Leg;
  sectionRef?: React.Ref<HTMLElement>;
}) {
  const stops = [...day.stops].sort((a, b) => a.position - b.position);
  const topLevel = stops.filter((stop) => !stop.parent_stop_id);
  const [weekday, ...rest] = formatDate(day.date).split(" ");

  return (
    <section
      ref={sectionRef}
      className={`scroll-mt-4 overflow-hidden rounded-[28px] bg-panel ${
        isToday ? "ring-2 ring-ink" : ""
      } ${isPast ? "opacity-60" : ""} ${changed.has(day.id) ? "just-changed" : ""}`}
    >
      <header className="flex items-center gap-4 px-5 pb-4 pt-5">
        <div
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-[17px] font-semibold tabular-nums ${
            isToday ? "bg-accent text-ink" : "bg-background text-ink"
          }`}
        >
          {String(number).padStart(2, "0")}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <h2 className="headline text-[26px]">{weekday.replace(",", "")}</h2>
            <span className="headline-light text-[22px]">{rest.join(" ")}</span>
          </div>
          {day.title && (
            <p className="mt-1 text-[14px] font-light leading-snug text-muted">{day.title}</p>
          )}
        </div>
        {isToday ? (
          <span className="shrink-0 self-start rounded-full bg-accent px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-wider text-ink">
            Today
          </span>
        ) : (
          day.kind && (
            <span className="shrink-0 self-start rounded-full bg-background px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-muted">
              {day.kind}
            </span>
          )
        )}
      </header>
      <ul className="divide-y divide-line pb-1">
        {topLevel.map((stop) => (
          <StopItem
            key={stop.id}
            stop={stop}
            nested={stops.filter((child) => child.parent_stop_id === stop.id)}
            changed={changed}
          />
        ))}
        {lodging && (
          <li className={`px-3 py-3 ${changed.has(lodging.id) ? "just-changed" : ""}`}>
            <HotelTicket
              label="Your base"
              name={lodging.lodging_name ?? ""}
              time={
                lodging.start_date && lodging.end_date
                  ? `${shortDate(lodging.start_date)} → ${shortDate(lodging.end_date)}`
                  : null
              }
              address={lodging.lodging_address}
              bookingCode={lodging.lodging_booking_code}
              mapUrl={
                lodging.lodging_map_url ||
                mapsSearch(lodging.lodging_address || lodging.lodging_name || "")
              }
            />
          </li>
        )}
        {topLevel.length === 0 && !lodging && (
          <li className="px-5 py-4 text-sm text-muted">Nothing planned.</li>
        )}
      </ul>
    </section>
  );
}

/** Picks the boarding pass, the hotel card, or a plain row for a stop. */
function StopItem({
  stop,
  nested,
  changed,
}: {
  stop: Stop;
  nested: Stop[];
  changed: Set<string>;
}) {
  const flight = parseFlight(stop);
  const isStay = stop.kind === "stay";
  if (!flight && !isStay) return <StopRow stop={stop} nested={nested} changed={changed} />;

  const name = hotelName(stop.title);
  return (
    <li className={`px-3 py-3 ${changed.has(stop.id) ? "just-changed" : ""}`}>
      {flight ? (
        <FlightTicket
          flight={flight}
          bookingCode={stop.booking_code}
          mapUrl={stop.map_url || mapsSearch(`${flight.from} airport`)}
          note={stop.note}
          booked={stop.booked}
          done={stop.done}
        />
      ) : (
        <HotelTicket
          label={isCheckOut(stop.title) ? "Check-out" : "Check-in"}
          name={name}
          time={stop.time_label}
          address={stop.address}
          note={stop.note}
          bookingCode={stop.booking_code}
          mapUrl={stop.map_url || mapsSearch(stop.address || name)}
          booked={stop.booked}
          done={stop.done}
        />
      )}
      {nested.length > 0 && (
        <div className="px-2 pt-3">
          <NestedStops nested={nested} changed={changed} />
        </div>
      )}
    </li>
  );
}

function StopRow({
  stop,
  nested,
  changed,
}: {
  stop: Stop;
  nested: Stop[];
  changed: Set<string>;
}) {
  return (
    <li className={`px-5 py-4 ${changed.has(stop.id) ? "just-changed" : ""}`}>
      <div className="flex gap-3.5">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-background text-[17px]"
          aria-hidden
        >
          {KIND_ICON[stop.kind]}
        </div>
        <div className="min-w-0 flex-1">
          {stop.time_label && (
            <div className="font-mono text-[11px] font-medium uppercase tracking-wide text-muted">
              {stop.time_label}
            </div>
          )}
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <span
                className={`text-[16px] font-semibold leading-snug ${
                  stop.done ? "text-muted line-through" : ""
                }`}
              >
                {stop.title}
              </span>
              {(stop.done || stop.booked) && (
                <span className="ml-2 inline-flex -translate-y-px gap-1 align-middle">
                  {stop.done && <Tag tone="ink">Done</Tag>}
                  {stop.booked && <Tag tone="lime">Booked</Tag>}
                </span>
              )}
            </div>
            {stop.map_url && (
              <a
                href={stop.map_url}
                target="_blank"
                rel="noreferrer"
                aria-label={`${stop.title} on the map`}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink text-accent"
              >
                <svg viewBox="0 0 24 24" aria-hidden className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M7 17 17 7M8 7h9v9" />
                </svg>
              </a>
            )}
          </div>
          {stop.note && (
            <p className="mt-1 text-[14px] font-light leading-snug text-muted">{stop.note}</p>
          )}
          {stop.address && (
            <p className="mt-1 font-mono text-[11px] leading-snug text-faint">{stop.address}</p>
          )}
          {stop.booking_code && (
            <div className="mt-2 inline-block max-w-full rounded-2xl bg-background px-3 py-2">
              <CopyCode code={stop.booking_code} tone="light" />
            </div>
          )}
          {nested.length > 0 && (
            <div className="mt-3">
              <NestedStops nested={nested} changed={changed} />
            </div>
          )}
        </div>
      </div>
    </li>
  );
}

function NestedStops({ nested, changed }: { nested: Stop[]; changed: Set<string> }) {
  return (
    <ul className="space-y-1.5">
      {nested.map((child) => (
        <li
          key={child.id}
          className={`flex gap-2.5 rounded-2xl bg-background px-3 py-2.5 text-[14px] ${
            changed.has(child.id) ? "just-changed" : ""
          }`}
        >
          <span aria-hidden>{KIND_ICON[child.kind]}</span>
          <span className="min-w-0">
            <span className="font-semibold">{child.title}</span>
            {child.note && <span className="font-light text-muted"> · {child.note}</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}

function Tag({ children, tone }: { children: React.ReactNode; tone: "lime" | "ink" }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider ${
        tone === "lime" ? "bg-accent text-ink" : "bg-ink text-white"
      }`}
    >
      {children}
    </span>
  );
}
