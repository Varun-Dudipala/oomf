-- Create templates table
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
