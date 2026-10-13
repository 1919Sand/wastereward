-- Run once in the Supabase SQL Editor for an existing WasteReward database.
alter table public.families
  add column if not exists family_number text,
  add column if not exists email text,
  add column if not exists mobile_number text,
  add column if not exists alternate_mobile_number text,
  add column if not exists family_leader_name text,
  add column if not exists family_leader_mobile text,
  add column if not exists total_members integer,
  add column if not exists address_line_1 text,
  add column if not exists address_line_2 text,
  add column if not exists city text,
  add column if not exists district text,
  add column if not exists state_province text,
  add column if not exists locality text,
  add column if not exists country text default 'India',
  add column if not exists pin_code text,
  add column if not exists referred_by_family_id uuid references public.families(id) on delete set null,
  add column if not exists green_pause_days integer not null default 4,
  add column if not exists referral_green_pause_days integer not null default 0;

update public.families set
  family_number = coalesce(family_number, 'F1'),
  email = coalesce(email, ''),
  mobile_number = coalesce(mobile_number, ''),
  family_leader_name = coalesce(family_leader_name, family_name),
  family_leader_mobile = coalesce(family_leader_mobile, mobile_number, ''),
  address_line_1 = coalesce(address_line_1, house_no),
  city = coalesce(city, ''),
  district = coalesce(district, ''),
  state_province = coalesce(state_province, ''),
  locality = coalesce(locality, society, ''),
  country = coalesce(country, 'India'),
  pin_code = coalesce(pin_code, '');

alter table public.point_transactions drop constraint if exists point_transactions_points_check;

-- Repair historic duplicate daily entries before enforcing one record per day.
with ranked as (
  select id, family_id, points,
         row_number() over (partition by family_id, date order by created_at desc, id desc) as row_number
  from public.point_transactions
), duplicate_totals as (
  select family_id, sum(points) as duplicated_points
  from ranked where row_number > 1 group by family_id
)
update public.families f
set points = greatest(0, f.points - d.duplicated_points)
from duplicate_totals d where d.family_id = f.id;

with ranked as (
  select id, row_number() over (partition by family_id, date order by created_at desc, id desc) as row_number
  from public.point_transactions
)
delete from public.point_transactions p using ranked r
where p.id = r.id and r.row_number > 1;

alter table public.point_transactions
  drop constraint if exists point_transactions_family_id_date_key;
alter table public.point_transactions
  add constraint point_transactions_family_id_date_key unique (family_id, date);

drop function if exists public.admin_adjust_points(text, text, integer, date);
create or replace function public.admin_adjust_points(p_waste_reward_id text, p_reason text, p_points integer, p_date date, p_status text default null)
returns void language plpgsql security definer set search_path = public as $$
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
  if next_status not in ('completed', 'missed', 'green_pause') then raise exception 'Invalid activity status.'; end if;
  if next_status in ('missed', 'green_pause') and p_points <> 0 then raise exception 'Missed and Green Pause days must have zero points.'; end if;

  select points into previous_points from public.point_transactions where family_id = family_row.id and date = p_date;
  previous_points := coalesce(previous_points, 0);
  previous_status := family_row.days ->> p_date::text;
  if family_row.points - previous_points + p_points < 0 then raise exception 'Points cannot fall below zero.'; end if;

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
  select max(key::date) into cursor_date from jsonb_each_text(updated_days)
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

  update public.families set
    points = points - previous_points + p_points,
    days = updated_days,
    current_streak = computed_current,
    best_streak = computed_best,
    green_pause_days = family_row.green_pause_days,
    referral_green_pause_days = family_row.referral_green_pause_days
  where id = family_row.id;
  delete from public.point_transactions where family_id = family_row.id and date = p_date;
  insert into public.point_transactions (family_id, points, reason, date) values (family_row.id, p_points, p_reason, p_date);
end;
$$;
revoke all on function public.admin_adjust_points(text, text, integer, date, text) from public;
grant execute on function public.admin_adjust_points(text, text, integer, date, text) to service_role;

-- Existing referrals earn one pause each; future referrals are awarded by the trigger.
update public.families f set referral_green_pause_days = r.referral_count
from (
  select referred_by_family_id, count(*)::integer as referral_count
  from public.families where referred_by_family_id is not null group by referred_by_family_id
) r where f.id = r.referred_by_family_id;

create or replace function public.award_referral_green_pause()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.referred_by_family_id is not null then
    update public.families set referral_green_pause_days = referral_green_pause_days + 1
    where id = new.referred_by_family_id;
  end if;
  return new;
end;
$$;
drop trigger if exists award_referral_green_pause_after_insert on public.families;
create trigger award_referral_green_pause_after_insert
after insert on public.families for each row execute function public.award_referral_green_pause();
