-- =============================================
-- MAX 150 FRIENDS LIMIT
-- Run this in Supabase SQL Editor
-- =============================================

-- Function to count accepted friends
create or replace function public.count_friends(p_user_id uuid)
returns int as $$
  select count(*)::int
  from public.friendships
  where (requester_id = p_user_id or addressee_id = p_user_id)
    and status = 'accepted';
$$ language sql security definer;

-- Function to check if user can add more friends
create or replace function public.can_add_friend(p_user_id uuid)
returns boolean as $$
  select public.count_friends(p_user_id) < 150;
$$ language sql security definer;

-- Update accept friend request to check limits
create or replace function public.accept_friend_request(p_friendship_id uuid)
returns void as $$
declare
  v_user_id uuid := auth.uid();
  v_requester_id uuid;
  v_addressee_id uuid;
begin
  -- Get friendship details
  select requester_id, addressee_id into v_requester_id, v_addressee_id
  from public.friendships
  where id = p_friendship_id and status = 'pending';

  if not found then
    raise exception 'Friend request not found or already processed';
  end if;

  -- Verify current user is the addressee
  if v_addressee_id != v_user_id then
    raise exception 'You can only accept requests sent to you';
  end if;

  -- Check if both users are under the limit
  if not public.can_add_friend(v_requester_id) then
    raise exception 'The other user has reached maximum friends (150)';
  end if;

  if not public.can_add_friend(v_addressee_id) then
    raise exception 'You have reached maximum friends (150)';
  end if;

  -- Accept the request
  update public.friendships
  set status = 'accepted',
      accepted_at = now()
  where id = p_friendship_id;
end;
$$ language plpgsql security definer;

-- Grant execute permissions
grant execute on function public.count_friends to authenticated;
grant execute on function public.can_add_friend to authenticated;
grant execute on function public.accept_friend_request to authenticated;

-- =============================================
-- DONE! Max 150 friends limit is ready.
-- - Users cannot have more than 150 friends
-- - Both sender and receiver limits are checked
-- =============================================
