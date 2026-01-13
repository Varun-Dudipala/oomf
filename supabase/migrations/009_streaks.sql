-- =============================================
-- ENHANCED STREAK SYSTEM
-- Run this in Supabase SQL Editor
-- =============================================

-- Add streak freeze and milestone fields to users
alter table public.users
  add column if not exists streak_freezes int default 1,
  add column if not exists streak_freeze_used_date date;

-- Streak milestones table for tracking achievements
create table if not exists public.streak_milestones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade not null,
  milestone_days int not null,
  achieved_at timestamptz default now(),
  unique(user_id, milestone_days)
);

-- Index
create index if not exists idx_streak_milestones_user on public.streak_milestones(user_id);

-- Enable RLS
alter table public.streak_milestones enable row level security;

-- Policies
create policy "Users can view their own streak milestones"
  on public.streak_milestones for select
  using (auth.uid() = user_id);

-- Streak milestone definitions
-- 3, 7, 14, 30, 60, 100, 365 days

-- Function to update streak when user sends a compliment
create or replace function public.update_streak_on_activity()
returns trigger as $$
declare
  v_user record;
  v_today date := current_date;
  v_new_streak int;
  v_milestone_days int[] := array[3, 7, 14, 30, 60, 100, 365];
  v_day int;
begin
  -- Get user's current streak info
  select * into v_user from public.users where id = new.sender_id;

  -- Calculate new streak
  if v_user.streak_last_date = v_today then
    -- Already sent today, no change
    return new;
  elsif v_user.streak_last_date = v_today - interval '1 day' then
    -- Consecutive day, increment streak
    v_new_streak := v_user.streak_current + 1;
  elsif v_user.streak_last_date < v_today - interval '1 day' then
    -- Streak broken
    -- Check if they have a freeze and haven't used it today
    if v_user.streak_freezes > 0
       and (v_user.streak_freeze_used_date is null or v_user.streak_freeze_used_date < v_today - interval '1 day')
       and v_user.streak_last_date = v_today - interval '2 days' then
      -- Use freeze to maintain streak
      v_new_streak := v_user.streak_current + 1;
      update public.users
      set streak_freezes = streak_freezes - 1,
          streak_freeze_used_date = v_today
      where id = new.sender_id;
    else
      -- Streak broken, reset to 1
      v_new_streak := 1;
    end if;
  else
    -- First activity or null date
    v_new_streak := 1;
  end if;

  -- Update user streak
  update public.users
  set streak_current = v_new_streak,
      streak_last_date = v_today,
      streak_best = greatest(streak_best, v_new_streak)
  where id = new.sender_id;

  -- Check for milestones
  foreach v_day in array v_milestone_days loop
    if v_new_streak >= v_day then
      insert into public.streak_milestones (user_id, milestone_days)
      values (new.sender_id, v_day)
      on conflict (user_id, milestone_days) do nothing;
    end if;
  end loop;

  return new;
end;
$$ language plpgsql security definer;

-- Trigger to update streak on compliment send
drop trigger if exists update_streak_trigger on public.compliments;
create trigger update_streak_trigger
  after insert on public.compliments
  for each row
  execute function public.update_streak_on_activity();

-- Function to get streak status
create or replace function public.get_streak_status(p_user_id uuid)
returns table (
  current_streak int,
  best_streak int,
  freezes_available int,
  last_activity_date date,
  is_at_risk boolean,
  milestones_achieved int[]
) as $$
begin
  return query
  select
    u.streak_current,
    u.streak_best,
    u.streak_freezes,
    u.streak_last_date,
    case
      when u.streak_last_date = current_date then false
      when u.streak_last_date = current_date - interval '1 day' then true
      else false
    end as is_at_risk,
    array_agg(sm.milestone_days order by sm.milestone_days) filter (where sm.milestone_days is not null)
  from public.users u
  left join public.streak_milestones sm on sm.user_id = u.id
  where u.id = p_user_id
  group by u.id;
end;
$$ language plpgsql security definer;

-- Function to earn a freeze (users get 1 free freeze per week, max 2)
create or replace function public.earn_streak_freeze(p_user_id uuid)
returns int as $$
declare
  v_current_freezes int;
begin
  select streak_freezes into v_current_freezes
  from public.users
  where id = p_user_id;

  -- Max 2 freezes
  if v_current_freezes < 2 then
    update public.users
    set streak_freezes = streak_freezes + 1
    where id = p_user_id
    returning streak_freezes into v_current_freezes;
  end if;

  return v_current_freezes;
end;
$$ language plpgsql security definer;

-- =============================================
-- DONE! Enhanced streak system is ready.
-- =============================================
