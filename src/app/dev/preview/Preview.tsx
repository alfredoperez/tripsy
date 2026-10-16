"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { fakeTravel, type NearbyApi, type Place, type TravelResult } from "@/components/Distance";
import { nearbyPlaces, NearbyScreen } from "@/components/Nearby";
import { dayPairs, type RouteApi } from "@/components/Routes";
import { TripList } from "@/components/TripList";
import { TripScreen } from "@/components/TripView";
import { coordsFromMapUrl, crowFlies, type LatLng } from "@/lib/mapbox";
import type { Day, Stop, Trip } from "@/lib/types";

let n = 0;
function stop(day_id: string, fields: Partial<Stop> & Pick<Stop, "kind" | "title">): Stop {
  n += 1;
  return {
    id: `s${n}`,
    day_id,
    parent_stop_id: null,
    position: n,
    time_label: null,
    note: null,
    address: null,
    map_url: null,
    booking_code: null,
    booked: false,
    done: false,
    image_path: null,
    lat: null,
    lng: null,
    ...fields,
  };
}

const trip: Trip = {
  id: "t1",
  slug: "guadalajara",
  title: "Guadalajara",
  subtitle: "Tacos, tequila & work",
  start_date: "2026-10-26",
  end_date: "2026-11-04",
  timezone: "America/Mexico_City",
  legs: [
    {
      id: "l1",
      position: 1,
      title: "Guadalajara",
      start_date: "2026-10-27",
      end_date: "2026-11-01",
      lodging_name: "Hotel Antré",
      lodging_address: "Av. Vallarta 1390, Guadalajara",
      lodging_map_url: null,
      lodging_booking_code: "90210",
    },
    {
      id: "l2",
      position: 2,
      title: "Tequila",
      start_date: "2026-11-01",
      end_date: "2026-11-04",
      lodging_name: "Casa Dulce María",
      lodging_address: "Calle Juárez 34, Tequila, Jalisco",
      lodging_map_url: null,
      lodging_booking_code: null,
    },
  ],
  days: [
    {
      id: "d0",
      leg_id: null,
      date: "2026-10-26",
      title: "Pack and prep",
      kind: "home",
      summary: null,
      stops: [stop("d0", { kind: "work", title: "Print boarding passes", done: true })],
    },
    {
      id: "d1",
      leg_id: "l1",
      date: "2026-10-27",
      title: "Fly down, settle in",
      kind: "travel",
      summary: null,
      stops: [
        stop("d1", { kind: "travel", title: "Uber to the airport", time_label: "1:30 PM", note: "Leave 2h early" }),
        stop("d1", {
          kind: "travel",
          title: "Volaris flight SAT→GDL",
          time_label: "3:48 PM CT",
          note: "Y4 1517 · arr 6:05 PM · carry-on only",
          booking_code: "XK42TR",
          booked: true,
        }),
        stop("d1", {
          kind: "stay",
          title: "Check in at Hotel Antré",
          time_label: "~7:30 PM",
          address: "Av. Vallarta 1390, Guadalajara",
          booking_code: "90210",
          booked: true,
          lat: 20.674,
          lng: -103.368,
        }),
        stop("d1", { kind: "eat", title: "Tacos at Karnes Garibaldi", time_label: "9 PM", note: "Carne en su jugo", map_url: "https://www.google.com/maps/place/x/@20.6857,-103.3533,17z" }),
      ],
    },
    {
      id: "d2",
      leg_id: "l1",
      date: "2026-10-28",
      title: "Centro walking loop",
      kind: "explore",
      summary: null,
      stops: [
        stop("d2", { kind: "coffee", title: "Café Palreal", time_label: "8:30 AM", lat: 20.6747, lng: -103.364 }),
        stop("d2", { kind: "see", title: "Centro Histórico loop", time_label: "10 AM", note: "About 3 km", lat: 20.6767, lng: -103.3475 }),
        { ...stop("d2", { kind: "see", title: "Catedral", lat: 20.6774, lng: -103.3473 }), parent_stop_id: "s7" },
        { ...stop("d2", { kind: "see", title: "Hospicio Cabañas", note: "Orozco murals", lat: 20.677, lng: -103.3389 }), parent_stop_id: "s7" },
        stop("d2", { kind: "eat", title: "Mercado San Juan de Dios", time_label: "1 PM", note: "Birria upstairs", lat: 20.6743, lng: -103.3386 }),
        stop("d2", { kind: "coffee", title: "Café Benito", time_label: "4 PM", lat: 20.6731, lng: -103.3647 }),
        stop("d2", { kind: "brewery", title: "Cervecería Colimita", time_label: "7 PM", lat: 20.6697, lng: -103.3741 }),
      ],
    },
    {
      id: "d3",
      leg_id: "l2",
      date: "2026-11-01",
      title: "To Tequila",
      kind: "travel",
      summary: null,
      stops: [
        stop("d3", { kind: "travel", title: "Bus to Tequila", time_label: "10 AM" }),
        stop("d3", { kind: "eat", title: "Lunch somewhere in town", time_label: "2 PM" }),
        stop("d3", { kind: "see", title: "Mundo Cuervo distillery tour", time_label: "4 PM", lat: 20.8826, lng: -103.8358 }),
        stop("d3", { kind: "brewery", title: "La Cantina", time_label: "8 PM", lat: 20.8818, lng: -103.8371 }),
      ],
    },
    {
      id: "d4",
      leg_id: "l2",
      date: "2026-11-04",
      title: "Home",
      kind: "travel",
      summary: null,
      stops: [
        stop("d4", { kind: "travel", title: "Flight home: GDL to SAT", time_label: "5:20 PM" }),
      ],
    },
  ],
};

// Fake "you are here" in Colonia Americana, and the one place with no coordinates.
const ME: LatLng = { lat: 20.6736, lng: -103.37 };
const FAKE_COORDS: Record<string, LatLng> = { l2: { lat: 20.882, lng: -103.837 } };

function pointOf(s: Stop): LatLng | null {
  if (s.lat != null && s.lng != null) return { lat: s.lat, lng: s.lng };
  return coordsFromMapUrl(s.map_url);
}

/** Stop-to-stop times without a token: d2 starts routed, the rest route on tap. */
function useFakeRoutes(): RouteApi {
  const [routed, setRouted] = useState<ReadonlySet<string>>(() => new Set(["d2"]));
  const [busy, setBusy] = useState<string | null>(null);
  useEffect(() => {
    if (!busy) return;
    const timer = setTimeout(() => {
      setRouted((prev) => new Set(prev).add(busy));
      setBusy(null);
    }, 1200);
    return () => clearTimeout(timer);
  }, [busy]);

  return {
    connector: (a, b) => {
      const from = pointOf(a);
      const to = pointOf(b);
      if (!from || !to || crowFlies(from, to) < 40) return null;
      if (routed.has(a.day_id)) return { status: "done", travel: fakeTravel(from, to) };
      return busy === a.day_id ? { status: "loading" } : null;
    },
    dayState: (day: Day) => ({
      canRoute: !routed.has(day.id) && dayPairs(day).length > 0,
      busy: busy === day.id,
      message: day.id === "d3" && routed.has("d3") ? "Couldn’t place 1 stop on the map." : null,
    }),
    routeDay: (day) => setBusy(day.id),
  };
}

type NearMode = "idle" | "locating" | "done" | "denied";

function fakeResults(places: Place[]): Record<string, TravelResult> {
  const results: Record<string, TravelResult> = {};
  for (const place of places) {
    const point = place.coords ?? coordsFromMapUrl(place.mapUrl) ?? FAKE_COORDS[place.id];
    results[place.id] = point ? { status: "done", travel: fakeTravel(ME, point) } : { status: "none" };
  }
  return results;
}

/** Nearby without a token or GPS: injected results, no network. */
function useFakeNearby(mode: NearMode, setMode: (mode: NearMode) => void, places: Place[]): NearbyApi {
  const [stamp, setStamp] = useState(() => Date.now() - 2 * 60 * 1000);
  useEffect(() => {
    if (mode !== "locating") return;
    const timer = setTimeout(() => {
      setStamp(Date.now());
      setMode("done");
    }, 1200);
    return () => clearTimeout(timer);
  }, [mode, setMode]);

  return {
    status: mode === "done" ? "done" : mode === "locating" ? "timing" : "idle",
    message:
      mode === "denied" ? "Location is off for this app. Allow it in Settings to see travel times." : null,
    results: mode === "done" ? fakeResults(places) : {},
    updatedAt: mode === "done" ? stamp : null,
    locate: () => setMode("locating"),
  };
}

type View = "trip" | "nearby" | "list";

function subscribeHash(onChange: () => void) {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}

function useView(): View {
  const hash = useSyncExternalStore(subscribeHash, () => window.location.hash, () => "");
  return hash === "#nearby" ? "nearby" : hash === "#list" ? "list" : "trip";
}

const TODAY = "2026-10-27";

export function Preview() {
  const [showPast, setShowPast] = useState(false);
  const view = useView();
  const [near, setNearState] = useState<NearMode>("idle");
  const setNear = useCallback((mode: NearMode) => setNearState(mode), []);
  const places = nearbyPlaces(trip, TODAY);
  const routes = useFakeRoutes();
  const nearby = useFakeNearby(near, setNear, places);
  const changed = new Set(["s5"]);
  return (
    <>
      <div className="flex flex-wrap gap-2 px-4 pt-3 font-mono text-[10px] uppercase text-muted">
        <a href="#trip">trip</a>
        <a href="#nearby">nearby</a>
        <a href="#list">list</a>
        <span aria-hidden>|</span>
        {(["idle", "locating", "done", "denied"] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => setNear(mode)}
            className={near === mode ? "text-ink underline" : ""}
          >
            near:{mode}
          </button>
        ))}
      </div>
      {view === "trip" ? (
        <TripScreen
          trip={trip}
          today={TODAY}
          live
          showPast={showPast}
          onTogglePast={() => setShowPast((v) => !v)}
          changed={changed}
          routes={routes}
          nearbyHref="#nearby"
        />
      ) : view === "nearby" ? (
        <NearbyScreen tripTitle={trip.title} backHref="#trip" places={places} api={nearby} />
      ) : (
        <TripList
          today={TODAY}
          trips={[
            { slug: "gdl", title: "Guadalajara", start_date: "2026-10-26", end_date: "2026-11-04" },
            { slug: "ash", title: "Asheville road trip", start_date: "2026-06-02", end_date: "2026-06-12" },
          ]}
        />
      )}
    </>
  );
}
