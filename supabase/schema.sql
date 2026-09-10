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

-- Ranked randoms + leaderboards (safe to re-run)

alter table public.profiles add column if not exists country text;

create table if not exists public.ranked_stats (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  wins integer not null default 0,
  points integer not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.ranked_stats enable row level security;

create table if not exists public.ranked_matches (
  code text primary key,
  player_low uuid not null,
  player_high uuid not null,
  score_low integer,
  score_high integer,
  category_id text not null,
  pace text not null,
  applied boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.ranked_matches enable row level security;

create or replace function public.report_ranked_result(
  p_code text,
  p_opponent uuid,
  p_my_score integer,
  p_their_score integer,
  p_category text,
  p_pace text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  low_id uuid;
  high_id uuid;
  my_low boolean;
  rec public.ranked_matches%rowtype;
  low_pts integer;
  high_pts integer;
begin
  if not public.is_email_user() then
    raise exception 'Sign in required';
  end if;
  if me is null or p_opponent is null or me = p_opponent then
    raise exception 'Invalid opponent';
  end if;
  if p_code is null or length(p_code) < 6 or length(p_code) > 24 then
    raise exception 'Invalid match';
  end if;

  low_id := least(me, p_opponent);
  high_id := greatest(me, p_opponent);
  my_low := me = low_id;

  insert into public.ranked_matches as rm (code, player_low, player_high, score_low, score_high, category_id, pace)
  values (
    p_code,
    low_id,
    high_id,
    case when my_low then greatest(0, p_my_score) else greatest(0, p_their_score) end,
    case when my_low then greatest(0, p_their_score) else greatest(0, p_my_score) end,
    coalesce(p_category, 'mix'),
    coalesce(p_pace, 'rapid')
  )
  on conflict (code) do update
    set score_low = case
          when my_low then excluded.score_low
          else rm.score_low
        end,
        score_high = case
          when not my_low then excluded.score_high
          else rm.score_high
        end
    where rm.applied = false
      and rm.player_low = low_id
      and rm.player_high = high_id;

  select * into rec from public.ranked_matches where code = p_code;
  if rec.applied or rec.score_low is null or rec.score_high is null then
    return;
  end if;

  update public.ranked_matches set applied = true where code = p_code and applied = false;
  if not found then
    return;
  end if;

  insert into public.ranked_stats (user_id, wins, points)
  values (rec.player_low, 0, 0)
  on conflict (user_id) do nothing;
  insert into public.ranked_stats (user_id, wins, points)
  values (rec.player_high, 0, 0)
  on conflict (user_id) do nothing;

  low_pts := rec.score_low;
  high_pts := rec.score_high;

  update public.ranked_stats
    set points = points + low_pts,
        wins = wins + case when low_pts > high_pts then 1 else 0 end,
        updated_at = now()
    where user_id = rec.player_low;

  update public.ranked_stats
    set points = points + high_pts,
        wins = wins + case when high_pts > low_pts then 1 else 0 end,
        updated_at = now()
    where user_id = rec.player_high;
end;
$$;

revoke all on function public.report_ranked_result(text, uuid, integer, integer, text, text) from public, anon;
grant execute on function public.report_ranked_result(text, uuid, integer, integer, text, text) to authenticated;

create or replace function public.leaderboard_rows(kind text, country_code text)
returns table (
  user_id uuid,
  display_name text,
  username text,
  avatar_id text,
  photo_url text,
  country text,
  wins integer,
  points integer,
  rank bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with pool as (
    select
      s.user_id,
      p.display_name,
      p.username,
      p.avatar_id,
      p.photo_url,
      p.country,
      s.wins,
      s.points
    from public.ranked_stats s
    join public.profiles p on p.id = s.user_id
    where public.is_email_user()
      and (s.wins > 0 or s.points > 0)
      and (
        kind = 'global'
        or (kind = 'national' and country_code is not null and p.country = country_code)
        or (
          kind = 'friends'
          and (
            s.user_id = auth.uid()
            or exists (
              select 1
              from public.friendships f
              where f.status = 'accepted'
                and (
                  (f.requester_id = auth.uid() and f.addressee_id = s.user_id)
                  or (f.addressee_id = auth.uid() and f.requester_id = s.user_id)
                )
            )
          )
        )
      )
  )
  select
    pool.user_id,
    pool.display_name,
    pool.username,
    pool.avatar_id,
    pool.photo_url,
    pool.country,
    pool.wins,
    pool.points,
    rank() over (order by pool.wins desc, pool.points desc, pool.username asc)
  from pool
  order by wins desc, points desc, username asc
  limit 100;
$$;

revoke all on function public.leaderboard_rows(text, text) from public, anon;
grant execute on function public.leaderboard_rows(text, text) to authenticated;
