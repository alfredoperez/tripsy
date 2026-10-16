"use client";

import { useEffect, useState } from "react";
import { fakeTravel, type DistanceApi, type TravelResult } from "@/components/Distance";
import { TripList } from "@/components/TripList";
import { TripScreen } from "@/components/TripView";
import type { LatLng } from "@/lib/mapbox";
import type { Stop, Trip } from "@/lib/types";

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

// Fake "you are here" in Colonia Americana, and where each place is.
const ME: LatLng = { lat: 20.6736, lng: -103.37 };
const TEQUILA_HOTEL: LatLng = { lat: 20.882, lng: -103.837 };

function fakeResults(): Record<string, TravelResult> {
  const results: Record<string, TravelResult> = { l2: { status: "done", travel: fakeTravel(ME, TEQUILA_HOTEL) } };
  for (const day of trip.days) {
    for (const s of day.stops) {
      const fromUrl = s.map_url?.match(/@(-?[\d.]+),(-?[\d.]+)/);
      const point =
        s.lat != null && s.lng != null
          ? { lat: s.lat, lng: s.lng }
          : fromUrl
            ? { lat: Number(fromUrl[1]), lng: Number(fromUrl[2]) }
            : null;
      results[s.id] = point ? { status: "done", travel: fakeTravel(ME, point) } : { status: "none" };
    }
  }
  return results;
}

type NearMode = "off" | "idle" | "loading" | "done" | "denied";

/** Travel times without a token or GPS: injected results, no network. */
function useFakeDistance(mode: NearMode, setMode: (mode: NearMode) => void): DistanceApi | undefined {
  const [stamp, setStamp] = useState(() => Date.now() - 2 * 60 * 1000);
  const [single, setSingle] = useState<Record<string, TravelResult>>({});
  useEffect(() => {
    if (mode !== "loading") return;
    const timer = setTimeout(() => {
      setStamp(Date.now() - 2 * 60 * 1000);
      setMode("done");
    }, 1200);
    return () => clearTimeout(timer);
  }, [mode, setMode]);

  if (mode === "off") return undefined;
  const all = fakeResults();
  return {
    results: mode === "done" ? all : single,
    loading: mode === "loading" ? new Set(Object.keys(all)) : new Set(),
    busy: mode === "loading" ? "timing" : false,
    message:
      mode === "denied" ? "Location is off for this app. Allow it in Settings to see travel times." : null,
    updatedAt: mode === "done" ? stamp : null,
    nearMe: () => setMode("loading"),
    howFar: (place) => setSingle((prev) => ({ ...prev, [place.id]: all[place.id] ?? { status: "none" } })),
  };
}

export function Preview() {
  const [showPast, setShowPast] = useState(false);
  const [view, setView] = useState<"trip" | "list">("trip");
  const [near, setNear] = useState<NearMode>("idle");
  const distance = useFakeDistance(near, setNear);
  const changed = new Set(["s5"]);
  return (
    <>
      <div className="flex flex-wrap gap-2 px-4 pt-3 font-mono text-[10px] uppercase text-muted">
        <button type="button" onClick={() => setView("trip")}>trip</button>
        <button type="button" onClick={() => setView("list")}>list</button>
        <span aria-hidden>|</span>
        {(["off", "idle", "loading", "done", "denied"] as const).map((mode) => (
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
          today="2026-10-27"
          live
          showPast={showPast}
          onTogglePast={() => setShowPast((v) => !v)}
          changed={changed}
          distance={distance}
        />
      ) : (
        <TripList
          today="2026-10-27"
          trips={[
            { slug: "gdl", title: "Guadalajara", start_date: "2026-10-26", end_date: "2026-11-04" },
            { slug: "ash", title: "Asheville road trip", start_date: "2026-06-02", end_date: "2026-06-12" },
          ]}
        />
      )}
    </>
  );
}
