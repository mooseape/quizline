-- Run this in the Supabase SQL editor (once).
-- Then enable Anonymous sign-ins: Authentication → Providers → Anonymous.
-- Keep Email sign-ins on: Authentication → Providers → Email.

create table if not exists public.duel_results (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  category_id text not null,
  you_name text not null default 'You',
  you_score integer not null default 0,
  them_name text not null default 'Friend',
  them_score integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.duel_results enable row level security;

drop policy if exists "duel_results_insert" on public.duel_results;
create policy "duel_results_insert"
  on public.duel_results
  for insert
  to anon, authenticated
  with check (true);

drop policy if exists "duel_results_select" on public.duel_results;
create policy "duel_results_select"
  on public.duel_results
  for select
  to anon, authenticated
  using (true);

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default 'You',
  avatar_id text not null default 'spark',
  photo_url text,
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select"
  on public.profiles
  for select
  to anon, authenticated
  using (true);

drop policy if exists "profiles_insert" on public.profiles;
create policy "profiles_insert"
  on public.profiles
  for insert
  to authenticated
  with check (auth.uid() = id);

drop policy if exists "profiles_update" on public.profiles;
create policy "profiles_update"
  on public.profiles
  for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = true;

drop policy if exists "avatars_public_read" on storage.objects;
create policy "avatars_public_read"
  on storage.objects
  for select
  to public
  using (bucket_id = 'avatars');

drop policy if exists "avatars_own_write" on storage.objects;
create policy "avatars_own_write"
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "avatars_own_update" on storage.objects;
create policy "avatars_own_update"
  on storage.objects
  for update
  to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- Friends (safe to re-run after the tables above already exist)

alter table public.profiles add column if not exists username text;

create unique index if not exists profiles_username_lower
  on public.profiles (lower(username))
  where username is not null;

create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles (id) on delete cascade,
  addressee_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  constraint friendships_not_self check (requester_id <> addressee_id)
);

create unique index if not exists friendships_pair
  on public.friendships (least(requester_id, addressee_id), greatest(requester_id, addressee_id));

alter table public.friendships enable row level security;
alter table public.friendships replica identity full;

drop policy if exists "friendships_select" on public.friendships;
create policy "friendships_select"
  on public.friendships
  for select
  to authenticated
  using (auth.uid() = requester_id or auth.uid() = addressee_id);

drop policy if exists "friendships_insert" on public.friendships;
create policy "friendships_insert"
  on public.friendships
  for insert
  to authenticated
  with check (auth.uid() = requester_id);

drop policy if exists "friendships_update" on public.friendships;
create policy "friendships_update"
  on public.friendships
  for update
  to authenticated
  using (auth.uid() = addressee_id)
  with check (auth.uid() = addressee_id and status = 'accepted');

drop policy if exists "friendships_delete" on public.friendships;
create policy "friendships_delete"
  on public.friendships
  for delete
  to authenticated
  using (auth.uid() = requester_id or auth.uid() = addressee_id);

do $$
begin
  alter publication supabase_realtime add table public.friendships;
exception
  when duplicate_object then null;
end $$;

-- Security hardening (safe to re-run)

create or replace function public.is_email_user()
returns boolean
language sql
stable
as $$
  select auth.uid() is not null
    and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) is not true;
$$;

alter table public.duel_results add column if not exists created_by uuid default auth.uid();

drop policy if exists "duel_results_insert" on public.duel_results;
create policy "duel_results_insert"
  on public.duel_results
  for insert
  to authenticated
  with check (public.is_email_user() and created_by = auth.uid());

drop policy if exists "duel_results_select" on public.duel_results;
create policy "duel_results_select"
  on public.duel_results
  for select
  to authenticated
  using (public.is_email_user() and created_by = auth.uid());

drop policy if exists "profiles_select" on public.profiles;
drop policy if exists "profiles_select_self" on public.profiles;
drop policy if exists "profiles_select_related" on public.profiles;
create policy "profiles_select_self"
  on public.profiles
  for select
  to authenticated
  using (public.is_email_user() and auth.uid() = id);

create policy "profiles_select_related"
  on public.profiles
  for select
  to authenticated
  using (
    public.is_email_user()
    and exists (
      select 1
      from public.friendships f
      where (f.requester_id = auth.uid() and f.addressee_id = profiles.id)
         or (f.addressee_id = auth.uid() and f.requester_id = profiles.id)
    )
  );

drop policy if exists "profiles_insert" on public.profiles;
create policy "profiles_insert"
  on public.profiles
  for insert
  to authenticated
  with check (public.is_email_user() and auth.uid() = id);

drop policy if exists "profiles_update" on public.profiles;
create policy "profiles_update"
  on public.profiles
  for update
  to authenticated
  using (public.is_email_user() and auth.uid() = id)
  with check (public.is_email_user() and auth.uid() = id);

drop policy if exists "friendships_select" on public.friendships;
create policy "friendships_select"
  on public.friendships
  for select
  to authenticated
  using (public.is_email_user() and (auth.uid() = requester_id or auth.uid() = addressee_id));

drop policy if exists "friendships_insert" on public.friendships;
create policy "friendships_insert"
  on public.friendships
  for insert
  to authenticated
  with check (public.is_email_user() and auth.uid() = requester_id);

drop policy if exists "friendships_update" on public.friendships;
create policy "friendships_update"
  on public.friendships
  for update
  to authenticated
  using (public.is_email_user() and auth.uid() = addressee_id)
  with check (public.is_email_user() and auth.uid() = addressee_id and status = 'accepted');

drop policy if exists "friendships_delete" on public.friendships;
create policy "friendships_delete"
  on public.friendships
  for delete
  to authenticated
  using (public.is_email_user() and (auth.uid() = requester_id or auth.uid() = addressee_id));

create or replace function public.lookup_profile_by_username(tag text)
returns table (
  id uuid,
  display_name text,
  username text,
  avatar_id text,
  photo_url text
)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.display_name, p.username, p.avatar_id, p.photo_url
  from public.profiles p
  where public.is_email_user()
    and p.username = lower(btrim(regexp_replace(coalesce(tag, ''), '^[@]+', '')))
  limit 1;
$$;

revoke all on function public.lookup_profile_by_username(text) from public, anon;
grant execute on function public.lookup_profile_by_username(text) to authenticated;
