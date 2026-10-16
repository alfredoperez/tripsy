// Links out of the app.

import { mapsSearch } from "@/lib/tickets";
import type { Stop } from "@/lib/types";

/** The Claude project that plans the trips. */
export const CLAUDE_PROJECT_URL = "https://claude.ai/project/01a136a8-7a5e-75f6-ad6a-9a2820b0e90d";

/** The stop's own map link, else a Google Maps search for its name and address. */
export function stopMapUrl(stop: Pick<Stop, "map_url" | "title" | "address">) {
  return stop.map_url || mapsSearch([stop.title, stop.address].filter(Boolean).join(" "));
}
