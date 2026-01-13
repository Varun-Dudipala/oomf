-- =============================================
-- TOKEN ECONOMY - Reveal with Tokens
-- Run this in Supabase SQL Editor
-- =============================================

-- Function to reveal compliment sender using tokens
create or replace function public.reveal_with_tokens(p_compliment_id uuid)
returns boolean as $$
declare
  v_compliment record;
  v_user_id uuid := auth.uid();
  v_current_tokens int;
begin
  -- Get compliment details
  select * into v_compliment
  from public.compliments
  where id = p_compliment_id;

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
  if v_current_tokens < 1 then
    raise exception 'Not enough tokens';
  end if;

  -- Deduct token
  update public.users
  set tokens = tokens - 1
  where id = v_user_id;

  -- Reveal the compliment
  update public.compliments
  set is_revealed = true,
      reveal_method = 'tokens',
      revealed_at = now()
  where id = p_compliment_id;

  return true;
end;
$$ language plpgsql security definer;

-- Function to earn tokens (called after various actions)
create or replace function public.earn_tokens(
  p_user_id uuid,
  p_amount int,
  p_reason text
)
returns int as $$
declare
  v_new_balance int;
begin
  update public.users
  set tokens = tokens + p_amount
  where id = p_user_id
  returning tokens into v_new_balance;

  return v_new_balance;
end;
$$ language plpgsql security definer;

-- Update send_compliment to give tokens to sender occasionally
-- Users earn 1 token for every 5 compliments sent
create or replace function public.send_compliment(
  p_receiver_id uuid,
  p_template_id uuid
)
returns uuid as $$
declare
  v_compliment_id uuid;
  v_sender_id uuid := auth.uid();
  v_new_sent_count int;
begin
  -- Check if users are friends
  if not public.are_friends(v_sender_id, p_receiver_id) then
    raise exception 'You can only send compliments to friends';
  end if;

  -- Create the compliment
  insert into public.compliments (sender_id, receiver_id, template_id)
  values (v_sender_id, p_receiver_id, p_template_id)
  returning id into v_compliment_id;

  -- Update sender stats
  update public.users
  set compliments_sent = compliments_sent + 1,
      oomf_score = oomf_score + 1
  where id = v_sender_id
  returning compliments_sent into v_new_sent_count;

  -- Award token every 5 compliments sent
  if v_new_sent_count % 5 = 0 then
    update public.users
    set tokens = tokens + 1
    where id = v_sender_id;
  end if;

  -- Update receiver stats
  update public.users
  set compliments_received = compliments_received + 1,
      oomf_score = oomf_score + 3
  where id = p_receiver_id;

  -- Update template usage
  update public.templates
  set usage_count = usage_count + 1
  where id = p_template_id;

  return v_compliment_id;
end;
$$ language plpgsql security definer;

-- =============================================
-- DONE! Token economy is ready.
-- =============================================
