-- Where a stop is on the map, filled on demand the first time someone asks how far it is.
alter table public.stops
  add column lat double precision,
  add column lng double precision;
