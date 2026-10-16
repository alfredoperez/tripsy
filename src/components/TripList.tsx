import Link from "next/link";

export type TripRow = { slug: string; title: string; start_date: string; end_date: string };

function shortDate(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function TripList({ trips, today }: { trips: TripRow[] | null; today: string }) {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 pb-16 pt-12">
      <h1 className="headline text-[clamp(3rem,15vw,4.5rem)]">Tripsy</h1>
      <p className="headline-light mt-1 text-[clamp(1.5rem,7vw,2.25rem)]">
        Your <span className="rounded-full bg-accent px-3">trips</span>
      </p>
      <ul className="mt-10 space-y-3">
        {trips?.map((trip, index) => {
          const now = trip.start_date <= today && today <= trip.end_date;
          return (
            <li key={trip.slug}>
              <Link
                href={`/t/${trip.slug}`}
                className={`flex items-center gap-4 rounded-[28px] px-4 py-4 ${
                  now ? "bg-ink text-white" : "bg-panel text-ink"
                }`}
              >
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent text-[17px] font-semibold tabular-nums text-ink">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="headline block truncate text-[22px] leading-tight">
                    {trip.title}
                  </span>
                  <span
                    className={`mt-1 block font-mono text-[11px] uppercase tracking-wider ${
                      now ? "text-accent" : "text-muted"
                    }`}
                  >
                    {now ? "Now · " : ""}
                    {shortDate(trip.start_date)} → {shortDate(trip.end_date)}
                  </span>
                </span>
                <span
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                    now ? "bg-accent text-ink" : "bg-ink text-white"
                  }`}
                  aria-hidden
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14M13 6l6 6-6 6" />
                  </svg>
                </span>
              </Link>
            </li>
          );
        })}
        {trips?.length === 0 && <li className="text-muted">No trips yet.</li>}
      </ul>
    </main>
  );
}
