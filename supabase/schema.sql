create table public.schema_migrations (
  version text primary key,
  applied_at timestamptz not null default now()
);

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
  latitude double precision check (latitude is null or latitude between -90 and 90),
  longitude double precision check (longitude is null or longitude between -180 and 180),
  location_updated_at timestamptz,
  constraint families_location_pair_check check ((latitude is null) = (longitude is null)),
  user_id uuid unique references auth.users(id),
  claim_code_hash text,
  claim_code_expires_at timestamptz,
  claim_code_used_at timestamptz,
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
  status text not null default 'completed' check (status in ('completed', 'missed', 'green_pause')),
  pause_source text check (pause_source is null or pause_source in ('regular', 'referral')),
  created_at timestamptz not null default now(),
  unique (family_id, date)
);

create table public.merchant_partners (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  category text not null,
  description text not null default '',
  address text not null default '',
  locality text not null default '',
  city text not null default '',
  state_province text not null default '',
  pin_code text not null default '',
  latitude double precision check (latitude is null or latitude between -90 and 90),
  longitude double precision check (longitude is null or longitude between -180 and 180),
  contact_name text not null default '',
  contact_email text not null default '',
  contact_phone text not null default '',
  partnership_status text not null default 'active' check (partnership_status in ('pending', 'active', 'paused', 'rejected')),
  terms_accepted_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint merchant_partners_location_pair_check check ((latitude is null) = (longitude is null))
);

create table public.merchant_users (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchant_partners(id) on delete cascade,
  email text not null unique check (email = lower(btrim(email))),
  user_id uuid unique references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.sponsors (
  id uuid primary key default gen_random_uuid(), name text not null, slug text not null unique,
  description text not null default '', website_url text not null default '',
  contact_name text not null default '', contact_email text not null default '',
  is_active boolean not null default true, created_at timestamptz not null default now()
);

create table public.sponsor_campaigns (
  id uuid primary key default gen_random_uuid(),
  sponsor_id uuid not null references public.sponsors(id) on delete restrict,
  title text not null, description text not null default '',
  budget_amount numeric(12,2) not null check (budget_amount > 0),
  max_redemptions integer not null check (max_redemptions > 0),
  starts_on date not null default current_date, ends_on date not null,
  status text not null default 'draft' check (status in ('draft', 'active', 'paused', 'completed')),
  created_at timestamptz not null default now(),
  constraint sponsor_campaigns_date_check check (ends_on >= starts_on)
);

create table public.merchant_offers (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchant_partners(id) on delete cascade,
  sponsor_campaign_id uuid references public.sponsor_campaigns(id) on delete restrict,
  funding_source text not null default 'merchant' check ((funding_source = 'merchant' and sponsor_campaign_id is null) or (funding_source = 'sponsor' and sponsor_campaign_id is not null)),
  title text not null,
  description text not null default '',
  points_required integer not null default 0 check (points_required >= 0),
  min_purchase numeric(10,2) not null default 0 check (min_purchase >= 0),
  discount_amount numeric(10,2) not null default 0 check (discount_amount >= 0),
  usage_limit_per_family integer not null default 1 check (usage_limit_per_family > 0),
  valid_from date not null default current_date,
  valid_until date,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint merchant_offers_date_check check (valid_until is null or valid_until >= valid_from)
);

create table public.green_pass_redemptions (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  offer_id uuid not null references public.merchant_offers(id) on delete restrict,
  merchant_id uuid not null references public.merchant_partners(id) on delete restrict,
  sponsor_campaign_id uuid references public.sponsor_campaigns(id) on delete restrict,
  funding_amount numeric(10,2) not null default 0 check (funding_amount >= 0),
  redemption_code text not null unique,
  points_threshold integer not null check (points_threshold >= 0),
  bill_amount numeric(10,2) check (bill_amount is null or bill_amount >= 0),
  status text not null default 'issued' check (status in ('issued', 'redeemed', 'expired', 'cancelled')),
  expires_at timestamptz not null,
  redeemed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.admin_point_audit (
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

create index families_referred_by_family_id_idx on public.families (referred_by_family_id);
create index families_pin_code_idx on public.families (pin_code) where pin_code <> '';
create index families_city_lower_idx on public.families (lower(city)) where city <> '';
create index families_state_lower_idx on public.families (lower(state_province)) where state_province <> '';
create index families_country_lower_idx on public.families (lower(country)) where country <> '';
create index merchant_partners_pin_code_idx on public.merchant_partners (pin_code) where is_active;
create index merchant_partners_city_lower_idx on public.merchant_partners (lower(city)) where is_active;
create index merchant_partners_locality_lower_idx on public.merchant_partners (lower(locality)) where is_active;
create index merchant_offers_merchant_active_idx on public.merchant_offers (merchant_id, is_active);
create index green_pass_redemptions_family_created_idx on public.green_pass_redemptions (family_id, created_at desc);
create index green_pass_redemptions_offer_family_idx on public.green_pass_redemptions (offer_id, family_id);
create index merchant_users_merchant_idx on public.merchant_users (merchant_id);
create index sponsor_campaigns_sponsor_status_idx on public.sponsor_campaigns (sponsor_id, status);
create index merchant_offers_campaign_idx on public.merchant_offers (sponsor_campaign_id) where sponsor_campaign_id is not null;
create index green_pass_redemptions_campaign_idx on public.green_pass_redemptions (sponsor_campaign_id, status) where sponsor_campaign_id is not null;

alter table public.families enable row level security;
alter table public.point_transactions enable row level security;
alter table public.admin_point_audit enable row level security;
alter table public.schema_migrations enable row level security;
alter table public.merchant_partners enable row level security;
alter table public.merchant_offers enable row level security;
alter table public.green_pass_redemptions enable row level security;
alter table public.merchant_users enable row level security;
alter table public.sponsors enable row level security;
alter table public.sponsor_campaigns enable row level security;

create policy "Members can read their household" on public.families
  for select to authenticated using (auth.uid() = user_id);
create policy "Members can read their point history" on public.point_transactions
  for select to authenticated using (
    exists (select 1 from public.families where families.id = point_transactions.family_id and families.user_id = auth.uid())
  );

create or replace function public.claim_family(p_waste_reward_id text, p_claim_code_hash text, p_user_id uuid, p_email text)
returns table (id uuid)
language plpgsql security definer set search_path = public as $$
begin
  return query
  update public.families
     set user_id = p_user_id
       , claim_code_used_at = now()
       , claim_code_hash = null
   where waste_reward_id = p_waste_reward_id
     and claim_code_hash = p_claim_code_hash
     and claim_code_expires_at > now()
     and claim_code_used_at is null
     and (email = '' or lower(email) = lower(p_email))
     and user_id is null
  returning families.id;
end;
$$;

create or replace function public.admin_adjust_points(p_waste_reward_id text, p_reason text, p_points integer, p_date date, p_status text, p_admin_email text)
returns void
language plpgsql security definer set search_path = public as $$
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
  if next_status = 'completed' and p_points <= 0 then
    raise exception 'Completed days must award positive points.';
  end if;
  if p_date > (now() at time zone 'Asia/Kolkata')::date then
    raise exception 'Future activity dates are not allowed.';
  end if;

  select points, status, pause_source into previous_points, previous_status, previous_pause_source
    from public.point_transactions
   where family_id = family_row.id and date = p_date;
  previous_points := coalesce(previous_points, 0);
  previous_status := coalesce(previous_status, family_row.days ->> p_date::text);

  if family_row.points - previous_points + p_points < 0 then
    raise exception 'Points cannot fall below zero.';
  end if;

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
  select max(key::date) into cursor_date
    from jsonb_each_text(updated_days)
   where key::date <= (now() at time zone 'Asia/Kolkata')::date and value in ('completed', 'missed', 'green_pause');
  if cursor_date < (now() at time zone 'Asia/Kolkata')::date - 1 then cursor_date := null; end if;
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

  update public.families
    set points = points - previous_points + p_points,
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

revoke all on function public.claim_family(text, text, uuid, text) from public;
revoke all on function public.admin_adjust_points(text, text, integer, date, text, text) from public;
grant execute on function public.claim_family(text, text, uuid, text) to service_role;
grant execute on function public.admin_adjust_points(text, text, integer, date, text, text) to service_role;

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
revoke all on function public.award_referral_green_pause() from public;

create or replace function public.get_monthly_leaderboard(
  p_viewer_family_id uuid,
  p_scope text,
  p_month date,
  p_limit integer default 20
)
returns table (
  "position" bigint,
  waste_reward_id text,
  family_number text,
  family_name text,
  city text,
  state_province text,
  locality text,
  monthly_points bigint,
  is_current boolean
)
language sql security definer stable set search_path = public as $$
  with viewer as (
    select id, city, state_province, pin_code, country, latitude, longitude
      from public.families
     where id = p_viewer_family_id
  ), scores as (
    select f.id, f.waste_reward_id, f.family_number, f.family_name,
           f.city, f.state_province, f.locality, f.created_at,
           coalesce(sum(t.points), 0)::bigint as monthly_points
      from public.families f
      cross join viewer v
      left join public.point_transactions t
        on t.family_id = f.id
       and t.date >= date_trunc('month', p_month)::date
       and t.date < (date_trunc('month', p_month) + interval '1 month')::date
     where case p_scope
       when 'india' then lower(f.country) = 'india'
       when 'state' then f.id = v.id or (
         nullif(btrim(v.state_province), '') is not null and lower(f.state_province) = lower(v.state_province)
       )
       when 'city' then f.id = v.id or (
         nullif(btrim(v.city), '') is not null and lower(f.city) = lower(v.city)
       )
       when 'nearby' then case
         when v.latitude is not null and v.longitude is not null
           then f.id = v.id
             or (f.latitude is not null and f.longitude is not null and
               6371 * 2 * asin(least(1, sqrt(
                 power(sin(radians(f.latitude - v.latitude) / 2), 2) +
                 cos(radians(v.latitude)) * cos(radians(f.latitude)) *
                 power(sin(radians(f.longitude - v.longitude) / 2), 2)
               ))) <= 5)
             or (nullif(btrim(v.pin_code), '') is not null and
                 f.latitude is null and f.longitude is null and f.pin_code = v.pin_code)
         else f.id = v.id or (
           nullif(btrim(v.pin_code), '') is not null and f.pin_code = v.pin_code
         )
       end
       else false
     end
     group by f.id
  ), ranked as (
    select row_number() over (order by monthly_points desc, created_at asc, waste_reward_id asc) as "position",
           scores.*
      from scores
  )
  select r."position", r.waste_reward_id, r.family_number, r.family_name,
         r.city, r.state_province, r.locality, r.monthly_points,
         r.id = p_viewer_family_id as is_current
    from ranked r
   where r."position" <= least(greatest(p_limit, 1), 20) or r.id = p_viewer_family_id
   order by r."position";
$$;
revoke all on function public.get_monthly_leaderboard(uuid, text, date, integer) from public;
grant execute on function public.get_monthly_leaderboard(uuid, text, date, integer) to service_role;

create function public.issue_green_pass_offer(p_family_id uuid, p_offer_id uuid)
returns table (id uuid, redemption_code text, status text, expires_at timestamptz)
language plpgsql security definer set search_path = public, extensions as $$
declare
  selected_offer record;
  family_points integer;
  used_by_family integer;
  campaign_count integer;
  campaign_spend numeric(12,2);
  selected_campaign record;
  generated_code text;
  created_id uuid;
  created_expiry timestamptz := now() + interval '15 minutes';
begin
  select f.points into family_points from public.families f where f.id = p_family_id for update;
  if not found then raise exception 'Household was not found.'; end if;
  select o.*, m.is_active as merchant_active, m.partnership_status
    into selected_offer from public.merchant_offers o
    join public.merchant_partners m on m.id = o.merchant_id
   where o.id = p_offer_id for update of o, m;
  if not found or not selected_offer.is_active or not selected_offer.merchant_active or selected_offer.partnership_status <> 'active' then raise exception 'This offer is no longer available.'; end if;
  if current_date < selected_offer.valid_from or (selected_offer.valid_until is not null and current_date > selected_offer.valid_until) then raise exception 'This offer is outside its validity period.'; end if;
  if family_points < selected_offer.points_required then raise exception 'More points are required to unlock this offer.'; end if;
  update public.green_pass_redemptions set status = 'expired' where family_id = p_family_id and offer_id = p_offer_id and status = 'issued' and expires_at < now();
  select count(*) into used_by_family from public.green_pass_redemptions where family_id = p_family_id and offer_id = p_offer_id and status in ('issued', 'redeemed');
  if used_by_family >= selected_offer.usage_limit_per_family then raise exception 'You have already used this offer.'; end if;
  if selected_offer.funding_source = 'sponsor' then
    select * into selected_campaign from public.sponsor_campaigns where id = selected_offer.sponsor_campaign_id for update;
    if not found or selected_campaign.status <> 'active' or current_date < selected_campaign.starts_on or current_date > selected_campaign.ends_on then raise exception 'This sponsored campaign is not active.'; end if;
    select count(*), coalesce(sum(funding_amount), 0) into campaign_count, campaign_spend from public.green_pass_redemptions where sponsor_campaign_id = selected_offer.sponsor_campaign_id and status in ('issued', 'redeemed');
    if campaign_count >= selected_campaign.max_redemptions or campaign_spend + selected_offer.discount_amount > selected_campaign.budget_amount then raise exception 'This sponsored reward is fully claimed.'; end if;
  end if;
  generated_code := upper(encode(gen_random_bytes(3), 'hex'));
  insert into public.green_pass_redemptions (family_id, offer_id, merchant_id, redemption_code, points_threshold, expires_at, sponsor_campaign_id, funding_amount)
  values (p_family_id, p_offer_id, selected_offer.merchant_id, generated_code, selected_offer.points_required, created_expiry, selected_offer.sponsor_campaign_id, case when selected_offer.funding_source = 'sponsor' then selected_offer.discount_amount else 0 end)
  returning green_pass_redemptions.id into created_id;
  return query select created_id, generated_code, 'issued'::text, created_expiry;
end;
$$;
revoke all on function public.issue_green_pass_offer(uuid, uuid) from public;
grant execute on function public.issue_green_pass_offer(uuid, uuid) to service_role;

insert into public.schema_migrations(version) values ('20261021_production_ready');
insert into public.schema_migrations(version) values ('20261025_green_pass');
insert into public.schema_migrations(version) values ('20261025_partner_sponsor_program');
