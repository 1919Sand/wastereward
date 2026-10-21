-- Run once in the Supabase SQL Editor after dashboard-update.sql.
-- Returns the monthly top 20 for the viewer's PIN, city, state, or India.
create or replace function public.get_monthly_leaderboard(
  p_viewer_family_id uuid,
  p_scope text,
  p_month date,
  p_limit integer default 20
)
returns table (
  position bigint,
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
    select id, city, state_province, pin_code, country
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
       when 'nearby' then f.id = v.id or (
         nullif(btrim(v.pin_code), '') is not null and f.pin_code = v.pin_code
       )
       else false
     end
     group by f.id
  ), ranked as (
    select row_number() over (order by monthly_points desc, created_at asc, waste_reward_id asc) as position,
           scores.*
      from scores
  )
  select r.position, r.waste_reward_id, r.family_number, r.family_name,
         r.city, r.state_province, r.locality, r.monthly_points,
         r.id = p_viewer_family_id as is_current
    from ranked r
   where r.position <= least(greatest(p_limit, 1), 20) or r.id = p_viewer_family_id
   order by r.position;
$$;
revoke all on function public.get_monthly_leaderboard(uuid, text, date, integer) from public;
grant execute on function public.get_monthly_leaderboard(uuid, text, date, integer) to service_role;
