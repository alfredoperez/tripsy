"use client";

import { useEffect, useState } from "react";
import { TripList, type TripRow } from "@/components/TripList";
import { supabase } from "@/lib/supabase";

function localToday() {
  return new Intl.DateTimeFormat("en-CA").format(new Date());
}

export default function Home() {
  const [trips, setTrips] = useState<TripRow[] | null>(null);

  useEffect(() => {
    supabase
      .from("trips")
      .select("slug, title, start_date, end_date")
      .order("start_date", { ascending: false })
      .then(({ data }) => setTrips(data ?? []));
  }, []);

  return <TripList trips={trips} today={localToday()} />;
}
