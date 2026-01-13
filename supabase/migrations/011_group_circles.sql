-- =============================================
-- GROUP CIRCLES - Private Friend Groups
-- Run this in Supabase SQL Editor
-- =============================================

-- Circles table
create table if not exists public.circles (
  id uuid primary key default gen_random_uuid(),
  name varchar(50) not null,
  emoji varchar(10) not null default '👥',
  description text,
  owner_id uuid references public.users(id) on delete cascade not null,
  is_private boolean default true,
  color varchar(7) default '#6C5CE7', -- Hex color for the circle
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Circle members table
create table if not exists public.circle_members (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid references public.circles(id) on delete cascade not null,
  user_id uuid references public.users(id) on delete cascade not null,
  joined_at timestamptz default now(),
  unique(circle_id, user_id)
);

-- Indexes
create index if not exists idx_circles_owner on public.circles(owner_id);
create index if not exists idx_circle_members_circle on public.circle_members(circle_id);
create index if not exists idx_circle_members_user on public.circle_members(user_id);

-- Enable RLS
alter table public.circles enable row level security;
alter table public.circle_members enable row level security;

-- Policies for circles
create policy "Users can view circles they own or are members of"
  on public.circles for select
  using (
    auth.uid() = owner_id
    or exists (
      select 1 from public.circle_members
      where circle_id = circles.id and user_id = auth.uid()
    )
  );

create policy "Users can create circles"
  on public.circles for insert
  with check (auth.uid() = owner_id);

create policy "Only owners can update circles"
  on public.circles for update
  using (auth.uid() = owner_id);

create policy "Only owners can delete circles"
  on public.circles for delete
  using (auth.uid() = owner_id);

-- Policies for circle members
create policy "Users can view members of circles they're in"
  on public.circle_members for select
  using (
    exists (
      select 1 from public.circles
      where id = circle_members.circle_id
      and (owner_id = auth.uid() or exists (
        select 1 from public.circle_members cm
        where cm.circle_id = circles.id and cm.user_id = auth.uid()
      ))
    )
  );

create policy "Circle owners can add members"
  on public.circle_members for insert
  with check (
    exists (
      select 1 from public.circles
      where id = circle_members.circle_id and owner_id = auth.uid()
    )
  );

create policy "Circle owners can remove members"
  on public.circle_members for delete
  using (
    exists (
      select 1 from public.circles
      where id = circle_members.circle_id and owner_id = auth.uid()
    )
    or user_id = auth.uid() -- Members can leave circles
  );

-- Function to get user's circles with member counts
create or replace function public.get_user_circles(p_user_id uuid)
returns table (
  id uuid,
  name varchar(50),
  emoji varchar(10),
  description text,
  owner_id uuid,
  is_private boolean,
  color varchar(7),
  created_at timestamptz,
  member_count bigint,
  is_owner boolean
) as $$
begin
  return query
  select
    c.id,
    c.name,
    c.emoji,
    c.description,
    c.owner_id,
    c.is_private,
    c.color,
    c.created_at,
    (select count(*) from public.circle_members cm where cm.circle_id = c.id) as member_count,
    c.owner_id = p_user_id as is_owner
  from public.circles c
  where c.owner_id = p_user_id
     or exists (
       select 1 from public.circle_members cm
       where cm.circle_id = c.id and cm.user_id = p_user_id
     )
  order by c.created_at desc;
end;
$$ language plpgsql security definer;

-- Function to get circle members with profiles
create or replace function public.get_circle_members(p_circle_id uuid)
returns table (
  user_id uuid,
  username varchar(30),
  display_name varchar(50),
  avatar_url text,
  oomf_score int,
  joined_at timestamptz
) as $$
begin
  return query
  select
    u.id as user_id,
    u.username,
    u.display_name,
    u.avatar_url,
    u.oomf_score,
    cm.joined_at
  from public.circle_members cm
  join public.users u on u.id = cm.user_id
  where cm.circle_id = p_circle_id
  order by cm.joined_at;
end;
$$ language plpgsql security definer;

-- Function to create a circle
create or replace function public.create_circle(
  p_owner_id uuid,
  p_name varchar(50),
  p_emoji varchar(10) default '👥',
  p_description text default null,
  p_color varchar(7) default '#6C5CE7'
)
returns uuid as $$
declare
  v_circle_id uuid;
begin
  -- Create the circle
  insert into public.circles (name, emoji, description, owner_id, color)
  values (p_name, p_emoji, p_description, p_owner_id, p_color)
  returning id into v_circle_id;

  -- Add owner as first member
  insert into public.circle_members (circle_id, user_id)
  values (v_circle_id, p_owner_id);

  return v_circle_id;
end;
$$ language plpgsql security definer;

-- Function to add member to circle (must be friends with owner)
create or replace function public.add_circle_member(
  p_circle_id uuid,
  p_user_id uuid,
  p_requester_id uuid
)
returns boolean as $$
declare
  v_owner_id uuid;
begin
  -- Get circle owner
  select owner_id into v_owner_id
  from public.circles
  where id = p_circle_id;

  -- Check requester is owner
  if v_owner_id != p_requester_id then
    raise exception 'Only the circle owner can add members';
  end if;

  -- Check if already a member
  if exists (select 1 from public.circle_members where circle_id = p_circle_id and user_id = p_user_id) then
    return true; -- Already a member
  end if;

  -- Check if they're friends
  if not exists (
    select 1 from public.friendships
    where status = 'accepted'
    and ((user_id = v_owner_id and friend_id = p_user_id)
      or (user_id = p_user_id and friend_id = v_owner_id))
  ) then
    raise exception 'Can only add friends to circles';
  end if;

  -- Add member
  insert into public.circle_members (circle_id, user_id)
  values (p_circle_id, p_user_id);

  return true;
end;
$$ language plpgsql security definer;

-- Grant execute permissions
grant execute on function public.get_user_circles to authenticated;
grant execute on function public.get_circle_members to authenticated;
grant execute on function public.create_circle to authenticated;
grant execute on function public.add_circle_member to authenticated;

-- =============================================
-- DONE! Group Circles feature is ready.
-- =============================================
