create table public.families (
  id uuid primary key default gen_random_uuid(),
  waste_reward_id text not null unique,
  family_name text not null,
  house_no text not null,
  user_id uuid unique references auth.users(id),
  society text not null default 'WasteReward Community',
  points integer not null default 0 check (points >= 0),
  current_streak integer not null default 0,
  best_streak integer not null default 0,
  rank integer not null default 0,
  next_reward jsonb not null default '{"name":"Mystery Reward","pointsRequired":200}'::jsonb,
  days jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.point_transactions (
  id bigint generated always as identity primary key,
  family_id uuid not null references public.families(id) on delete cascade,
  points integer not null check (points <> 0),
  reason text not null,
  date date not null,
  created_at timestamptz not null default now()
);

alter table public.families enable row level security;
alter table public.point_transactions enable row level security;

create policy "Members can read their household" on public.families
  for select to authenticated using (auth.uid() = user_id);
create policy "Members can read their point history" on public.point_transactions
  for select to authenticated using (
    exists (select 1 from public.families where families.id = point_transactions.family_id and families.user_id = auth.uid())
  );

create or replace function public.claim_family(p_waste_reward_id text, p_house_no text, p_user_id uuid)
returns table (id uuid)
language plpgsql security definer set search_path = public as $$
begin
  return query
  update public.families
     set user_id = p_user_id
   where waste_reward_id = p_waste_reward_id
     and house_no = p_house_no
     and user_id is null
  returning families.id;
end;
$$;

create or replace function public.admin_adjust_points(p_waste_reward_id text, p_reason text, p_points integer, p_date date)
returns void
language plpgsql security definer set search_path = public as $$
declare family_row public.families%rowtype;
begin
  select * into family_row from public.families where waste_reward_id = p_waste_reward_id for update;
  if not found then raise exception 'No household was found for this WasteReward ID.'; end if;
  if family_row.points + p_points < 0 then raise exception 'Points cannot fall below zero.'; end if;

  update public.families
    set points = points + p_points,
        days = jsonb_set(days, array[p_date::text], '"completed"'::jsonb, true)
    where id = family_row.id;
  insert into public.point_transactions (family_id, points, reason, date)
    values (family_row.id, p_points, p_reason, p_date);
end;
$$;

revoke all on function public.claim_family(text, text, uuid) from public;
revoke all on function public.admin_adjust_points(text, text, integer, date) from public;
grant execute on function public.claim_family(text, text, uuid) to service_role;
grant execute on function public.admin_adjust_points(text, text, integer, date) to service_role;
