export type StopKind =
  | "travel"
  | "eat"
  | "coffee"
  | "work"
  | "hike"
  | "see"
  | "stay"
  | "brewery";

export type Stop = {
  id: string;
  day_id: string;
  parent_stop_id: string | null;
  position: number;
  time_label: string | null;
  kind: StopKind;
  title: string;
  note: string | null;
  address: string | null;
  map_url: string | null;
  booking_code: string | null;
  booked: boolean;
  done: boolean;
  image_path: string | null;
};

export type Day = {
  id: string;
  leg_id: string | null;
  date: string;
  title: string | null;
  kind: string | null;
  summary: string | null;
  stops: Stop[];
};

export type Leg = {
  id: string;
  position: number;
  title: string;
  start_date: string;
  end_date: string;
  lodging_name: string | null;
  lodging_address: string | null;
  lodging_map_url: string | null;
  lodging_booking_code: string | null;
};

export type Trip = {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  start_date: string;
  end_date: string;
  timezone: string;
  legs: Leg[];
  days: Day[];
};
