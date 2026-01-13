-- =============================================
-- WEEKLY LEADERBOARD
-- Run this in Supabase SQL Editor
-- =============================================

-- Weekly leaderboard table to cache results
create table if not exists public.weekly_leaderboard (
  id uuid primary key default gen_random_uuid(),
  week_start date not null,
  week_end date not null,
  user_id uuid references public.users(id) on delete cascade not null,
  compliments_sent int default 0,
  compliments_received int default 0,
  total_score int default 0,
  rank int,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  unique(week_start, user_id)
);

-- Index
create index if not exists idx_weekly_leaderboard_week on public.weekly_leaderboard(week_start, rank);
create index if not exists idx_weekly_leaderboard_user on public.weekly_leaderboard(user_id);

-- Enable RLS
alter table public.weekly_leaderboard enable row level security;

-- Policies
create policy "Weekly leaderboard is viewable by everyone"
  on public.weekly_leaderboard for select
  using (true);

-- Function to get current week's leaderboard
create or replace function public.get_weekly_leaderboard(p_limit int default 10)
returns table (
  user_id uuid,
  username text,
  display_name text,
  avatar_url text,
  compliments_sent int,
  compliments_received int,
  total_activity int,
  rank bigint
) as $$
declare
  v_week_start date;
  v_week_end date;
begin
  -- Get current week boundaries (Monday to Sunday)
  v_week_start := date_trunc('week', now())::date;
  v_week_end := v_week_start + interval '6 days';

  return query
  with weekly_stats as (
    -- Sent compliments this week
    select
      c.sender_id as uid,
      count(*) as sent_count
    from public.compliments c
    where c.created_at >= v_week_start
      and c.created_at < v_week_end + interval '1 day'
    group by c.sender_id
  ),
  received_stats as (
    -- Received compliments this week
    select
      c.receiver_id as uid,
      count(*) as received_count
    from public.compliments c
    where c.created_at >= v_week_start
      and c.created_at < v_week_end + interval '1 day'
    group by c.receiver_id
  ),
  combined as (
    select
      coalesce(ws.uid, rs.uid) as uid,
      coalesce(ws.sent_count, 0)::int as sent,
      coalesce(rs.received_count, 0)::int as received,
      (coalesce(ws.sent_count, 0) + coalesce(rs.received_count, 0))::int as total
    from weekly_stats ws
    full outer join received_stats rs on ws.uid = rs.uid
  )
  select
    u.id as user_id,
    u.username,
    u.display_name,
    u.avatar_url,
    c.sent as compliments_sent,
    c.received as compliments_received,
    c.total as total_activity,
    row_number() over (order by c.total desc, c.sent desc) as rank
  from combined c
  join public.users u on u.id = c.uid
  order by rank
  limit p_limit;
end;
$$ language plpgsql security definer;

-- Function to get user's weekly rank
create or replace function public.get_user_weekly_rank(p_user_id uuid)
returns table (
  compliments_sent int,
  compliments_received int,
  total_activity int,
  rank bigint,
  total_participants bigint
) as $$
declare
  v_week_start date;
  v_week_end date;
begin
  -- Get current week boundaries
  v_week_start := date_trunc('week', now())::date;
  v_week_end := v_week_start + interval '6 days';

  return query
  with weekly_stats as (
    select
      c.sender_id as uid,
      count(*) as sent_count
    from public.compliments c
    where c.created_at >= v_week_start
      and c.created_at < v_week_end + interval '1 day'
    group by c.sender_id
  ),
  received_stats as (
    select
      c.receiver_id as uid,
      count(*) as received_count
    from public.compliments c
    where c.created_at >= v_week_start
      and c.created_at < v_week_end + interval '1 day'
    group by c.receiver_id
  ),
  combined as (
    select
      coalesce(ws.uid, rs.uid) as uid,
      coalesce(ws.sent_count, 0)::int as sent,
      coalesce(rs.received_count, 0)::int as received,
      (coalesce(ws.sent_count, 0) + coalesce(rs.received_count, 0))::int as total
    from weekly_stats ws
    full outer join received_stats rs on ws.uid = rs.uid
  ),
  ranked as (
    select
      c.uid,
      c.sent,
      c.received,
      c.total,
      row_number() over (order by c.total desc, c.sent desc) as user_rank
    from combined c
  )
  select
    r.sent as compliments_sent,
    r.received as compliments_received,
    r.total as total_activity,
    r.user_rank as rank,
    (select count(*) from ranked) as total_participants
  from ranked r
  where r.uid = p_user_id;
end;
$$ language plpgsql security definer;

-- =============================================
-- DONE! Weekly leaderboard is ready.
-- =============================================
