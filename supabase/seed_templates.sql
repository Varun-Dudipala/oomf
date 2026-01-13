-- Additional seed compliment templates for Oomf
-- Run this in Supabase SQL Editor
-- Note: The migration already adds initial templates, this adds more variety

-- More Vibes templates
INSERT INTO templates (text, emoji, category, is_active) VALUES
('Your energy is absolutely contagious', '🌟', 'vibes', true),
('You make every room better just by being in it', '💫', 'vibes', true),
('You radiate good energy', '☀️', 'vibes', true),
('Being around you feels like a breath of fresh air', '🌊', 'vibes', true),
('You have the best aura', '🔮', 'vibes', true),
('Your presence is a gift', '🎁', 'vibes', true)
ON CONFLICT DO NOTHING;

-- More Funny templates
INSERT INTO templates (text, emoji, category, is_active) VALUES
('You''re literally the funniest person I know', '🤣', 'funny', true),
('Your jokes never miss', '🎯', 'funny', true),
('You should do stand-up fr', '🎤', 'funny', true),
('I''m crying laughing thinking about you rn', '😭', 'funny', true),
('You''re unhinged in the best way', '🤪', 'funny', true),
('Your memes are top tier', '📱', 'funny', true)
ON CONFLICT DO NOTHING;

-- More Looks templates
INSERT INTO templates (text, emoji, category, is_active) VALUES
('You''re genuinely so attractive', '😍', 'looks', true),
('Your fit today was fire', '🔥', 'looks', true),
('Your smile lights up the room', '😊', 'looks', true),
('You''re so pretty it''s unfair', '💕', 'looks', true),
('Lowkey crushing on you', '🥰', 'looks', true),
('You''re literally glowing', '✨', 'looks', true)
ON CONFLICT DO NOTHING;

-- More Smart templates
INSERT INTO templates (text, emoji, category, is_active) VALUES
('You''re actually so smart it''s intimidating', '🧠', 'smart', true),
('Your takes are always right', '💡', 'smart', true),
('I learn something new every time we talk', '📚', 'smart', true),
('You''re going places fr', '🚀', 'smart', true),
('Your advice is always spot on', '🎯', 'smart', true),
('You''re wise beyond your years', '🦉', 'smart', true)
ON CONFLICT DO NOTHING;

-- More Skills templates
INSERT INTO templates (text, emoji, category, is_active) VALUES
('You''re so talented it''s crazy', '🌟', 'skills', true),
('Never stop creating', '🎨', 'skills', true),
('Your work is actually insane', '🤯', 'skills', true),
('Born to do this fr', '👶', 'skills', true),
('Your skills are unmatched', '🏅', 'skills', true),
('Watching you work is inspiring', '👏', 'skills', true)
ON CONFLICT DO NOTHING;

-- More Trust templates
INSERT INTO templates (text, emoji, category, is_active) VALUES
('You''re the kindest person I know', '💛', 'trust', true),
('You always know what to say', '💬', 'trust', true),
('Thank you for always being there', '🤗', 'trust', true),
('You make me feel so seen', '👀', 'trust', true),
('You''re such a good listener', '👂', 'trust', true),
('The world needs more people like you', '🌍', 'trust', true),
('You have the biggest heart', '❤️', 'trust', true),
('You''re my safe person', '🏠', 'trust', true)
ON CONFLICT DO NOTHING;
