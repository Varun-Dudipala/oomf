-- =============================================
-- PODIUM NOTIFICATIONS
-- Run this in Supabase SQL Editor
-- =============================================

-- Table to track user's last known podium position
-- This helps us detect when a user newly enters the podium
create table if not exists public.user_podium_status (
  user_id uuid primary key references public.users(id) on delete cascade,
  last_rank int,
  last_week_start date,
  notified_at timestamptz,
  updated_at timestamptz default now()
);

-- Enable RLS
alter table public.user_podium_status enable row level security;

-- Users can only view their own podium status
create policy "Users can view own podium status"
  on public.user_podium_status for select
  using (auth.uid() = user_id);

-- Function to check and notify podium users
-- This should be called periodically (e.g., by a cron job or when leaderboard is fetched)
create or replace function public.check_and_notify_podium_user(p_user_id uuid)
returns jsonb as $$
declare
  v_week_start date;
  v_current_rank int;
  v_last_rank int;
  v_last_week date;
  v_user_push_token text;
  v_should_notify boolean := false;
begin
  -- Get current week start (Monday)
  v_week_start := date_trunc('week', current_date)::date;

  -- Get user's current rank from weekly leaderboard
  with weekly_activity as (
    select
      u.id as user_id,
      count(case when c.sender_id = u.id then 1 end) +
      count(case when c.receiver_id = u.id then 1 end) as total_activity
    from public.users u
    left join public.compliments c on (c.sender_id = u.id or c.receiver_id = u.id)
      and c.created_at >= v_week_start
      and c.created_at < v_week_start + interval '7 days'
    group by u.id
    having count(case when c.sender_id = u.id then 1 end) +
           count(case when c.receiver_id = u.id then 1 end) > 0
  ),
  ranked as (
    select
      user_id,
      total_activity,
      row_number() over (order by total_activity desc) as rank
    from weekly_activity
  )
  select rank into v_current_rank
  from ranked
  where user_id = p_user_id;

  -- User not on leaderboard this week
  if v_current_rank is null then
    return jsonb_build_object('on_podium', false, 'rank', null);
  end if;

  -- Get user's last known status
  select last_rank, last_week_start into v_last_rank, v_last_week
  from public.user_podium_status
  where user_id = p_user_id;

  -- Determine if we should notify
  -- Notify if:
  -- 1. User is now in top 3
  -- 2. AND (this is a new week OR they weren't in top 3 before OR this is their first time)
  if v_current_rank <= 3 then
    if v_last_week is null or v_last_week < v_week_start or v_last_rank is null or v_last_rank > 3 then
      v_should_notify := true;
    end if;
  end if;

  -- Update podium status
  insert into public.user_podium_status (user_id, last_rank, last_week_start, notified_at, updated_at)
  values (
    p_user_id,
    v_current_rank,
    v_week_start,
    case when v_should_notify then now() else null end,
    now()
  )
  on conflict (user_id) do update set
    last_rank = v_current_rank,
    last_week_start = v_week_start,
    notified_at = case when v_should_notify then now() else user_podium_status.notified_at end,
    updated_at = now();

  -- If should notify, queue the notification
  if v_should_notify then
    select expo_push_token into v_user_push_token
    from public.users
    where id = p_user_id;

    if v_user_push_token is not null then
      insert into public.pending_notifications (user_id, type, title, body, data)
      values (
        p_user_id,
        'podium',
        'You Made the Podium! ' ||
          case v_current_rank
            when 1 then '🥇'
            when 2 then '🥈'
            when 3 then '🥉'
          end,
        'Congrats! You''re #' || v_current_rank || ' on this week''s leaderboard! Keep spreading the love.',
        jsonb_build_object(
          'type', 'podium',
          'rank', v_current_rank
        )
      );
    end if;
  end if;

  return jsonb_build_object(
    'on_podium', v_current_rank <= 3,
    'rank', v_current_rank,
    'notified', v_should_notify
  );
end;
$$ language plpgsql security definer;

-- Grant execute permission
grant execute on function public.check_and_notify_podium_user to authenticated;

-- =============================================
-- DONE! Podium notifications are ready.
-- Call check_and_notify_podium_user(user_id) when:
-- 1. User fetches the leaderboard
-- 2. User sends/receives a compliment
-- The function handles duplicate notification prevention.
-- =============================================
