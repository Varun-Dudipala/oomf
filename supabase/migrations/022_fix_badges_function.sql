-- =============================================
-- FIX BADGES FUNCTION - Resolve ambiguous column reference
-- Run this in Supabase SQL Editor
-- =============================================

-- Drop and recreate the function with fixed column names
drop function if exists public.check_and_award_badges(uuid);

create or replace function public.check_and_award_badges(p_user_id uuid)
returns table (
  out_badge_id uuid,
  out_badge_name text,
  out_badge_emoji text,
  out_newly_awarded boolean
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
    if exists (select 1 from public.user_badges ub where ub.user_id = p_user_id and ub.badge_id = v_badge.id) then
      out_badge_id := v_badge.id;
      out_badge_name := v_badge.name;
      out_badge_emoji := v_badge.emoji;
      out_newly_awarded := false;
      return next;
      continue;
    end if;

    -- Check if user qualifies for badge
    case v_badge.requirement_type
      when 'compliments_sent' then
        if v_user.compliments_sent >= v_badge.requirement_value then
          insert into public.user_badges (user_id, badge_id)
          values (p_user_id, v_badge.id);
          out_badge_id := v_badge.id;
          out_badge_name := v_badge.name;
          out_badge_emoji := v_badge.emoji;
          out_newly_awarded := true;
          return next;
        end if;
      when 'compliments_received' then
        if v_user.compliments_received >= v_badge.requirement_value then
          insert into public.user_badges (user_id, badge_id)
          values (p_user_id, v_badge.id);
          out_badge_id := v_badge.id;
          out_badge_name := v_badge.name;
          out_badge_emoji := v_badge.emoji;
          out_newly_awarded := true;
          return next;
        end if;
      when 'correct_guesses' then
        if v_user.correct_guesses >= v_badge.requirement_value then
          insert into public.user_badges (user_id, badge_id)
          values (p_user_id, v_badge.id);
          out_badge_id := v_badge.id;
          out_badge_name := v_badge.name;
          out_badge_emoji := v_badge.emoji;
          out_newly_awarded := true;
          return next;
        end if;
      when 'streak_days' then
        if v_user.streak_best >= v_badge.requirement_value then
          insert into public.user_badges (user_id, badge_id)
          values (p_user_id, v_badge.id);
          out_badge_id := v_badge.id;
          out_badge_name := v_badge.name;
          out_badge_emoji := v_badge.emoji;
          out_newly_awarded := true;
          return next;
        end if;
      when 'friends_count' then
        if v_friends_count >= v_badge.requirement_value then
          insert into public.user_badges (user_id, badge_id)
          values (p_user_id, v_badge.id);
          out_badge_id := v_badge.id;
          out_badge_name := v_badge.name;
          out_badge_emoji := v_badge.emoji;
          out_newly_awarded := true;
          return next;
        end if;
      when 'level_reached' then
        if v_user.level >= v_badge.requirement_value then
          insert into public.user_badges (user_id, badge_id)
          values (p_user_id, v_badge.id);
          out_badge_id := v_badge.id;
          out_badge_name := v_badge.name;
          out_badge_emoji := v_badge.emoji;
          out_newly_awarded := true;
          return next;
        end if;
      when 'account_age_days' then
        if v_account_age >= v_badge.requirement_value then
          insert into public.user_badges (user_id, badge_id)
          values (p_user_id, v_badge.id);
          out_badge_id := v_badge.id;
          out_badge_name := v_badge.name;
          out_badge_emoji := v_badge.emoji;
          out_newly_awarded := true;
          return next;
        end if;
      else
        -- Skip other types (like early_adopter which is manually awarded)
        null;
    end case;
  end loop;
end;
$$ language plpgsql security definer;

-- Grant execute permission
grant execute on function public.check_and_award_badges to authenticated;

-- =============================================
-- DONE! Badges function fixed.
-- =============================================
