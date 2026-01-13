-- =============================================
-- DAILY DROPS - Special limited-time templates
-- Run this in Supabase SQL Editor
-- =============================================

-- Add daily drop fields to templates table
alter table public.templates
  add column if not exists is_daily_drop boolean default false,
  add column if not exists drop_date date,
  add column if not exists drop_expires_at timestamptz;

-- Index for daily drops
create index if not exists idx_templates_daily_drop on public.templates(is_daily_drop, drop_date);

-- Function to get today's daily drop templates
create or replace function public.get_daily_drops()
returns setof public.templates as $$
begin
  return query
  select *
  from public.templates
  where is_daily_drop = true
    and is_active = true
    and (
      -- Template is for today
      drop_date = current_date
      -- Or no date set (always available drop)
      or drop_date is null
    )
    and (
      -- Not expired
      drop_expires_at is null
      or drop_expires_at > now()
    )
  order by created_at desc;
end;
$$ language plpgsql security definer;

-- Insert some daily drop templates
-- These rotate based on day of week
insert into public.templates (text, emoji, category, is_daily_drop, is_active) values
-- Monday motivation drops
('You''re crushing it this week', '💪', 'vibes', true, true),
('Ready to conquer the week', '🚀', 'vibes', true, true),

-- Fun drops
('You have elite meme game', '😂', 'funny', true, true),
('Your playlist is fire', '🎵', 'vibes', true, true),
('Would 100% go to brunch with you', '🥂', 'trust', true, true),

-- Hype drops
('Certified legend', '👑', 'vibes', true, true),
('Main character of my life', '⭐', 'vibes', true, true),
('You''re that friend everyone needs', '💯', 'trust', true, true),

-- Seasonal/special drops (can be date-specific)
('Holiday season looks good on you', '🎄', 'looks', true, true),
('Summer vibes all year', '☀️', 'vibes', true, true)
on conflict do nothing;

-- =============================================
-- DONE! Daily drops are ready.
-- =============================================
