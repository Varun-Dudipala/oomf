-- =============================================
-- SECRET ADMIRER - Custom Messages Feature
-- Run this in Supabase SQL Editor
-- =============================================

-- Add custom message support to compliments table
alter table public.compliments
  add column if not exists custom_message text,
  add column if not exists is_secret_admirer boolean default false,
  add column if not exists tokens_spent int default 0;

-- Secret Admirer costs 3 tokens
-- This allows sending a custom message instead of a template

-- Function to send a secret admirer message (custom message)
create or replace function public.send_secret_admirer(
  p_sender_id uuid,
  p_receiver_id uuid,
  p_custom_message text
)
returns uuid as $$
declare
  v_token_cost int := 3;
  v_sender_tokens int;
  v_compliment_id uuid;
begin
  -- Check sender has enough tokens
  select tokens into v_sender_tokens
  from public.users
  where id = p_sender_id;

  if v_sender_tokens < v_token_cost then
    raise exception 'Not enough tokens. Need % tokens, have %.', v_token_cost, v_sender_tokens;
  end if;

  -- Validate message
  if p_custom_message is null or length(trim(p_custom_message)) < 5 then
    raise exception 'Message must be at least 5 characters long.';
  end if;

  if length(p_custom_message) > 280 then
    raise exception 'Message cannot exceed 280 characters.';
  end if;

  -- Deduct tokens
  update public.users
  set tokens = tokens - v_token_cost
  where id = p_sender_id;

  -- Create the compliment
  insert into public.compliments (
    sender_id,
    receiver_id,
    template_id,
    custom_message,
    is_secret_admirer,
    tokens_spent
  )
  values (
    p_sender_id,
    p_receiver_id,
    null, -- No template for custom messages
    p_custom_message,
    true,
    v_token_cost
  )
  returning id into v_compliment_id;

  -- Update sender stats (still counts as sending)
  update public.users
  set compliments_sent = compliments_sent + 1,
      oomf_score = oomf_score + 15 -- Bonus points for using Secret Admirer
  where id = p_sender_id;

  -- Update receiver stats
  update public.users
  set compliments_received = compliments_received + 1
  where id = p_receiver_id;

  return v_compliment_id;
end;
$$ language plpgsql security definer;

-- Grant execute permission
grant execute on function public.send_secret_admirer to authenticated;

-- =============================================
-- DONE! Secret Admirer feature is ready.
-- Costs 3 tokens to send a custom message up to 280 characters.
-- =============================================
