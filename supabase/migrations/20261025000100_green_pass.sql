begin;

update public.families
set email = lower(btrim(email))
where email <> lower(btrim(email));

create table if not exists public.merchant_partners (
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
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint merchant_partners_location_pair_check check ((latitude is null) = (longitude is null))
);

create table if not exists public.merchant_offers (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchant_partners(id) on delete cascade,
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

create table if not exists public.green_pass_redemptions (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  offer_id uuid not null references public.merchant_offers(id) on delete restrict,
  merchant_id uuid not null references public.merchant_partners(id) on delete restrict,
  redemption_code text not null unique,
  points_threshold integer not null check (points_threshold >= 0),
  bill_amount numeric(10,2) check (bill_amount is null or bill_amount >= 0),
  status text not null default 'issued' check (status in ('issued', 'redeemed', 'expired', 'cancelled')),
  expires_at timestamptz not null,
  redeemed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.merchant_partners enable row level security;
alter table public.merchant_offers enable row level security;
alter table public.green_pass_redemptions enable row level security;

create index if not exists merchant_partners_pin_code_idx on public.merchant_partners (pin_code) where is_active;
create index if not exists merchant_partners_city_lower_idx on public.merchant_partners (lower(city)) where is_active;
create index if not exists merchant_partners_locality_lower_idx on public.merchant_partners (lower(locality)) where is_active;
create index if not exists merchant_offers_merchant_active_idx on public.merchant_offers (merchant_id, is_active);
create index if not exists green_pass_redemptions_family_created_idx on public.green_pass_redemptions (family_id, created_at desc);
create index if not exists green_pass_redemptions_offer_family_idx on public.green_pass_redemptions (offer_id, family_id);

insert into public.schema_migrations(version)
values ('20261025_green_pass')
on conflict (version) do nothing;

commit;
notify pgrst, 'reload schema';
