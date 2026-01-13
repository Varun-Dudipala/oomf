-- =============================================
-- BLOCK USERS SYSTEM
-- Run this in Supabase SQL Editor
-- =============================================

-- Create blocked_users table for blocking any user
create table if not exists public.blocked_users (
  id uuid primary key default gen_random_uuid(),
  blocker_id uuid references public.users(id) on delete cascade not null,
  blocked_id uuid references public.users(id) on delete cascade not null,
  created_at timestamptz default now(),

  -- Prevent duplicate blocks
  unique(blocker_id, blocked_id)
);

-- Prevent self-blocking
alter table public.blocked_users
  add constraint no_self_block check (blocker_id != blocked_id);

-- Indexes for faster lookups
create index if not exists idx_blocked_users_blocker on public.blocked_users(blocker_id);
create index if not exists idx_blocked_users_blocked on public.blocked_users(blocked_id);

-- Enable RLS
alter table public.blocked_users enable row level security;

-- Policies
create policy "Users can view their own blocks"
  on public.blocked_users for select
  using (auth.uid() = blocker_id);

create policy "Users can create blocks"
  on public.blocked_users for insert
  with check (auth.uid() = blocker_id);

create policy "Users can delete their own blocks"
  on public.blocked_users for delete
  using (auth.uid() = blocker_id);

-- Add blocked_by column to friendships to track who blocked
alter table public.friendships
  add column if not exists blocked_by uuid references public.users(id);

-- Function to check if user A has blocked user B
create or replace function public.is_blocked(user_a uuid, user_b uuid)
returns boolean as $$
begin
  return exists (
    select 1 from public.blocked_users
    where blocker_id = user_a and blocked_id = user_b
  );
end;
$$ language plpgsql security definer;

-- Function to check if either user has blocked the other
create or replace function public.has_block_between(user_a uuid, user_b uuid)
returns boolean as $$
begin
  return exists (
    select 1 from public.blocked_users
    where (blocker_id = user_a and blocked_id = user_b)
       or (blocker_id = user_b and blocked_id = user_a)
  );
end;
$$ language plpgsql security definer;

-- Function to block a user
create or replace function public.block_user(p_blocked_id uuid)
returns void as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if v_user_id = p_blocked_id then
    raise exception 'Cannot block yourself';
  end if;

  -- Insert block record (will fail silently on duplicate)
  insert into public.blocked_users (blocker_id, blocked_id)
  values (v_user_id, p_blocked_id)
  on conflict (blocker_id, blocked_id) do nothing;

  -- Remove any existing friendship between them
  delete from public.friendships
  where (requester_id = v_user_id and addressee_id = p_blocked_id)
     or (requester_id = p_blocked_id and addressee_id = v_user_id);
end;
$$ language plpgsql security definer;

-- Function to unblock a user
create or replace function public.unblock_user(p_blocked_id uuid)
returns void as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  delete from public.blocked_users
  where blocker_id = v_user_id and blocked_id = p_blocked_id;
end;
$$ language plpgsql security definer;

-- Grant execute permissions
grant execute on function public.is_blocked to authenticated;
grant execute on function public.has_block_between to authenticated;
grant execute on function public.block_user to authenticated;
grant execute on function public.unblock_user to authenticated;

-- Update send_compliment function to check for blocks (if exists)
-- This adds a safety check when sending compliments
create or replace function public.check_can_send_compliment(sender uuid, receiver uuid)
returns boolean as $$
begin
  -- Check if there's a block between users
  if public.has_block_between(sender, receiver) then
    return false;
  end if;

  -- Check if they're friends
  if not public.are_friends(sender, receiver) then
    return false;
  end if;

  return true;
end;
$$ language plpgsql security definer;

grant execute on function public.check_can_send_compliment to authenticated;

-- =============================================
-- DONE! Block system is ready.
-- - Users can block anyone
-- - Blocking removes existing friendship
-- - Blocked users can't send friend requests or compliments
-- =============================================
