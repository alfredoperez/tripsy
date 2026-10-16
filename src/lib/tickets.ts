// Turns free-text stops (written by an LLM, wording varies) into the fields
// the boarding-pass and hotel cards need. Every field is optional: when a
// value cannot be read with confidence it is left out, never guessed.

import type { Stop } from "@/lib/types";

export function mapsSearch(query: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

const AIRPORTS: Record<string, string> = {
  SAT: "San Antonio",
  GDL: "Guadalajara",
  AUS: "Austin",
  IAH: "Houston",
  HOU: "Houston Hobby",
  DFW: "Dallas–Fort Worth",
  DAL: "Dallas Love",
  LAX: "Los Angeles",
  SFO: "San Francisco",
  ORD: "Chicago",
  JFK: "New York JFK",
  ATL: "Atlanta",
  DEN: "Denver",
  PHX: "Phoenix",
  LAS: "Las Vegas",
  MIA: "Miami",
  MEX: "Mexico City",
  NLU: "Mexico City AIFA",
  MTY: "Monterrey",
  CUN: "Cancún",
  PVR: "Puerto Vallarta",
  SJD: "Los Cabos",
  OAX: "Oaxaca",
  BJX: "León",
  QRO: "Querétaro",
};

// Three-letter words that show up in itineraries but are not airports.
const NOT_AIRPORTS = new Set([
  "CST", "CDT", "EST", "EDT", "MST", "MDT", "PST", "PDT", "UTC", "GMT",
  "THE", "AND", "FOR", "VIA", "ARR", "DEP", "TBD", "USA", "USD", "MXN",
]);

const AIRLINES = [
  "Volaris", "Viva Aerobus", "VivaAerobus", "Aeroméxico", "Aeromexico", "American",
  "United", "Delta", "Southwest", "Alaska", "JetBlue", "Spirit", "Frontier",
  "Air Canada", "WestJet", "Allegiant", "Sun Country", "Copa", "Avianca",
];

const TIME = String.raw`\d{1,2}(?::\d{2})?\s*[AaPp]\.?\s?[Mm]\.?`;

function cleanTime(raw: string) {
  return raw
    .replace(/\./g, "")
    .replace(/\s+/g, " ")
    .replace(/\s*([ap])\s?m$/i, (_, ap: string) => ` ${ap.toUpperCase()}M`)
    .trim();
}

export type Flight = {
  from: string;
  to: string;
  fromCity?: string;
  toCity?: string;
  depart?: string;
  arrive?: string;
  duration?: string;
  airline?: string;
  flightNumber?: string;
};

function findCodes(text: string): [string, string] | null {
  // "SAT→GDL", "SAT - GDL", "SAT to GDL", "SAT > GDL", "SAT/GDL", "(SAT) ✈ (GDL)".
  // The second code sits in a lookahead so a rejected match never swallows it.
  const pair =
    /\b([A-Z]{3})\b\)?(?=\s*(?:→|➝|➔|->|=>|–|—|-|>|\/|✈️?|\bto\b)\s*\(?([A-Z]{3})\b)/gi;
  for (const match of text.matchAll(pair)) {
    const [from, to] = [match[1], match[2]];
    // Codes must be written in capitals; "to" may be any case.
    if (from !== from.toUpperCase() || to !== to.toUpperCase()) continue;
    if (from === to || NOT_AIRPORTS.has(from) || NOT_AIRPORTS.has(to)) continue;
    return [from, to];
  }
  // Fallback: the first two different known airports in reading order.
  const known = [...text.matchAll(/\b([A-Z]{3})\b/g)]
    .map((m) => m[1])
    .filter((code) => AIRPORTS[code]);
  const unique = [...new Set(known)];
  return unique.length >= 2 ? [unique[0], unique[1]] : null;
}

export function parseFlight(stop: Stop): Flight | null {
  if (stop.kind !== "travel") return null;
  const text = [stop.title, stop.note].filter(Boolean).join(" · ");
  const codes = findCodes(text);
  if (!codes) return null;
  const [from, to] = codes;
  const all = [stop.time_label, text].filter(Boolean).join(" · ");

  const label = stop.time_label ?? "";
  const labelTimes = [...label.matchAll(new RegExp(TIME, "g"))].map((m) => cleanTime(m[0]));
  const depFromText = all.match(new RegExp(String.raw`\bdep(?:art(?:s|ing|ure)?)?\.?:?\s*(?:at\s*)?(${TIME})`, "i"));
  const arrFromText = all.match(
    new RegExp(String.raw`\b(?:arr(?:ive|ives|iving|ival)?|lands?|landing)\.?:?\s*(?:at\s*)?(${TIME})`, "i"),
  );

  const depart = labelTimes[0] ?? (depFromText ? cleanTime(depFromText[1]) : undefined);
  let arrive: string | undefined = arrFromText ? cleanTime(arrFromText[1]) : labelTimes[1];
  if (arrive === depart) arrive = undefined;

  const dur = all.match(/\b(\d{1,2})\s*h(?:rs?|ours?)?\s*(?:(\d{1,2})\s*m(?:in)?)?\b/i);
  const duration = dur ? `${dur[1]}h${dur[2] ? ` ${dur[2]}m` : ""}` : undefined;

  const lower = text.toLowerCase();
  let airline = AIRLINES.find((name) => lower.includes(name.toLowerCase()));
  if (!airline) {
    const named = text.match(/\b([A-Z][\w-]+(?:\s[A-Z][\w-]+)?\s(?:Airlines|Airways|Air))\b/);
    airline = named?.[1];
  }
  if (airline === "VivaAerobus") airline = "Viva Aerobus";
  if (airline === "Aeromexico") airline = "Aeroméxico";

  // "Y4 1234", "AA 55", "Flight 1234". The booking code is never a flight number.
  const num =
    text.match(/\b([A-Z]\d|\d[A-Z]|[A-Z]{2})\s?(\d{1,4})\b/) ??
    text.match(/\bflight\s*#?\s*(\d{2,4})\b/i);
  let flightNumber: string | undefined;
  if (num && !/^(AM|PM)$/.test(num[1])) {
    const candidate = num.length === 3 ? `${num[1]} ${num[2]}` : num[1];
    const booking = (stop.booking_code ?? "").replace(/\s/g, "");
    if (!booking || !booking.startsWith(candidate.replace(/\s/g, ""))) flightNumber = candidate;
  }

  return {
    from,
    to,
    fromCity: AIRPORTS[from],
    toCity: AIRPORTS[to],
    depart,
    arrive,
    duration,
    airline,
    flightNumber,
  };
}

/** "Check in at Hotel Antré" → "Hotel Antré". */
export function hotelName(title: string) {
  const stripped = title
    .replace(
      /^\s*(?:🏨|🛏️?)?\s*(?:check[\s-]?(?:in|out)|checkin|checkout|arrive|stay)\s*(?:at|into|in|:|-|–|—|·)?\s*/i,
      "",
    )
    .replace(/\s*(?:[-–—·:]\s*)?check[\s-]?(?:in|out)\s*$/i, "")
    .trim();
  return stripped || title;
}

export function isCheckOut(title: string) {
  return /check[\s-]?out/i.test(title);
}
