-- Stop photos are copied into Supabase Storage so a link that rots or rotates
-- (Google Maps photo URLs do) never blanks a card, and phones can cache the
-- copy forever. image_url stays the source; image_path is our copy in the
-- public stop-photos bucket, named by the content's SHA-256 so it never changes.
--
-- Flow: a stop gets a new or changed image_url -> image_path is cleared ->
-- the trigger asks the mirror-photo edge function (supabase/functions) to copy
-- it -> the function uploads the file and sets image_path. The app shows
-- image_path when set, image_url until then.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'stop-photos',
  'stop-photos',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']
)
on conflict (id) do nothing;

create extension if not exists pg_net with schema extensions;

-- Shared secret between the trigger and the edge function. It is generated
-- here and only ever read from the vault, never written to the repo.
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'photo_mirror_secret') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'photo_mirror_secret');
  end if;
end $$;

-- Lets the edge function (service role only) check the header it was sent.
create or replace function public.photo_mirror_secret_ok(token text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from vault.decrypted_secrets
    where name = 'photo_mirror_secret' and decrypted_secret = token
  );
$$;
revoke all on function public.photo_mirror_secret_ok(text) from public, anon, authenticated;
grant execute on function public.photo_mirror_secret_ok(text) to service_role;

-- A changed image_url makes the old copy wrong: drop it until the new one lands.
create or replace function public.reset_stop_image_path()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.image_url is distinct from old.image_url then
    new.image_path := null;
  end if;
  return new;
end;
$$;

drop trigger if exists stops_reset_image_path on public.stops;
create trigger stops_reset_image_path
  before update of image_url on public.stops
  for each row execute function public.reset_stop_image_path();

-- Ask the edge function to copy the photo. pg_net is asynchronous, so the
-- write that set image_url never waits on the download.
create or replace function public.request_stop_photo_mirror()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  secret text;
begin
  if new.image_url is null or new.image_path is not null then
    return new;
  end if;
  select decrypted_secret into secret
  from vault.decrypted_secrets
  where name = 'photo_mirror_secret';
  perform net.http_post(
    url := 'https://mhafbfmjcokxzydraplj.supabase.co/functions/v1/mirror-photo',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-mirror-secret', secret),
    body := jsonb_build_object('stop_id', new.id)
  );
  return new;
end;
$$;

drop trigger if exists stops_mirror_photo on public.stops;
create trigger stops_mirror_photo
  after insert or update of image_url on public.stops
  for each row execute function public.request_stop_photo_mirror();
