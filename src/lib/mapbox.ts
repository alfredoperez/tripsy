// Every Mapbox call lives here. Nothing in this file runs on its own: each
// function is called only after a tap on "Route this day" or "Use my location".

export type LatLng = { lat: number; lng: number };

export type Leg = { minutes: number; meters: number };

export type Travel = {
  /** Where the directions start; the person's position or the previous stop. */
  from?: LatLng;
  to: LatLng;
  walk: Leg | null;
  drive: Leg | null;
};

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

/** False when no token is configured: the distance buttons stay hidden. */
export const hasMapbox = Boolean(TOKEN);

function valid(lat: number, lng: number) {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180 &&
    !(lat === 0 && lng === 0)
  );
}

/**
 * Reads coordinates out of a Google Maps link when they are written in it:
 * `!3dLAT!4dLNG` (the place itself), `@lat,lng` (the camera), `ll=`, `q=`.
 * Short links (maps.app.goo.gl) carry none and return null.
 */
export function coordsFromMapUrl(url: string | null | undefined): LatLng | null {
  if (!url) return null;
  let text = url;
  try {
    text = decodeURIComponent(url);
  } catch {
    // Malformed escape: read the raw string.
  }
  const num = String.raw`(-?\d{1,3}(?:\.\d+)?)`;
  const patterns = [
    new RegExp(String.raw`!3d${num}!4d${num}`),
    new RegExp(String.raw`[?&](?:q|query|destination|daddr|ll|sll|center)=${num},\s*${num}`),
    new RegExp(String.raw`@${num},${num}`),
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match) continue;
    const lat = Number(match[1]);
    const lng = Number(match[2]);
    if (valid(lat, lng)) return { lat, lng };
  }
  return null;
}

/** Straight-line distance in meters. */
export function crowFlies(a: LatLng, b: LatLng) {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
}

/**
 * Mapbox Geocoding v6 forward lookup, biased toward `near`. Returns null on
 * any failure, and when the match lands too far from `near` to be the place
 * the itinerary means (a vague title matching a street in another city).
 */
export async function geocode(query: string, near?: LatLng, maxMeters = 150000) {
  if (!TOKEN || !query.trim()) return null;
  const params = new URLSearchParams({ q: query, limit: "1", access_token: TOKEN });
  if (near) params.set("proximity", `${near.lng},${near.lat}`);
  try {
    const res = await fetch(`https://api.mapbox.com/search/geocode/v6/forward?${params}`);
    if (!res.ok) return null;
    const data = (await res.json()) as {
      features?: { geometry?: { coordinates?: [number, number] } }[];
    };
    const [lng, lat] = data.features?.[0]?.geometry?.coordinates ?? [];
    if (lat === undefined || lng === undefined || !valid(lat, lng)) return null;
    const point = { lat, lng };
    if (near && crowFlies(near, point) > maxMeters) return null;
    return point;
  } catch {
    return null;
  }
}

type Profile = "walking" | "driving-traffic";

// Matrix limits: driving-traffic takes 10 coordinates per request, walking 25.
// Coordinate 0 is always the person, so a request holds one fewer place.
const PER_REQUEST: Record<Profile, number> = { walking: 24, "driving-traffic": 9 };

async function matrix(profile: Profile, from: LatLng, places: LatLng[]) {
  const out: (Leg | null)[] = new Array(places.length).fill(null);
  const size = PER_REQUEST[profile];
  const chunks: number[] = [];
  for (let start = 0; start < places.length; start += size) chunks.push(start);

  await Promise.all(
    chunks.map(async (start) => {
      const slice = places.slice(start, start + size);
      const coords = [from, ...slice].map((p) => `${p.lng},${p.lat}`).join(";");
      const params = new URLSearchParams({
        sources: "0",
        annotations: "duration,distance",
        access_token: TOKEN ?? "",
      });
      try {
        const res = await fetch(
          `https://api.mapbox.com/directions-matrix/v1/mapbox/${profile}/${coords}?${params}`,
        );
        if (!res.ok) return;
        const data = (await res.json()) as {
          durations?: (number | null)[][];
          distances?: (number | null)[][];
        };
        slice.forEach((_, i) => {
          const seconds = data.durations?.[0]?.[i + 1];
          const meters = data.distances?.[0]?.[i + 1];
          if (seconds == null || meters == null) return;
          out[start + i] = { minutes: seconds / 60, meters };
        });
      } catch {
        // This chunk shows no times; the rest still do.
      }
    }),
  );
  return out;
}

/**
 * Walking and traffic-aware driving times from `from` to every place.
 * Throws only when every request failed, so the caller can say so.
 */
export async function travelTimes(from: LatLng, places: LatLng[]): Promise<Travel[]> {
  if (!TOKEN) throw new Error("No Mapbox token");
  if (places.length === 0) return [];
  const [walk, drive] = await Promise.all([
    matrix("walking", from, places),
    matrix("driving-traffic", from, places),
  ]);
  if (walk.every((leg) => !leg) && drive.every((leg) => !leg)) {
    throw new Error("No travel times");
  }
  return places.map((to, i) => ({ to, walk: walk[i], drive: drive[i] }));
}

/**
 * Walking and traffic-aware driving times for each pair, previous stop to the
 * next. Consecutive pairs share a coordinate, so a day of N stops is one
 * walking request (up to 25 coordinates) and ceil((N-1)/9) driving ones.
 * Throws only when every request failed.
 */
export async function pairTimes(pairs: { from: LatLng; to: LatLng }[]) {
  if (!TOKEN) throw new Error("No Mapbox token");
  if (pairs.length === 0) return [];
  const [walk, drive] = await Promise.all([
    pairMatrix("walking", pairs),
    pairMatrix("driving-traffic", pairs),
  ]);
  if (walk.every((leg) => !leg) && drive.every((leg) => !leg)) {
    throw new Error("No travel times");
  }
  return pairs.map((_, i) => ({ walk: walk[i], drive: drive[i] }));
}

const MAX_COORDS: Record<Profile, number> = { walking: 25, "driving-traffic": 10 };

function samePoint(a: LatLng, b: LatLng) {
  return a.lat === b.lat && a.lng === b.lng;
}

async function pairMatrix(profile: Profile, pairs: { from: LatLng; to: LatLng }[]) {
  const out: (Leg | null)[] = new Array(pairs.length).fill(null);
  type Request = { coords: LatLng[]; items: { index: number; source: number; dest: number }[] };
  const requests: Request[] = [];
  let current: Request | null = null;
  pairs.forEach((pair, index) => {
    let chained = Boolean(current && samePoint(current.coords[current.coords.length - 1], pair.from));
    if (!current || current.coords.length + (chained ? 1 : 2) > MAX_COORDS[profile]) {
      current = { coords: [], items: [] };
      requests.push(current);
      chained = false;
    }
    if (!chained) current.coords.push(pair.from);
    const source = current.coords.length - 1;
    current.coords.push(pair.to);
    current.items.push({ index, source, dest: current.coords.length - 1 });
  });

  await Promise.all(
    requests.map(async ({ coords, items }) => {
      const sources = [...new Set(items.map((item) => item.source))];
      const dests = [...new Set(items.map((item) => item.dest))];
      const params = new URLSearchParams({
        sources: sources.join(";"),
        destinations: dests.join(";"),
        annotations: "duration,distance",
        access_token: TOKEN ?? "",
      });
      const path = coords.map((p) => `${p.lng},${p.lat}`).join(";");
      try {
        const res = await fetch(
          `https://api.mapbox.com/directions-matrix/v1/mapbox/${profile}/${path}?${params}`,
        );
        if (!res.ok) return;
        const data = (await res.json()) as {
          durations?: (number | null)[][];
          distances?: (number | null)[][];
        };
        for (const item of items) {
          const row = sources.indexOf(item.source);
          const col = dests.indexOf(item.dest);
          const seconds = data.durations?.[row]?.[col];
          const meters = data.distances?.[row]?.[col];
          if (seconds == null || meters == null) continue;
          out[item.index] = { minutes: seconds / 60, meters };
        }
      } catch {
        // These pairs show no times; the rest still do.
      }
    }),
  );
  return out;
}

export function directionsUrl(to: LatLng, mode: "walking" | "driving", from?: LatLng) {
  const origin = from ? `&origin=${from.lat},${from.lng}` : "";
  return `https://www.google.com/maps/dir/?api=1${origin}&destination=${to.lat},${to.lng}&travelmode=${mode}`;
}

export function formatMinutes(minutes: number) {
  const m = Math.max(1, Math.round(minutes));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest ? `${h} h ${rest} min` : `${h} h`;
}

export function formatKm(meters: number) {
  const km = meters / 1000;
  return `${km < 10 ? km.toFixed(1) : Math.round(km)} km`;
}
