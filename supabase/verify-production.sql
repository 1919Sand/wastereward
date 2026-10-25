-- Read-only production verification. Run after production-hardening-update.sql.
-- Every issue count should be 0 and migration_applied should be true.

select exists (
  select 1 from public.schema_migrations
  where version = '20261021_production_ready'
) as migration_applied;

select exists (
  select 1 from public.schema_migrations
  where version = '20261025_green_pass'
) as green_pass_migration_applied;

select exists (
  select 1 from public.schema_migrations
  where version = '20261025_partner_sponsor_program'
) as partner_sponsor_migration_applied;

with required_tables(table_name) as (
  values ('merchant_partners'), ('merchant_users'), ('merchant_offers'),
         ('green_pass_redemptions'), ('sponsors'), ('sponsor_campaigns')
)
select coalesce(array_agg(r.table_name) filter (where t.table_name is null), '{}') as missing_green_pass_tables
from required_tables r
left join information_schema.tables t
  on t.table_schema = 'public'
 and t.table_name = r.table_name;

with required_columns(column_name) as (
  values
    ('family_number'), ('email'), ('mobile_number'), ('address_line_1'),
    ('city'), ('state_province'), ('locality'), ('country'), ('pin_code'),
    ('latitude'), ('longitude'), ('claim_code_hash'), ('green_pause_days'),
    ('referral_green_pause_days')
)
select coalesce(array_agg(r.column_name) filter (where c.column_name is null), '{}') as missing_family_columns
from required_columns r
left join information_schema.columns c
  on c.table_schema = 'public'
 and c.table_name = 'families'
 and c.column_name = r.column_name;

select
  to_regprocedure('public.claim_family(text,text,uuid,text)') is not null as claim_function_ready,
  to_regprocedure('public.admin_adjust_points(text,text,integer,date,text,text)') is not null as points_function_ready,
  to_regprocedure('public.get_monthly_leaderboard(uuid,text,date,integer)') is not null as leaderboard_function_ready,
  to_regprocedure('public.issue_green_pass_offer(uuid,uuid)') is not null as green_pass_issue_function_ready;

select count(*) as duplicate_family_dates
from (
  select family_id, date
  from public.point_transactions
  group by family_id, date
  having count(*) > 1
) duplicates;

select count(*) as point_total_mismatches
from public.families f
where f.points <> coalesce((
  select sum(t.points) from public.point_transactions t where t.family_id = f.id
), 0);

select count(*) as invalid_point_statuses
from public.point_transactions
where status not in ('completed', 'missed', 'green_pause')
   or (status = 'completed' and points <= 0)
   or (status in ('missed', 'green_pause') and points <> 0);

select count(*) as invalid_locations
from public.families
where (latitude is null) <> (longitude is null)
   or latitude not between -90 and 90
   or longitude not between -180 and 180;

select
  count(*) as families,
  count(*) filter (where user_id is not null) as claimed_families,
  count(*) filter (where latitude is not null and longitude is not null) as location_enabled_families,
  (select count(*) from public.point_transactions) as point_entries
from public.families;
