-- =============================================
-- SECRET ADMIRER CHAT - Back-and-forth messaging
-- Run this in Supabase SQL Editor
-- =============================================

-- Track secret admirer conversations
create table if not exists public.secret_admirer_chats (
  id uuid primary key default gen_random_uuid(),
  compliment_id uuid references public.compliments(id) on delete cascade not null,
  sender_id uuid references public.users(id) on delete cascade not null,
  receiver_id uuid references public.users(id) on delete cascade not null,
  exchange_count int default 0,
  is_revealed boolean default false,
  revealed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(compliment_id)
);

-- Messages in the conversation
create table if not exists public.secret_admirer_messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid references public.secret_admirer_chats(id) on delete cascade not null,
  sender_id uuid references public.users(id) on delete cascade not null,
  message text not null,
  is_read boolean default false,
  created_at timestamptz default now()
);

-- Indexes for efficient queries
create index if not exists idx_sa_chats_sender on public.secret_admirer_chats(sender_id);
create index if not exists idx_sa_chats_receiver on public.secret_admirer_chats(receiver_id);
create index if not exists idx_sa_chats_compliment on public.secret_admirer_chats(compliment_id);
create index if not exists idx_sa_messages_chat on public.secret_admirer_messages(chat_id);
create index if not exists idx_sa_messages_unread on public.secret_admirer_messages(chat_id, is_read) where not is_read;

-- Enable RLS
alter table public.secret_admirer_chats enable row level security;
alter table public.secret_admirer_messages enable row level security;

-- Chat policies - users can only see chats they're part of
create policy "Users can view their chats"
  on public.secret_admirer_chats for select
  using (auth.uid() in (sender_id, receiver_id));

-- Message policies - users can only see messages in their chats
create policy "Users can view messages in their chats"
  on public.secret_admirer_messages for select
  using (
    chat_id in (
      select id from public.secret_admirer_chats
      where sender_id = auth.uid() or receiver_id = auth.uid()
    )
  );

-- Messages can be inserted by chat participants
create policy "Chat participants can send messages"
  on public.secret_admirer_messages for insert
  with check (
    chat_id in (
      select id from public.secret_admirer_chats
      where sender_id = auth.uid() or receiver_id = auth.uid()
    )
  );

-- Function to initialize a chat when secret admirer compliment is sent
create or replace function public.init_secret_admirer_chat()
returns trigger as $$
begin
  if new.is_secret_admirer = true then
    insert into public.secret_admirer_chats (compliment_id, sender_id, receiver_id, exchange_count)
    values (new.id, new.sender_id, new.receiver_id, 1);

    -- Add the initial message
    insert into public.secret_admirer_messages (
      chat_id,
      sender_id,
      message
    )
    select id, new.sender_id, new.custom_message
    from public.secret_admirer_chats
    where compliment_id = new.id;
  end if;

  return new;
end;
$$ language plpgsql security definer;

-- Trigger to create chat on secret admirer compliment
drop trigger if exists on_secret_admirer_created on public.compliments;
create trigger on_secret_admirer_created
  after insert on public.compliments
  for each row
  when (new.is_secret_admirer = true)
  execute function public.init_secret_admirer_chat();

-- Function to send a reply in secret admirer chat
create or replace function public.send_secret_admirer_reply(
  p_chat_id uuid,
  p_message text
)
returns jsonb as $$
declare
  v_user_id uuid := auth.uid();
  v_chat record;
  v_exchange_count int;
  v_should_reveal boolean := false;
  v_other_user_id uuid;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  -- Validate message
  if p_message is null or length(trim(p_message)) < 1 then
    raise exception 'Message cannot be empty';
  end if;

  if length(p_message) > 280 then
    raise exception 'Message cannot exceed 280 characters';
  end if;

  -- Get chat and verify user is a participant
  select * into v_chat
  from public.secret_admirer_chats
  where id = p_chat_id
    and (sender_id = v_user_id or receiver_id = v_user_id);

  if v_chat is null then
    raise exception 'Chat not found or you are not a participant';
  end if;

  if v_chat.is_revealed then
    raise exception 'This chat has already been revealed';
  end if;

  -- Insert the message
  insert into public.secret_admirer_messages (chat_id, sender_id, message)
  values (p_chat_id, v_user_id, trim(p_message));

  -- Increment exchange count
  v_exchange_count := v_chat.exchange_count + 1;

  -- Reveal after 3 exchanges from each side (6 total messages)
  -- Or after 3 rounds (sender sends, receiver replies = 1 round)
  if v_exchange_count >= 6 then
    v_should_reveal := true;
  end if;

  -- Update chat
  update public.secret_admirer_chats
  set exchange_count = v_exchange_count,
      is_revealed = v_should_reveal,
      revealed_at = case when v_should_reveal then now() else null end,
      updated_at = now()
  where id = p_chat_id;

  -- If revealed, also reveal the original compliment
  if v_should_reveal then
    update public.compliments
    set is_revealed = true
    where id = v_chat.compliment_id;

    -- Determine the other user for notification
    v_other_user_id := case
      when v_user_id = v_chat.sender_id then v_chat.receiver_id
      else v_chat.sender_id
    end;

    -- Queue notification for identity reveal
    insert into public.pending_notifications (user_id, type, title, body, data)
    values (
      v_other_user_id,
      'secret_admirer_revealed',
      'Secret Admirer Revealed!',
      'Your secret admirer has been revealed! Check out who they are.',
      jsonb_build_object(
        'type', 'secret_admirer_revealed',
        'chatId', p_chat_id,
        'complimentId', v_chat.compliment_id
      )
    );
  else
    -- Notify other user of new message
    v_other_user_id := case
      when v_user_id = v_chat.sender_id then v_chat.receiver_id
      else v_chat.sender_id
    end;

    insert into public.pending_notifications (user_id, type, title, body, data)
    values (
      v_other_user_id,
      'secret_admirer_message',
      'New Secret Admirer Message',
      'Your secret admirer sent a new message!',
      jsonb_build_object(
        'type', 'secret_admirer_message',
        'chatId', p_chat_id
      )
    );
  end if;

  return jsonb_build_object(
    'success', true,
    'exchange_count', v_exchange_count,
    'is_revealed', v_should_reveal,
    'messages_until_reveal', greatest(0, 6 - v_exchange_count)
  );
end;
$$ language plpgsql security definer;

-- Function to get chat details and messages
create or replace function public.get_secret_admirer_chat(p_chat_id uuid)
returns jsonb as $$
declare
  v_user_id uuid := auth.uid();
  v_chat record;
  v_messages jsonb;
  v_sender_info jsonb;
  v_receiver_info jsonb;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  -- Get chat
  select * into v_chat
  from public.secret_admirer_chats
  where id = p_chat_id
    and (sender_id = v_user_id or receiver_id = v_user_id);

  if v_chat is null then
    raise exception 'Chat not found';
  end if;

  -- Get messages
  select jsonb_agg(
    jsonb_build_object(
      'id', m.id,
      'sender_id', m.sender_id,
      'message', m.message,
      'is_read', m.is_read,
      'created_at', m.created_at,
      'is_own', m.sender_id = v_user_id
    ) order by m.created_at
  )
  into v_messages
  from public.secret_admirer_messages m
  where m.chat_id = p_chat_id;

  -- Mark messages as read
  update public.secret_admirer_messages
  set is_read = true
  where chat_id = p_chat_id
    and sender_id != v_user_id
    and is_read = false;

  -- Get user info based on reveal status and user role
  if v_chat.is_revealed or v_user_id = v_chat.sender_id then
    select jsonb_build_object(
      'id', id,
      'username', username,
      'display_name', display_name,
      'avatar_url', avatar_url
    ) into v_sender_info
    from public.users where id = v_chat.sender_id;
  else
    v_sender_info := jsonb_build_object(
      'id', v_chat.sender_id,
      'username', 'secret_admirer',
      'display_name', 'Secret Admirer',
      'avatar_url', null
    );
  end if;

  if v_chat.is_revealed or v_user_id = v_chat.receiver_id then
    select jsonb_build_object(
      'id', id,
      'username', username,
      'display_name', display_name,
      'avatar_url', avatar_url
    ) into v_receiver_info
    from public.users where id = v_chat.receiver_id;
  else
    v_receiver_info := jsonb_build_object(
      'id', v_chat.receiver_id,
      'username', 'recipient',
      'display_name', 'You',
      'avatar_url', null
    );
  end if;

  return jsonb_build_object(
    'id', v_chat.id,
    'compliment_id', v_chat.compliment_id,
    'exchange_count', v_chat.exchange_count,
    'is_revealed', v_chat.is_revealed,
    'revealed_at', v_chat.revealed_at,
    'created_at', v_chat.created_at,
    'sender', v_sender_info,
    'receiver', v_receiver_info,
    'messages', coalesce(v_messages, '[]'::jsonb),
    'messages_until_reveal', greatest(0, 6 - v_chat.exchange_count),
    'is_sender', v_user_id = v_chat.sender_id
  );
end;
$$ language plpgsql security definer;

-- Function to get user's secret admirer chats
create or replace function public.get_my_secret_admirer_chats()
returns jsonb as $$
declare
  v_user_id uuid := auth.uid();
  v_chats jsonb;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select jsonb_agg(chat_data order by last_message_at desc)
  into v_chats
  from (
    select
      jsonb_build_object(
        'id', c.id,
        'compliment_id', c.compliment_id,
        'is_revealed', c.is_revealed,
        'exchange_count', c.exchange_count,
        'is_sender', c.sender_id = v_user_id,
        'other_user', case
          when c.is_revealed then
            jsonb_build_object(
              'id', u.id,
              'username', u.username,
              'display_name', u.display_name,
              'avatar_url', u.avatar_url
            )
          else
            jsonb_build_object(
              'id', u.id,
              'username', 'secret_admirer',
              'display_name', case when c.sender_id = v_user_id then u.display_name else 'Secret Admirer' end,
              'avatar_url', case when c.sender_id = v_user_id then u.avatar_url else null end
            )
        end,
        'last_message', (
          select message from public.secret_admirer_messages
          where chat_id = c.id
          order by created_at desc limit 1
        ),
        'unread_count', (
          select count(*) from public.secret_admirer_messages
          where chat_id = c.id and sender_id != v_user_id and not is_read
        ),
        'messages_until_reveal', greatest(0, 6 - c.exchange_count),
        'updated_at', c.updated_at
      ) as chat_data,
      c.updated_at as last_message_at
    from public.secret_admirer_chats c
    join public.users u on u.id = case
      when c.sender_id = v_user_id then c.receiver_id
      else c.sender_id
    end
    where c.sender_id = v_user_id or c.receiver_id = v_user_id
  ) sub;

  return coalesce(v_chats, '[]'::jsonb);
end;
$$ language plpgsql security definer;

-- Function to get chat by compliment ID
create or replace function public.get_secret_admirer_chat_by_compliment(p_compliment_id uuid)
returns jsonb as $$
declare
  v_chat_id uuid;
begin
  select id into v_chat_id
  from public.secret_admirer_chats
  where compliment_id = p_compliment_id;

  if v_chat_id is null then
    return null;
  end if;

  return public.get_secret_admirer_chat(v_chat_id);
end;
$$ language plpgsql security definer;

-- Grant permissions
grant execute on function public.send_secret_admirer_reply to authenticated;
grant execute on function public.get_secret_admirer_chat to authenticated;
grant execute on function public.get_my_secret_admirer_chats to authenticated;
grant execute on function public.get_secret_admirer_chat_by_compliment to authenticated;

-- =============================================
-- DONE! Secret Admirer Chat is ready.
--
-- How it works:
-- 1. When a secret admirer compliment is sent, a chat is created
-- 2. The initial message is the compliment's custom_message
-- 3. Receiver can reply with send_secret_admirer_reply
-- 4. After 6 total messages (3 from each side), identity is revealed
-- 5. Both users are notified when identity is revealed
-- =============================================
