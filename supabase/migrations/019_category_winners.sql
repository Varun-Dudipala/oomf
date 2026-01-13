-- =============================================
-- CATEGORY WINNERS FOR WEEKLY PODIUM
-- Run this in Supabase SQL Editor
-- =============================================

-- Function to get category winners for the current week
create or replace function public.get_weekly_category_winners()
returns table (
  category text,
  user_id uuid,
  username text,
  display_name text,
  avatar_url text,
  category_count bigint
) as $$
begin
  return query
  with week_compliments as (
    select
      c.receiver_id,
      t.category,
      count(*) as cat_count
    from public.compliments c
    join public.templates t on c.template_id = t.id
    where c.created_at >= date_trunc('week', current_date)
      and c.created_at < date_trunc('week', current_date) + interval '7 days'
      and t.category is not null
    group by c.receiver_id, t.category
  ),
  ranked as (
    select
      wc.receiver_id,
      wc.category,
      wc.cat_count,
      row_number() over (partition by wc.category order by wc.cat_count desc) as rank
    from week_compliments wc
  )
  select
    r.category,
    u.id as user_id,
    u.username,
    u.display_name,
    u.avatar_url,
    r.cat_count as category_count
  from ranked r
  join public.users u on r.receiver_id = u.id
  where r.rank = 1
  order by r.cat_count desc
  limit 6; -- Top 6 categories
end;
$$ language plpgsql security definer;

-- Grant execute permission
grant execute on function public.get_weekly_category_winners to authenticated;

-- =============================================
-- DONE! Category winners function is ready.
-- Returns the top user for each category this week.
-- Categories: vibes, funny, smart, looks, skills, etc.
-- =============================================
