-- =============================================
-- FRIEND REQUEST NOTIFICATIONS
-- Run this in Supabase SQL Editor
-- =============================================

-- First, ensure users table has expo_push_token column
alter table public.users
  add column if not exists expo_push_token text;

-- Create a function to send push notification via Edge Function or webhook
-- This creates a notification record that can be processed by an Edge Function
create table if not exists public.pending_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade not null,
  type text not null,
  title text not null,
  body text not null,
  data jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  sent_at timestamptz,
  error text
);

-- Index for processing pending notifications
create index if not exists idx_pending_notifications_unsent
  on public.pending_notifications(created_at)
  where sent_at is null;

-- Enable RLS on pending_notifications
alter table public.pending_notifications enable row level security;

-- Only allow users to read their own notifications
create policy "Users can view their own pending notifications"
  on public.pending_notifications for select
  using (auth.uid() = user_id);

-- Function to queue a friend request notification
create or replace function public.queue_friend_request_notification()
returns trigger as $$
declare
  v_sender record;
  v_receiver record;
begin
  -- Only notify on new pending requests
  if new.status = 'pending' then
    -- Get sender info
    select display_name, username into v_sender
    from public.users
    where id = new.requester_id;

    -- Get receiver info
    select id, expo_push_token into v_receiver
    from public.users
    where id = new.addressee_id;

    -- Queue notification for receiver
    if v_receiver.expo_push_token is not null then
      insert into public.pending_notifications (user_id, type, title, body, data)
      values (
        v_receiver.id,
        'friend_request',
        'New Friend Request',
        v_sender.display_name || ' (@' || v_sender.username || ') wants to be your friend!',
        jsonb_build_object(
          'type', 'friend_request',
          'friendRequestId', new.id,
          'fromUserId', new.requester_id
        )
      );
    end if;
  end if;

  return new;
end;
$$ language plpgsql security definer;

-- Function to queue friend accepted notification
create or replace function public.queue_friend_accepted_notification()
returns trigger as $$
declare
  v_accepter record;
  v_requester record;
begin
  -- Only notify when status changes from pending to accepted
  if old.status = 'pending' and new.status = 'accepted' then
    -- Get accepter info
    select display_name, username into v_accepter
    from public.users
    where id = new.addressee_id;

    -- Get requester info (the one who gets notified)
    select id, expo_push_token into v_requester
    from public.users
    where id = new.requester_id;

    -- Queue notification for original requester
    if v_requester.expo_push_token is not null then
      insert into public.pending_notifications (user_id, type, title, body, data)
      values (
        v_requester.id,
        'friend_accepted',
        'Friend Request Accepted!',
        v_accepter.display_name || ' (@' || v_accepter.username || ') accepted your friend request!',
        jsonb_build_object(
          'type', 'friend_accepted',
          'friendRequestId', new.id,
          'fromUserId', new.addressee_id
        )
      );
    end if;
  end if;

  return new;
end;
$$ language plpgsql security definer;

-- Create triggers for friend notifications
drop trigger if exists on_friend_request_created on public.friendships;
create trigger on_friend_request_created
  after insert on public.friendships
  for each row
  execute function public.queue_friend_request_notification();

drop trigger if exists on_friend_request_accepted on public.friendships;
create trigger on_friend_request_accepted
  after update on public.friendships
  for each row
  execute function public.queue_friend_accepted_notification();

-- Function to queue compliment notification
create or replace function public.queue_compliment_notification()
returns trigger as $$
declare
  v_sender record;
  v_receiver record;
  v_template record;
begin
  -- Get sender info
  select display_name, username into v_sender
  from public.users
  where id = new.sender_id;

  -- Get receiver info
  select id, expo_push_token into v_receiver
  from public.users
  where id = new.receiver_id;

  -- Get template info
  select emoji, text into v_template
  from public.templates
  where id = new.template_id;

  -- Queue notification for receiver
  if v_receiver.expo_push_token is not null then
    insert into public.pending_notifications (user_id, type, title, body, data)
    values (
      v_receiver.id,
      'new_compliment',
      'New Oomf! ' || coalesce(v_template.emoji, '💌'),
      'Someone thinks you''re amazing! Tap to see what they said.',
      jsonb_build_object(
        'type', 'new_compliment',
        'complimentId', new.id
      )
    );
  end if;

  return new;
end;
$$ language plpgsql security definer;

-- Create trigger for compliment notifications
drop trigger if exists on_compliment_created on public.compliments;
create trigger on_compliment_created
  after insert on public.compliments
  for each row
  execute function public.queue_compliment_notification();

-- =============================================
-- DONE! Friend and compliment notifications are ready.
-- Notifications are queued in pending_notifications table.
-- An Edge Function or cron job should process this queue
-- and send actual push notifications via Expo.
-- =============================================
