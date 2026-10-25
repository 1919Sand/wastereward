begin;

alter table public.merchant_partners
  add column if not exists contact_name text not null default '',
  add column if not exists contact_email text not null default '',
  add column if not exists contact_phone text not null default '',
  add column if not exists partnership_status text not null default 'active',
  add column if not exists terms_accepted_at timestamptz;

do $$ begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.merchant_partners'::regclass and conname = 'merchant_partners_partnership_status_check') then
    alter table public.merchant_partners add constraint merchant_partners_partnership_status_check
      check (partnership_status in ('pending', 'active', 'paused', 'rejected'));
  end if;
end $$;

create table if not exists public.merchant_users (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchant_partners(id) on delete cascade,
  email text not null unique check (email = lower(btrim(email))),
  user_id uuid unique references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.sponsors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text not null default '',
  website_url text not null default '',
  contact_name text not null default '',
  contact_email text not null default '',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.sponsor_campaigns (
  id uuid primary key default gen_random_uuid(),
  sponsor_id uuid not null references public.sponsors(id) on delete restrict,
  title text not null,
  description text not null default '',
  budget_amount numeric(12,2) not null check (budget_amount > 0),
  max_redemptions integer not null check (max_redemptions > 0),
  starts_on date not null default current_date,
  ends_on date not null,
  status text not null default 'draft' check (status in ('draft', 'active', 'paused', 'completed')),
  created_at timestamptz not null default now(),
  constraint sponsor_campaigns_date_check check (ends_on >= starts_on)
);

alter table public.merchant_offers
  add column if not exists sponsor_campaign_id uuid references public.sponsor_campaigns(id) on delete restrict,
  add column if not exists funding_source text not null default 'merchant';

do $$ begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.merchant_offers'::regclass and conname = 'merchant_offers_funding_source_check') then
    alter table public.merchant_offers add constraint merchant_offers_funding_source_check
      check ((funding_source = 'merchant' and sponsor_campaign_id is null) or (funding_source = 'sponsor' and sponsor_campaign_id is not null));
  end if;
end $$;

alter table public.green_pass_redemptions
  add column if not exists sponsor_campaign_id uuid references public.sponsor_campaigns(id) on delete restrict,
  add column if not exists funding_amount numeric(10,2) not null default 0 check (funding_amount >= 0);

alter table public.merchant_users enable row level security;
alter table public.sponsors enable row level security;
alter table public.sponsor_campaigns enable row level security;

create index if not exists merchant_users_merchant_idx on public.merchant_users (merchant_id);
create index if not exists sponsor_campaigns_sponsor_status_idx on public.sponsor_campaigns (sponsor_id, status);
create index if not exists merchant_offers_campaign_idx on public.merchant_offers (sponsor_campaign_id) where sponsor_campaign_id is not null;
create index if not exists green_pass_redemptions_campaign_idx on public.green_pass_redemptions (sponsor_campaign_id, status) where sponsor_campaign_id is not null;

create or replace function public.issue_green_pass_offer(p_family_id uuid, p_offer_id uuid)
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
  attempt integer := 0;
begin
  select f.points into family_points from public.families f where f.id = p_family_id for update;
  if not found then raise exception 'Household was not found.'; end if;

  select o.*, m.name as merchant_name, m.is_active as merchant_active, m.partnership_status
    into selected_offer
    from public.merchant_offers o
    join public.merchant_partners m on m.id = o.merchant_id
   where o.id = p_offer_id
   for update of o, m;
  if not found or not selected_offer.is_active or not selected_offer.merchant_active or selected_offer.partnership_status <> 'active' then
    raise exception 'This offer is no longer available.';
  end if;
  if current_date < selected_offer.valid_from or (selected_offer.valid_until is not null and current_date > selected_offer.valid_until) then
    raise exception 'This offer is outside its validity period.';
  end if;
  if family_points < selected_offer.points_required then
    raise exception 'More points are required to unlock this offer.';
  end if;

  update public.green_pass_redemptions set status = 'expired'
   where family_id = p_family_id and offer_id = p_offer_id and status = 'issued' and expires_at < now();
  select count(*) into used_by_family from public.green_pass_redemptions
   where family_id = p_family_id and offer_id = p_offer_id and status in ('issued', 'redeemed');
  if used_by_family >= selected_offer.usage_limit_per_family then raise exception 'You have already used this offer.'; end if;

  if selected_offer.funding_source = 'sponsor' then
    select * into selected_campaign from public.sponsor_campaigns where id = selected_offer.sponsor_campaign_id for update;
    if not found or selected_campaign.status <> 'active' or current_date < selected_campaign.starts_on or current_date > selected_campaign.ends_on then
      raise exception 'This sponsored campaign is not active.';
    end if;
    select count(*), coalesce(sum(funding_amount), 0) into campaign_count, campaign_spend
      from public.green_pass_redemptions
     where sponsor_campaign_id = selected_offer.sponsor_campaign_id and status in ('issued', 'redeemed');
    if campaign_count >= selected_campaign.max_redemptions or campaign_spend + selected_offer.discount_amount > selected_campaign.budget_amount then
      raise exception 'This sponsored reward is fully claimed.';
    end if;
  end if;

  loop
    attempt := attempt + 1;
    generated_code := upper(encode(gen_random_bytes(3), 'hex'));
    begin
      insert into public.green_pass_redemptions
        (family_id, offer_id, merchant_id, redemption_code, points_threshold, expires_at, sponsor_campaign_id, funding_amount)
      values
        (p_family_id, p_offer_id, selected_offer.merchant_id, generated_code, selected_offer.points_required,
         created_expiry, selected_offer.sponsor_campaign_id,
         case when selected_offer.funding_source = 'sponsor' then selected_offer.discount_amount else 0 end)
      returning green_pass_redemptions.id into created_id;
      exit;
    exception when unique_violation then
      if attempt >= 5 then raise exception 'Unable to generate a redemption code. Please try again.'; end if;
    end;
  end loop;

  return query select created_id, generated_code, 'issued'::text, created_expiry;
end;
$$;
revoke all on function public.issue_green_pass_offer(uuid, uuid) from public;
grant execute on function public.issue_green_pass_offer(uuid, uuid) to service_role;

insert into public.schema_migrations(version) values ('20261025_partner_sponsor_program') on conflict (version) do nothing;
commit;
notify pgrst, 'reload schema';
