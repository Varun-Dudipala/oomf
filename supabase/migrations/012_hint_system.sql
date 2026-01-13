-- =============================================
-- HINT SYSTEM - 3 Hints Before Full Reveal
-- Run this in Supabase SQL Editor
-- =============================================

-- Add hints tracking to compliments
alter table public.compliments
  add column if not exists hints_used int default 0;

-- Hint costs:
-- Hint 1 (first letter): 1 token
-- Hint 2 (join date): 1 token
-- Hint 3 (level): 1 token
-- Full reveal: 3 tokens (after hints) or 3 tokens (skip hints)

-- Function to get a hint for a compliment
create or replace function public.get_compliment_hint(
  p_compliment_id uuid,
  p_hint_number int
)
returns jsonb as $$
declare
  v_compliment record;
  v_sender record;
  v_user_id uuid := auth.uid();
  v_current_tokens int;
  v_hint_result jsonb;
begin
  -- Validate hint number
  if p_hint_number < 1 or p_hint_number > 3 then
    raise exception 'Invalid hint number. Must be 1, 2, or 3.';
  end if;

  -- Get compliment details
  select * into v_compliment
  from public.compliments
  where id = p_compliment_id;

  if not found then
    raise exception 'Compliment not found';
  end if;

  -- Check if user is the receiver
  if v_compliment.receiver_id != v_user_id then
    raise exception 'You can only get hints for compliments you received';
  end if;

  -- Check if already revealed
  if v_compliment.is_revealed then
    raise exception 'This compliment has already been revealed';
  end if;

  -- Check if hint already used
  if v_compliment.hints_used >= p_hint_number then
    raise exception 'This hint has already been used';
  end if;

  -- Check hints are in order
  if p_hint_number > v_compliment.hints_used + 1 then
    raise exception 'You must get hints in order. Next hint: %', v_compliment.hints_used + 1;
  end if;

  -- Get user's current tokens
  select tokens into v_current_tokens
  from public.users
  where id = v_user_id;

  -- Check if user has enough tokens (1 token per hint)
  if v_current_tokens < 1 then
    raise exception 'Not enough tokens. Need 1 token for a hint.';
  end if;

  -- Get sender info
  select * into v_sender
  from public.users
  where id = v_compliment.sender_id;

  -- Generate hint based on number
  case p_hint_number
    when 1 then
      -- First letter of username
      v_hint_result := jsonb_build_object(
        'hint_type', 'first_letter',
        'hint_text', 'Username starts with',
        'hint_value', upper(left(v_sender.username, 1))
      );
    when 2 then
      -- When they joined
      v_hint_result := jsonb_build_object(
        'hint_type', 'join_date',
        'hint_text', 'Joined Oomf',
        'hint_value', to_char(v_sender.created_at, 'Month YYYY')
      );
    when 3 then
      -- Their current level (based on oomf_score)
      v_hint_result := jsonb_build_object(
        'hint_type', 'level',
        'hint_text', 'Current level',
        'hint_value', case
          when v_sender.oomf_score >= 1000 then 'Mythic'
          when v_sender.oomf_score >= 500 then 'Legendary'
          when v_sender.oomf_score >= 300 then 'Oomf Lord'
          when v_sender.oomf_score >= 150 then 'On Fire'
          when v_sender.oomf_score >= 75 then 'Warming Up'
          when v_sender.oomf_score >= 25 then 'Rising'
          else 'Newcomer'
        end
      );
  end case;

  -- Deduct token
  update public.users
  set tokens = tokens - 1
  where id = v_user_id;

  -- Update hints used
  update public.compliments
  set hints_used = p_hint_number
  where id = p_compliment_id;

  return v_hint_result;
end;
$$ language plpgsql security definer;

-- Update reveal function to cost 3 tokens for full reveal
create or replace function public.reveal_with_tokens(p_compliment_id uuid)
returns jsonb as $$
declare
  v_compliment record;
  v_sender record;
  v_user_id uuid := auth.uid();
  v_current_tokens int;
  v_reveal_cost int := 3;
begin
  -- Get compliment details
  select * into v_compliment
  from public.compliments
  where id = p_compliment_id;

  if not found then
    raise exception 'Compliment not found';
  end if;

  -- Check if user is the receiver
  if v_compliment.receiver_id != v_user_id then
    raise exception 'You can only reveal compliments you received';
  end if;

  -- Check if already revealed
  if v_compliment.is_revealed then
    raise exception 'This compliment has already been revealed';
  end if;

  -- Get user's current tokens
  select tokens into v_current_tokens
  from public.users
  where id = v_user_id;

  -- Check if user has enough tokens
  if v_current_tokens < v_reveal_cost then
    raise exception 'Not enough tokens. Need % tokens for full reveal.', v_reveal_cost;
  end if;

  -- Get sender info
  select * into v_sender
  from public.users
  where id = v_compliment.sender_id;

  -- Deduct tokens
  update public.users
  set tokens = tokens - v_reveal_cost
  where id = v_user_id;

  -- Reveal the compliment
  update public.compliments
  set is_revealed = true,
      reveal_method = 'tokens',
      revealed_at = now()
  where id = p_compliment_id;

  -- Return sender info
  return jsonb_build_object(
    'sender_id', v_sender.id,
    'username', v_sender.username,
    'display_name', v_sender.display_name,
    'avatar_url', v_sender.avatar_url
  );
end;
$$ language plpgsql security definer;

-- Grant execute permissions
grant execute on function public.get_compliment_hint to authenticated;

-- =============================================
-- DONE! Hint system is ready.
-- Hint 1: First letter (1 token)
-- Hint 2: Join date (1 token)
-- Hint 3: Level (1 token)
-- Full reveal: 3 tokens
-- =============================================
