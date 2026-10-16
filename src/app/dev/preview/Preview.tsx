"use client";

import { useState } from "react";
import { TripList } from "@/components/TripList";
import { TripScreen } from "@/components/TripView";
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
        }),
        stop("d1", { kind: "eat", title: "Tacos at Karnes Garibaldi", time_label: "9 PM", note: "Carne en su jugo", map_url: "https://maps.google.com" }),
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
        stop("d2", { kind: "coffee", title: "Café Palreal", time_label: "8:30 AM" }),
        stop("d2", { kind: "see", title: "Centro Histórico loop", time_label: "10 AM", note: "About 3 km" }),
        { ...stop("d2", { kind: "see", title: "Catedral" }), parent_stop_id: "s7" },
        { ...stop("d2", { kind: "see", title: "Hospicio Cabañas", note: "Orozco murals" }), parent_stop_id: "s7" },
      ],
    },
    {
      id: "d3",
      leg_id: "l2",
      date: "2026-11-01",
      title: "To Tequila",
      kind: "travel",
      summary: null,
      stops: [stop("d3", { kind: "travel", title: "Bus to Tequila", time_label: "10 AM" })],
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

export function Preview() {
  const [showPast, setShowPast] = useState(false);
  const [view, setView] = useState<"trip" | "list">("trip");
  const changed = new Set(["s5"]);
  return (
    <>
      <div className="flex gap-2 px-4 pt-3 font-mono text-[10px] uppercase text-muted">
        <button type="button" onClick={() => setView("trip")}>trip</button>
        <button type="button" onClick={() => setView("list")}>list</button>
      </div>
      {view === "trip" ? (
        <TripScreen
          trip={trip}
          today="2026-10-27"
          live
          showPast={showPast}
          onTogglePast={() => setShowPast((v) => !v)}
          changed={changed}
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
