-- Create friendships table
create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid references public.users(id) on delete cascade not null,
  addressee_id uuid references public.users(id) on delete cascade not null,
  status text default 'pending' check (status in ('pending', 'accepted', 'blocked')),
  created_at timestamptz default now(),
  accepted_at timestamptz,

  -- Prevent duplicate requests
  unique(requester_id, addressee_id)
);

-- Prevent self-friendship
alter table public.friendships
  add constraint no_self_friendship check (requester_id != addressee_id);

-- Indexes
create index if not exists idx_friendships_requester on public.friendships(requester_id);
create index if not exists idx_friendships_addressee on public.friendships(addressee_id);
create index if not exists idx_friendships_status on public.friendships(status);
create index if not exists idx_friendships_lookup on public.friendships(requester_id, addressee_id, status);

-- Enable RLS
alter table public.friendships enable row level security;

-- Policies
create policy "Users can view their own friendships"
  on public.friendships for select
  using (auth.uid() = requester_id or auth.uid() = addressee_id);

create policy "Users can create friend requests"
  on public.friendships for insert
  with check (auth.uid() = requester_id);

create policy "Users can update friendships they're part of"
  on public.friendships for update
  using (auth.uid() = requester_id or auth.uid() = addressee_id);

create policy "Users can delete friendships they're part of"
  on public.friendships for delete
  using (auth.uid() = requester_id or auth.uid() = addressee_id);

-- Function to get mutual friends (accepted friendships)
create or replace function public.get_friends(user_id uuid)
returns table (friend_id uuid) as $$
begin
  return query
  select
    case
      when f.requester_id = user_id then f.addressee_id
      else f.requester_id
    end as friend_id
  from public.friendships f
  where (f.requester_id = user_id or f.addressee_id = user_id)
    and f.status = 'accepted';
end;
$$ language plpgsql security definer;

-- Function to check if two users are friends
create or replace function public.are_friends(user_a uuid, user_b uuid)
returns boolean as $$
begin
  return exists (
    select 1 from public.friendships
    where ((requester_id = user_a and addressee_id = user_b)
       or (requester_id = user_b and addressee_id = user_a))
      and status = 'accepted'
  );
end;
$$ language plpgsql security definer;
