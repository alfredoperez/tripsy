-- A photo per stop, any public URL. Already applied in the live database.
alter table public.stops add column if not exists image_url text;
