-- =============================================
-- COMPLIMENT REACTIONS SYSTEM
-- Run this in Supabase SQL Editor
-- =============================================

-- Add reactions column to compliments table
alter table public.compliments
  add column if not exists reaction text check (reaction in ('fire', 'heart', 'laugh', 'cry', 'crown'));

-- Create function to react to a compliment
create or replace function public.react_to_compliment(
  p_compliment_id uuid,
  p_reaction text
)
returns void as $$
declare
  v_user_id uuid := auth.uid();
  v_compliment record;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  -- Validate reaction type
  if p_reaction is not null and p_reaction not in ('fire', 'heart', 'laugh', 'cry', 'crown') then
    raise exception 'Invalid reaction type. Must be fire, heart, laugh, cry, or crown';
  end if;

  -- Get compliment
  select * into v_compliment
  from public.compliments
  where id = p_compliment_id;

  if not found then
    raise exception 'Compliment not found';
  end if;

  -- Verify user is the receiver
  if v_compliment.receiver_id != v_user_id then
    raise exception 'You can only react to compliments you received';
  end if;

  -- Update reaction (null removes reaction)
  update public.compliments
  set reaction = p_reaction
  where id = p_compliment_id;
end;
$$ language plpgsql security definer;

-- Grant execute permission
grant execute on function public.react_to_compliment to authenticated;

-- =============================================
-- DONE! Reactions are ready.
-- Available reactions: fire, heart, laugh, cry, crown
-- Emoji mapping in app:
-- fire -> 🔥, heart -> ❤️, laugh -> 😂, cry -> 🥹, crown -> 👑
-- =============================================
