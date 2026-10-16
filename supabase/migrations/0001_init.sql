-- Trips schema: trip -> legs -> days -> stops, shared between the members of a trip.

-- The connector smoke test left a one-row table with this name.
drop table if exists public.stops;

create table public.trips (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  subtitle text,
  start_date date not null,
  end_date date not null,
  timezone text not null default 'America/Chicago',
  theme text not null default 'default',
  cover_image_path text,
  created_at timestamptz not null default now(),
  check (end_date >= start_date)
);

-- Who can see and edit a trip. Matched against the signed-in email.
create table public.trip_members (
  trip_id uuid not null references public.trips (id) on delete cascade,
  email text not null,
  primary key (trip_id, email)
);

-- A stretch of the trip with one base: "Drive Out", "Asheville".
create table public.legs (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  position int not null,
  title text not null,
  kind text,
  summary text,
  start_date date not null,
  end_date date not null,
  lodging_name text,
  lodging_address text,
  lodging_map_url text,
  lodging_booking_code text
);

create table public.days (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  leg_id uuid references public.legs (id) on delete set null,
  date date not null,
  title text,
  kind text,
  summary text,
  unique (trip_id, date)
);

create table public.stops (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  day_id uuid not null references public.days (id) on delete cascade,
  -- A stop inside another stop: the places on a walking loop.
  parent_stop_id uuid references public.stops (id) on delete cascade,
  position int not null,
  -- Shown as written: "8:00 AM CT", "~10 AM".
  time_label text,
  kind text not null default 'see'
    check (kind in ('travel', 'eat', 'coffee', 'work', 'hike', 'see', 'stay', 'brewery')),
  title text not null,
  note text,
  address text,
  map_url text,
  booking_code text,
  booked boolean not null default false,
  done boolean not null default false,
  image_path text,
  updated_at timestamptz not null default now()
);

create index legs_trip_idx on public.legs (trip_id, position);
create index days_trip_idx on public.days (trip_id, date);
create index stops_day_idx on public.stops (day_id, position);

create function public.is_trip_member(target uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.trip_members m
    where m.trip_id = target
      and lower(m.email) = lower(auth.jwt() ->> 'email')
  );
$$;

alter table public.trips enable row level security;
alter table public.trip_members enable row level security;
alter table public.legs enable row level security;
alter table public.days enable row level security;
alter table public.stops enable row level security;

create policy "members read trips" on public.trips
  for select to authenticated using (public.is_trip_member(id));
create policy "members edit trips" on public.trips
  for update to authenticated using (public.is_trip_member(id));

create policy "members read members" on public.trip_members
  for select to authenticated using (public.is_trip_member(trip_id));

create policy "members all legs" on public.legs
  for all to authenticated
  using (public.is_trip_member(trip_id)) with check (public.is_trip_member(trip_id));
create policy "members all days" on public.days
  for all to authenticated
  using (public.is_trip_member(trip_id)) with check (public.is_trip_member(trip_id));
create policy "members all stops" on public.stops
  for all to authenticated
  using (public.is_trip_member(trip_id)) with check (public.is_trip_member(trip_id));

-- Live updates on the other phone.
alter publication supabase_realtime add table public.legs, public.days, public.stops;

-- So a deleted stop still reaches the trip's live channel.
alter table public.stops replica identity full;
