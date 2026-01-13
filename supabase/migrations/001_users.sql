-- Create users table
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
