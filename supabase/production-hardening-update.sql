-- Run once after dashboard-update.sql, leaderboard-update.sql, and location-leaderboard-update.sql.
-- Adds secure household claims, accurate Green Pause restoration, and admin point auditing.
begin;

create table if not exists public.schema_migrations (
  version text primary key,
  applied_at timestamptz not null default now()
);
alter table public.schema_migrations enable row level security;

alter table public.families
  add column if not exists claim_code_hash text,
  add column if not exists claim_code_expires_at timestamptz,
  add column if not exists claim_code_used_at timestamptz;

alter table public.point_transactions
  add column if not exists status text,
  add column if not exists pause_source text;

update public.point_transactions t
set status = coalesce(f.days ->> t.date::text, case when t.points > 0 then 'completed' else 'missed' end)
from public.families f
where f.id = t.family_id and t.status is null;

alter table public.point_transactions alter column status set default 'completed';
alter table public.point_transactions alter column status set not null;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'point_transactions_status_check') then
    alter table public.point_transactions add constraint point_transactions_status_check check (status in ('completed', 'missed', 'green_pause'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'point_transactions_pause_source_check') then
    alter table public.point_transactions add constraint point_transactions_pause_source_check check (pause_source is null or pause_source in ('regular', 'referral'));
  end if;
end $$;

create table if not exists public.admin_point_audit (
  id bigint generated always as identity primary key,
  family_id uuid not null references public.families(id) on delete cascade,
  admin_email text not null,
  activity_date date not null,
  previous_points integer not null,
  new_points integer not null,
  previous_status text,
  new_status text not null,
  reason text not null,
  created_at timestamptz not null default now()
);
alter table public.admin_point_audit enable row level security;

drop function if exists public.claim_family(text, text, uuid);
drop function if exists public.claim_family(text, text, uuid, text);
create function public.claim_family(p_waste_reward_id text, p_claim_code_hash text, p_user_id uuid, p_email text)
returns table (id uuid)
language plpgsql security definer set search_path = public as $$
begin
  return query
  update public.families
     set user_id = p_user_id,
         claim_code_used_at = now(),
         claim_code_hash = null
   where waste_reward_id = p_waste_reward_id
     and claim_code_hash = p_claim_code_hash
     and claim_code_expires_at > now()
     and claim_code_used_at is null
     and lower(email) = lower(p_email)
     and user_id is null
  returning families.id;
end;
$$;
revoke all on function public.claim_family(text, text, uuid, text) from public;
grant execute on function public.claim_family(text, text, uuid, text) to service_role;

drop function if exists public.admin_adjust_points(text, text, integer, date, text);
drop function if exists public.admin_adjust_points(text, text, integer, date, text, text);
create function public.admin_adjust_points(p_waste_reward_id text, p_reason text, p_points integer, p_date date, p_status text, p_admin_email text)
returns void language plpgsql security definer set search_path = public as $$
declare
  family_row public.families%rowtype;
  previous_points integer := 0;
  previous_status text;
  previous_pause_source text;
  next_status text;
  next_pause_source text;
  updated_days jsonb;
  cursor_date date;
  computed_current integer := 0;
  computed_best integer := 0;
  business_date date := (now() at time zone 'Asia/Kolkata')::date;
begin
  select * into family_row from public.families where waste_reward_id = p_waste_reward_id for update;
  if not found then raise exception 'No household was found for this WasteReward ID.'; end if;
  next_status := p_status;
  if next_status not in ('completed', 'missed', 'green_pause') then raise exception 'Invalid activity status.'; end if;
  if next_status = 'completed' and p_points <= 0 then raise exception 'Completed days must award positive points.'; end if;
  if next_status in ('missed', 'green_pause') and p_points <> 0 then raise exception 'Missed and Green Pause days must have zero points.'; end if;
  if p_date > business_date then raise exception 'Future activity dates are not allowed.'; end if;

  select points, status, pause_source into previous_points, previous_status, previous_pause_source
    from public.point_transactions where family_id = family_row.id and date = p_date;
  previous_points := coalesce(previous_points, 0);
  previous_status := coalesce(previous_status, family_row.days ->> p_date::text);
  if family_row.points - previous_points + p_points < 0 then raise exception 'Points cannot fall below zero.'; end if;

  if previous_status = 'green_pause' and next_status <> 'green_pause' then
    if previous_pause_source = 'referral' then
      family_row.referral_green_pause_days := family_row.referral_green_pause_days + 1;
    else
      family_row.green_pause_days := family_row.green_pause_days + 1;
    end if;
  elsif previous_status is distinct from 'green_pause' and next_status = 'green_pause' then
    if family_row.referral_green_pause_days > 0 then
      family_row.referral_green_pause_days := family_row.referral_green_pause_days - 1;
      next_pause_source := 'referral';
    elsif family_row.green_pause_days > 0 then
      family_row.green_pause_days := family_row.green_pause_days - 1;
      next_pause_source := 'regular';
    else
      raise exception 'No Green Pause days are available.';
    end if;
  end if;
  if previous_status = 'green_pause' and next_status = 'green_pause' then next_pause_source := previous_pause_source; end if;

  updated_days := jsonb_set(family_row.days, array[p_date::text], to_jsonb(next_status), true);
  select max(key::date) into cursor_date from jsonb_each_text(updated_days)
  where key::date <= business_date and value in ('completed', 'missed', 'green_pause');
  if cursor_date < business_date - 1 then cursor_date := null; end if;
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

  insert into public.admin_point_audit (family_id, admin_email, activity_date, previous_points, new_points, previous_status, new_status, reason)
    values (family_row.id, p_admin_email, p_date, previous_points, p_points, previous_status, next_status, p_reason);
  update public.families set
    points = points - previous_points + p_points,
    days = updated_days,
    current_streak = computed_current,
    best_streak = computed_best,
    green_pause_days = family_row.green_pause_days,
    referral_green_pause_days = family_row.referral_green_pause_days
  where id = family_row.id;
  delete from public.point_transactions where family_id = family_row.id and date = p_date;
  insert into public.point_transactions (family_id, points, reason, date, status, pause_source)
    values (family_row.id, p_points, p_reason, p_date, next_status, next_pause_source);
end;
$$;
revoke all on function public.admin_adjust_points(text, text, integer, date, text, text) from public;
grant execute on function public.admin_adjust_points(text, text, integer, date, text, text) to service_role;

insert into public.schema_migrations(version) values ('20261018_production_hardening') on conflict (version) do nothing;
commit;
notify pgrst, 'reload schema';
