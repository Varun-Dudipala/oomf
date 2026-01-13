-- Create compliments table
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

-- Create guesses table
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
