-- =============================================
-- STREAK FREEZE PURCHASE WITH TOKENS
-- Run this in Supabase SQL Editor
-- =============================================

-- Function to purchase a streak freeze with tokens
create or replace function public.purchase_streak_freeze()
returns jsonb as $$
declare
  v_user_id uuid := auth.uid();
  v_current_tokens int;
  v_current_freezes int;
  v_freeze_cost int := 5;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  -- Get current token balance and freezes
  select tokens, coalesce(streak_freezes, 0)
  into v_current_tokens, v_current_freezes
  from public.users
  where id = v_user_id;

  -- Check if user has enough tokens
  if v_current_tokens < v_freeze_cost then
    raise exception 'Not enough tokens. Need % tokens for a streak freeze.', v_freeze_cost;
  end if;

  -- Deduct tokens and add freeze
  update public.users
  set tokens = tokens - v_freeze_cost,
      streak_freezes = coalesce(streak_freezes, 0) + 1
  where id = v_user_id;

  return jsonb_build_object(
    'success', true,
    'tokens_spent', v_freeze_cost,
    'new_freeze_count', v_current_freezes + 1
  );
end;
$$ language plpgsql security definer;

-- Function to use a streak freeze
create or replace function public.use_streak_freeze()
returns jsonb as $$
declare
  v_user_id uuid := auth.uid();
  v_current_freezes int;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  -- Get current freezes
  select coalesce(streak_freezes, 0) into v_current_freezes
  from public.users
  where id = v_user_id;

  -- Check if user has a freeze
  if v_current_freezes < 1 then
    raise exception 'No streak freezes available';
  end if;

  -- Use the freeze - update last activity to today so streak continues
  update public.users
  set streak_freezes = streak_freezes - 1,
      streak_last_date = current_date
  where id = v_user_id;

  return jsonb_build_object(
    'success', true,
    'freezes_remaining', v_current_freezes - 1
  );
end;
$$ language plpgsql security definer;

-- Grant execute permissions
grant execute on function public.purchase_streak_freeze to authenticated;
grant execute on function public.use_streak_freeze to authenticated;

-- =============================================
-- DONE! Streak freeze purchase is ready.
-- Cost: 5 tokens per streak freeze
-- =============================================
