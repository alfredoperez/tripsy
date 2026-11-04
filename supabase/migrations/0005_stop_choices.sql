-- Pick-one slots: a stop marked is_choice holds options as its child stops
-- (parent_stop_id = the slot). The slot remembers the pick in
-- chosen_option_id; null means still deciding. Deleting the slot deletes its
-- options (the existing parent_stop_id cascade); deleting the picked option
-- just clears the pick.

alter table public.stops add column if not exists is_choice boolean not null default false;

alter table public.stops
  add column if not exists chosen_option_id uuid references public.stops (id) on delete set null;
