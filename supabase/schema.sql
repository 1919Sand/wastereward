create table public.families (
  id uuid primary key default gen_random_uuid(),
  waste_reward_id text not null unique,
  family_name text not null,
  family_number text not null,
  email text not null,
  mobile_number text not null,
  alternate_mobile_number text,
  family_leader_name text not null,
  family_leader_mobile text not null,
  total_members integer check (total_members is null or total_members > 0),
  house_no text not null,
  address_line_1 text not null,
  address_line_2 text,
  city text not null,
  district text not null,
  state_province text not null,
  locality text not null,
  country text not null default 'India',
  pin_code text not null,
  user_id uuid unique references auth.users(id),
  referred_by_family_id uuid references public.families(id) on delete set null,
  society text not null default 'WasteReward Community',
  points integer not null default 0 check (points >= 0),
  current_streak integer not null default 0,
  best_streak integer not null default 0,
  rank integer not null default 0,
  next_reward jsonb not null default '{"name":"Mystery Reward","pointsRequired":200}'::jsonb,
  days jsonb not null default '{}'::jsonb,
  green_pause_days integer not null default 4 check (green_pause_days >= 0),
  referral_green_pause_days integer not null default 0 check (referral_green_pause_days >= 0),
  created_at timestamptz not null default now()
);

create table public.point_transactions (
  id bigint generated always as identity primary key,
  family_id uuid not null references public.families(id) on delete cascade,
  points integer not null,
  reason text not null,
  date date not null,
  created_at timestamptz not null default now(),
  unique (family_id, date)
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

create or replace function public.admin_adjust_points(p_waste_reward_id text, p_reason text, p_points integer, p_date date, p_status text default null)
returns void
language plpgsql security definer set search_path = public as $$
declare
  family_row public.families%rowtype;
  previous_points integer := 0;
  previous_status text;
  next_status text;
  updated_days jsonb;
  cursor_date date;
  computed_current integer := 0;
  computed_best integer := 0;
begin
  select * into family_row from public.families where waste_reward_id = p_waste_reward_id for update;
  if not found then raise exception 'No household was found for this WasteReward ID.'; end if;

  next_status := coalesce(p_status, case when p_points > 0 then 'completed' else 'missed' end);
  if next_status not in ('completed', 'missed', 'green_pause') then
    raise exception 'Invalid activity status.';
  end if;
  if next_status in ('missed', 'green_pause') and p_points <> 0 then
    raise exception 'Missed and Green Pause days must have zero points.';
  end if;

  select points into previous_points
    from public.point_transactions
   where family_id = family_row.id and date = p_date;
  previous_points := coalesce(previous_points, 0);
  previous_status := family_row.days ->> p_date::text;

  if family_row.points - previous_points + p_points < 0 then
    raise exception 'Points cannot fall below zero.';
  end if;

  if previous_status = 'green_pause' and next_status <> 'green_pause' then
    family_row.green_pause_days := family_row.green_pause_days + 1;
  elsif previous_status is distinct from 'green_pause' and next_status = 'green_pause' then
    if family_row.referral_green_pause_days > 0 then
      family_row.referral_green_pause_days := family_row.referral_green_pause_days - 1;
    elsif family_row.green_pause_days > 0 then
      family_row.green_pause_days := family_row.green_pause_days - 1;
    else
      raise exception 'No Green Pause days are available.';
    end if;
  end if;

  updated_days := jsonb_set(family_row.days, array[p_date::text], to_jsonb(next_status), true);
  select max(key::date) into cursor_date
    from jsonb_each_text(updated_days)
   where key::date <= current_date and value in ('completed', 'missed', 'green_pause');
  if cursor_date < current_date - 1 then cursor_date := null; end if;
  while cursor_date is not null and updated_days ->> cursor_date::text in ('completed', 'green_pause') loop
    computed_current := computed_current + 1;
    cursor_date := cursor_date - 1;
  end loop;
  select coalesce(max(run_length), 0) into computed_best from (
    select count(*)::integer as run_length from (
      select activity_date, activity_date - (row_number() over (order by activity_date))::integer as run_group
      from (select key::date as activity_date from jsonb_each_text(updated_days) where value in ('completed', 'green_pause')) good_days
    ) grouped_days group by run_group
  ) streaks;

  update public.families
    set points = points - previous_points + p_points,
        days = updated_days,
        current_streak = computed_current,
        best_streak = computed_best,
        green_pause_days = family_row.green_pause_days,
        referral_green_pause_days = family_row.referral_green_pause_days
    where id = family_row.id;
  delete from public.point_transactions where family_id = family_row.id and date = p_date;
  insert into public.point_transactions (family_id, points, reason, date)
    values (family_row.id, p_points, p_reason, p_date);
end;
$$;

revoke all on function public.claim_family(text, text, uuid) from public;
revoke all on function public.admin_adjust_points(text, text, integer, date, text) from public;
grant execute on function public.claim_family(text, text, uuid) to service_role;
grant execute on function public.admin_adjust_points(text, text, integer, date, text) to service_role;

create or replace function public.award_referral_green_pause()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.referred_by_family_id is not null then
    update public.families
       set referral_green_pause_days = referral_green_pause_days + 1
     where id = new.referred_by_family_id;
  end if;
  return new;
end;
$$;
create trigger award_referral_green_pause_after_insert
after insert on public.families for each row execute function public.award_referral_green_pause();
