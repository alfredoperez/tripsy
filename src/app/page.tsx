"use client";

import { useEffect, useState } from "react";
import { rememberPage } from "@/components/ServiceWorker";
import { TripList, type TripRow } from "@/components/TripList";
import { supabase } from "@/lib/supabase";
import { readTripList, writeTripList } from "@/lib/tripCache";

function localToday() {
  return new Intl.DateTimeFormat("en-CA").format(new Date());
}

export default function Home() {
  // The saved list shows at once and offline; the network copy replaces it.
  // Safe to read during render: AuthGate renders nothing on the server.
  const [trips, setTrips] = useState<TripRow[] | null>(() => readTripList()?.data ?? null);

  useEffect(() => {
    rememberPage("/");
    supabase
      .from("trips")
      .select("slug, title, start_date, end_date")
      .order("start_date", { ascending: false })
      .then(({ data, error }) => {
        if (error) {
          // Offline: keep the saved list, or show an empty one if there is none.
          setTrips((prev) => prev ?? []);
          return;
        }
        setTrips(data ?? []);
        writeTripList(data ?? [], Date.now());
      });
  }, []);

  return <TripList trips={trips} today={localToday()} />;
}
