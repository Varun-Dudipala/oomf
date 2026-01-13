-- =============================================
-- BADGES SYSTEM
-- Run this in Supabase SQL Editor
-- =============================================

-- Badges table
create table if not exists public.badges (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  emoji text not null,
  requirement_type text not null check (
    requirement_type in (
      'compliments_sent',
      'compliments_received',
      'correct_guesses',
      'streak_days',
      'friends_count',
      'account_age_days',
      'level_reached',
      'podium_count',
      'early_adopter'
    )
  ),
  requirement_value int not null default 0,
  is_secret boolean default false,
  created_at timestamptz default now()
);

-- User badges junction table
create table if not exists public.user_badges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade not null,
  badge_id uuid references public.badges(id) on delete cascade not null,
  earned_at timestamptz default now(),
  unique(user_id, badge_id)
);

-- Indexes
create index if not exists idx_user_badges_user on public.user_badges(user_id);
create index if not exists idx_badges_type on public.badges(requirement_type);

-- Enable RLS
alter table public.badges enable row level security;
alter table public.user_badges enable row level security;

-- Policies for badges (public read)
create policy "Badges are viewable by everyone"
  on public.badges for select
  using (true);

-- Policies for user_badges
create policy "Users can view their own badges"
  on public.user_badges for select
  using (auth.uid() = user_id);

create policy "Users can view any user badges"
  on public.user_badges for select
  using (true);

-- Seed badges
insert into public.badges (name, description, emoji, requirement_type, requirement_value) values
-- Compliments sent badges
('First Oomf', 'Send your first compliment', '💌', 'compliments_sent', 1),
('Hype Machine', 'Send 10 compliments', '🎉', 'compliments_sent', 10),
('Oomf Pro', 'Send 50 compliments', '🌟', 'compliments_sent', 50),
('Legendary Giver', 'Send 100 compliments', '👑', 'compliments_sent', 100),
('Oomf Master', 'Send 500 compliments', '💫', 'compliments_sent', 500),

-- Compliments received badges
('First Hype', 'Receive your first compliment', '💝', 'compliments_received', 1),
('Popular', 'Receive 10 compliments', '⭐', 'compliments_received', 10),
('Beloved', 'Receive 50 compliments', '💖', 'compliments_received', 50),
('Fan Favorite', 'Receive 100 compliments', '🏆', 'compliments_received', 100),
('Icon', 'Receive 500 compliments', '✨', 'compliments_received', 500),

-- Guessing badges
('Lucky Guess', 'Guess correctly once', '🎯', 'correct_guesses', 1),
('Sharp Eye', 'Guess correctly 10 times', '👁️', 'correct_guesses', 10),
('Mind Reader', 'Guess correctly 50 times', '🔮', 'correct_guesses', 50),

-- Streak badges
('Getting Started', 'Reach a 3-day streak', '🌱', 'streak_days', 3),
('Week Warrior', 'Reach a 7-day streak', '🔥', 'streak_days', 7),
('Streak Master', 'Reach a 30-day streak', '💪', 'streak_days', 30),
('Unstoppable', 'Reach a 100-day streak', '🏅', 'streak_days', 100),

-- Friends badges
('Social', 'Add 5 friends', '👋', 'friends_count', 5),
('Social Butterfly', 'Add 20 friends', '🦋', 'friends_count', 20),
('Influencer', 'Add 50 friends', '🌐', 'friends_count', 50),
('Super Connector', 'Add 100 friends', '🤝', 'friends_count', 100),

-- Level badges
('Rising Star', 'Reach level 2', '⭐', 'level_reached', 2),
('On Fire', 'Reach level 3', '🔥', 'level_reached', 3),
('Oomf Lord', 'Reach level 4', '👑', 'level_reached', 4),
('Legendary', 'Reach level 5', '💫', 'level_reached', 5),

-- Account age badges
('Early Bird', 'Account is 7 days old', '🐣', 'account_age_days', 7),
('Regular', 'Account is 30 days old', '📅', 'account_age_days', 30),
('OG', 'Account is 365 days old', '🎂', 'account_age_days', 365)

on conflict (name) do nothing;

-- Function to check and award badges
create or replace function public.check_and_award_badges(p_user_id uuid)
returns table (
  badge_id uuid,
  badge_name text,
  badge_emoji text,
  newly_awarded boolean
) as $$
declare
  v_user record;
  v_badge record;
  v_friends_count int;
  v_account_age int;
begin
  -- Get user stats
  select * into v_user from public.users where id = p_user_id;

  -- Calculate friends count
  select count(*) into v_friends_count
  from public.friendships
  where (requester_id = p_user_id or addressee_id = p_user_id)
    and status = 'accepted';

  -- Calculate account age in days
  v_account_age := extract(day from now() - v_user.created_at);

  -- Check each badge
  for v_badge in select * from public.badges loop
    -- Skip if user already has this badge
    if exists (select 1 from public.user_badges where user_id = p_user_id and badge_id = v_badge.id) then
      badge_id := v_badge.id;
      badge_name := v_badge.name;
      badge_emoji := v_badge.emoji;
      newly_awarded := false;
      return next;
      continue;
    end if;

    -- Check if user qualifies for badge
    case v_badge.requirement_type
      when 'compliments_sent' then
        if v_user.compliments_sent >= v_badge.requirement_value then
          insert into public.user_badges (user_id, badge_id)
          values (p_user_id, v_badge.id);
          badge_id := v_badge.id;
          badge_name := v_badge.name;
          badge_emoji := v_badge.emoji;
          newly_awarded := true;
          return next;
        end if;
      when 'compliments_received' then
        if v_user.compliments_received >= v_badge.requirement_value then
          insert into public.user_badges (user_id, badge_id)
          values (p_user_id, v_badge.id);
          badge_id := v_badge.id;
          badge_name := v_badge.name;
          badge_emoji := v_badge.emoji;
          newly_awarded := true;
          return next;
        end if;
      when 'correct_guesses' then
        if v_user.correct_guesses >= v_badge.requirement_value then
          insert into public.user_badges (user_id, badge_id)
          values (p_user_id, v_badge.id);
          badge_id := v_badge.id;
          badge_name := v_badge.name;
          badge_emoji := v_badge.emoji;
          newly_awarded := true;
          return next;
        end if;
      when 'streak_days' then
        if v_user.streak_best >= v_badge.requirement_value then
          insert into public.user_badges (user_id, badge_id)
          values (p_user_id, v_badge.id);
          badge_id := v_badge.id;
          badge_name := v_badge.name;
          badge_emoji := v_badge.emoji;
          newly_awarded := true;
          return next;
        end if;
      when 'friends_count' then
        if v_friends_count >= v_badge.requirement_value then
          insert into public.user_badges (user_id, badge_id)
          values (p_user_id, v_badge.id);
          badge_id := v_badge.id;
          badge_name := v_badge.name;
          badge_emoji := v_badge.emoji;
          newly_awarded := true;
          return next;
        end if;
      when 'level_reached' then
        if v_user.level >= v_badge.requirement_value then
          insert into public.user_badges (user_id, badge_id)
          values (p_user_id, v_badge.id);
          badge_id := v_badge.id;
          badge_name := v_badge.name;
          badge_emoji := v_badge.emoji;
          newly_awarded := true;
          return next;
        end if;
      when 'account_age_days' then
        if v_account_age >= v_badge.requirement_value then
          insert into public.user_badges (user_id, badge_id)
          values (p_user_id, v_badge.id);
          badge_id := v_badge.id;
          badge_name := v_badge.name;
          badge_emoji := v_badge.emoji;
          newly_awarded := true;
          return next;
        end if;
      else
        -- Skip other types (like early_adopter which is manually awarded)
        null;
    end case;
  end loop;
end;
$$ language plpgsql security definer;

-- =============================================
-- DONE! Badges system is ready.
-- =============================================
