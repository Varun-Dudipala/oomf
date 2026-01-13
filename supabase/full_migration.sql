-- =============================================
-- OOMF DATABASE SCHEMA
-- Run this entire script in Supabase SQL Editor
-- =============================================

-- =============================================
-- 1. USERS TABLE
-- =============================================

create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  username text unique not null,
  display_name text not null,
  avatar_url text,
  bio text,

  -- Gamification
  oomf_score int default 0,
  level int default 1,
  tokens int default 3,

  -- Streaks
  streak_current int default 0,
  streak_best int default 0,
  streak_last_date date,

  -- Stats
  compliments_sent int default 0,
  compliments_received int default 0,
  correct_guesses int default 0,

  -- Push notifications
  expo_push_token text,

  -- Timestamps
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Username constraints
alter table public.users
  add constraint username_length check (char_length(username) >= 3 and char_length(username) <= 20),
  add constraint username_format check (username ~ '^[a-zA-Z0-9_]+$');

-- Display name constraints
alter table public.users
  add constraint display_name_length check (char_length(display_name) >= 1 and char_length(display_name) <= 30);

-- Bio constraints
alter table public.users
  add constraint bio_length check (bio is null or char_length(bio) <= 150);

-- Indexes
create index if not exists idx_users_username on public.users(username);
create index if not exists idx_users_oomf_score on public.users(oomf_score desc);

-- Enable RLS
alter table public.users enable row level security;

-- Policies
create policy "Public profiles are viewable by everyone"
  on public.users for select
  using (true);

create policy "Users can insert their own profile"
  on public.users for insert
  with check (auth.uid() = id);

create policy "Users can update their own profile"
  on public.users for update
  using (auth.uid() = id);

-- Updated_at trigger
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger users_updated_at
  before update on public.users
  for each row
  execute function public.handle_updated_at();

-- =============================================
-- 2. FRIENDSHIPS TABLE
-- =============================================

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

-- =============================================
-- 3. TEMPLATES TABLE
-- =============================================

create table if not exists public.templates (
  id uuid primary key default gen_random_uuid(),
  text text not null,
  emoji text,
  category text not null check (category in ('vibes', 'funny', 'smart', 'looks', 'skills', 'trust')),
  is_active boolean default true,
  usage_count int default 0,
  created_at timestamptz default now()
);

-- Index
create index if not exists idx_templates_category on public.templates(category);
create index if not exists idx_templates_active on public.templates(is_active);

-- Enable RLS (templates are public read)
alter table public.templates enable row level security;

create policy "Templates are viewable by everyone"
  on public.templates for select
  using (is_active = true);

-- Seed initial templates
insert into public.templates (text, emoji, category) values
-- Vibes
('You have immaculate vibes', '✨', 'vibes'),
('Your energy is unmatched', '⚡', 'vibes'),
('You light up every room', '🌟', 'vibes'),
('Main character energy', '👑', 'vibes'),
('You''re the vibe', '💫', 'vibes'),
('Your presence is everything', '🔥', 'vibes'),

-- Funny
('Lowkey the funniest person I know', '😂', 'funny'),
('You always make me laugh', '🤣', 'funny'),
('Your humor is elite', '😆', 'funny'),
('Comedy genius', '🎭', 'funny'),
('You have the best comebacks', '💬', 'funny'),
('Never a dull moment with you', '😄', 'funny'),

-- Smart
('Smartest person in the room', '🧠', 'smart'),
('Your brain is scary good', '💡', 'smart'),
('You always have the answers', '📚', 'smart'),
('Big brain energy', '🎓', 'smart'),
('Secretly a genius', '🤓', 'smart'),
('Your ideas are next level', '💭', 'smart'),

-- Looks
('You''re actually so pretty', '✨', 'looks'),
('Your style is immaculate', '👗', 'looks'),
('Always looking good', '💅', 'looks'),
('Fit check: passed', '🔥', 'looks'),
('You have the best aesthetic', '🎨', 'looks'),
('Effortlessly cool', '😎', 'looks'),

-- Skills
('You''re insanely talented', '🎯', 'skills'),
('Wish I had your skills', '💪', 'skills'),
('You make it look easy', '🏆', 'skills'),
('Built different', '⭐', 'skills'),
('You''re going places', '🚀', 'skills'),
('So good at what you do', '👏', 'skills'),

-- Trust
('I''d trust you with anything', '🤝', 'trust'),
('You give the best advice', '💬', 'trust'),
('Always got my back', '🛡️', 'trust'),
('Ride or die', '❤️', 'trust'),
('You''re always there when it matters', '🫂', 'trust'),
('The most reliable person I know', '💯', 'trust')

on conflict do nothing;

-- =============================================
-- 4. COMPLIMENTS TABLE
-- =============================================

create table if not exists public.compliments (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid references public.users(id) on delete cascade not null,
  receiver_id uuid references public.users(id) on delete cascade not null,
  template_id uuid references public.templates(id) not null,

  -- Status
  is_read boolean default false,
  is_revealed boolean default false,
  reveal_method text check (reveal_method in ('guessed', 'tokens', null)),
  guesses_remaining int default 3,

  -- Timestamps
  created_at timestamptz default now(),
  read_at timestamptz,
  revealed_at timestamptz
);

-- Prevent self-compliments
alter table public.compliments
  add constraint no_self_compliment check (sender_id != receiver_id);

-- Indexes
create index if not exists idx_compliments_receiver on public.compliments(receiver_id, created_at desc);
create index if not exists idx_compliments_sender on public.compliments(sender_id, created_at desc);
create index if not exists idx_compliments_unread on public.compliments(receiver_id, is_read) where is_read = false;

-- Enable RLS
alter table public.compliments enable row level security;

-- Policies
create policy "Users can view compliments they sent or received"
  on public.compliments for select
  using (auth.uid() = sender_id or auth.uid() = receiver_id);

create policy "Users can send compliments to friends"
  on public.compliments for insert
  with check (
    auth.uid() = sender_id
    and public.are_friends(sender_id, receiver_id)
  );

create policy "Users can update compliments they received"
  on public.compliments for update
  using (auth.uid() = receiver_id);

-- =============================================
-- 5. GUESSES TABLE
-- =============================================

create table if not exists public.guesses (
  id uuid primary key default gen_random_uuid(),
  compliment_id uuid references public.compliments(id) on delete cascade not null,
  guesser_id uuid references public.users(id) on delete cascade not null,
  guessed_user_id uuid references public.users(id) on delete cascade not null,
  is_correct boolean not null,
  created_at timestamptz default now()
);

-- Index
create index if not exists idx_guesses_compliment on public.guesses(compliment_id);

-- Enable RLS
alter table public.guesses enable row level security;

create policy "Users can view their own guesses"
  on public.guesses for select
  using (auth.uid() = guesser_id);

create policy "Users can create guesses"
  on public.guesses for insert
  with check (auth.uid() = guesser_id);

-- =============================================
-- 6. RPC FUNCTIONS
-- =============================================

-- Function to send a compliment
create or replace function public.send_compliment(
  p_receiver_id uuid,
  p_template_id uuid
)
returns uuid as $$
declare
  v_compliment_id uuid;
  v_sender_id uuid := auth.uid();
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
  where id = v_sender_id;

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

-- Function to make a guess
create or replace function public.make_guess(
  p_compliment_id uuid,
  p_guessed_user_id uuid
)
returns boolean as $$
declare
  v_compliment record;
  v_is_correct boolean;
  v_guesser_id uuid := auth.uid();
begin
  -- Get compliment details
  select * into v_compliment
  from public.compliments
  where id = p_compliment_id;

  -- Check if user is the receiver
  if v_compliment.receiver_id != v_guesser_id then
    raise exception 'You can only guess on compliments you received';
  end if;

  -- Check if already revealed
  if v_compliment.is_revealed then
    raise exception 'This compliment has already been revealed';
  end if;

  -- Check if guesses remaining
  if v_compliment.guesses_remaining <= 0 then
    raise exception 'No guesses remaining';
  end if;

  -- Check if guess is correct
  v_is_correct := (v_compliment.sender_id = p_guessed_user_id);

  -- Record the guess
  insert into public.guesses (compliment_id, guesser_id, guessed_user_id, is_correct)
  values (p_compliment_id, v_guesser_id, p_guessed_user_id, v_is_correct);

  -- Update compliment
  if v_is_correct then
    update public.compliments
    set is_revealed = true,
        reveal_method = 'guessed',
        revealed_at = now(),
        guesses_remaining = guesses_remaining - 1
    where id = p_compliment_id;

    -- Award points for correct guess
    update public.users
    set correct_guesses = correct_guesses + 1,
        oomf_score = oomf_score + 5
    where id = v_guesser_id;
  else
    update public.compliments
    set guesses_remaining = guesses_remaining - 1
    where id = p_compliment_id;
  end if;

  return v_is_correct;
end;
$$ language plpgsql security definer;

-- =============================================
-- DONE! Your database is ready.
-- =============================================
