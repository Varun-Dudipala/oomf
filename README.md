# Oomf - Anonymous Compliments Social App

A full-stack mobile social app where friends send anonymous compliments and try to guess who sent them. Built with React Native, Expo, and Supabase.

![React Native](https://img.shields.io/badge/React_Native-0.76-blue?logo=react)
![Expo](https://img.shields.io/badge/Expo_SDK-54-black?logo=expo)
![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-green?logo=supabase)
![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue?logo=typescript)

## Features

### Core Gameplay
- **Anonymous Compliments** - Send compliments to friends without revealing your identity
- **Guessing Game** - Recipients get 3 guesses to identify the sender
- **Hints System** - Spend tokens for hints (first letter, join date, level)
- **Full Reveal** - Use tokens to instantly reveal the sender

### Social Features
- **Friends System** - Add friends via username, QR code, or shareable link
- **Friend Circles** - Create groups for targeted compliment sending
- **Weekly Leaderboard** - Compete for top spots with category winners
- **User Profiles** - Levels, badges, streaks, and stats

### Engagement Systems
- **Daily Drops** - Limited compliments refresh daily (encourages daily use)
- **Streak System** - Maintain streaks by sending compliments daily
- **Streak Freezes** - Purchase with tokens to protect your streak
- **Badge Collection** - Unlock 20+ badges for achievements
- **Token Economy** - Earn tokens through activity, spend on features

### Premium Features
- **Secret Admirer** - Send custom anonymous messages (3 tokens)
- **Secret Admirer Chat** - Back-and-forth anonymous messaging with auto-reveal after 6 messages
- **In-App Purchases** - Buy token packs (ready for App Store)

### Notifications
- **Push Notifications** - New compliments, friend requests, streak warnings
- **Daily Drop Reminders** - Morning notification when new drops are available
- **Podium Notifications** - Alert when you make the weekly top 3

## Tech Stack

### Frontend
- **React Native** with Expo SDK 54
- **Expo Router** - File-based navigation
- **TypeScript** - Full type safety
- **Moti** - Fluid animations
- **Expo Haptics** - Tactile feedback

### Backend
- **Supabase** - PostgreSQL database
- **Row Level Security** - Secure data access policies
- **Real-time Subscriptions** - Live updates for compliments & friends
- **Edge Functions** - Server-side logic (RPC functions)

### Key Technical Implementations
- **Anonymous data handling** - Sender info hidden until revealed
- **Rate limiting** - Prevent spam and abuse
- **Optimistic UI updates** - Instant feedback
- **Offline-friendly** - Graceful degradation
- **Real-time sync** - Supabase subscriptions

## Architecture

```
oomf/
├── app/                    # Expo Router screens
│   ├── (auth)/            # Authentication flow
│   ├── (tabs)/            # Main tab navigation
│   │   ├── index.tsx      # Home - received compliments
│   │   ├── send.tsx       # Send compliments
│   │   ├── friends.tsx    # Friends management
│   │   └── profile.tsx    # User profile & settings
│   ├── compliment/[id]    # Compliment detail & guessing
│   ├── user/[username]    # User profiles
│   ├── leaderboard/       # Weekly rankings
│   ├── shop/              # Token purchases (IAP)
│   └── secret-admirer/    # Anonymous chat
├── components/
│   └── ui/                # Reusable UI components
├── hooks/                 # Custom React hooks
│   ├── useCompliments.ts  # Compliment CRUD & guessing
│   ├── useFriends.ts      # Friend management
│   ├── useTokens.ts       # Token economy
│   ├── useStreaks.ts      # Streak tracking
│   ├── useLeaderboard.ts  # Weekly rankings
│   └── ...
├── lib/
│   ├── supabase.ts        # Database client
│   ├── notifications.ts   # Push notification handling
│   └── constants.ts       # Theme & config
├── store/
│   └── authStore.ts       # Zustand auth state
└── supabase/
    └── migrations/        # 22 SQL migration files
```

## Database Schema

### Core Tables
- `users` - User profiles with stats, streaks, tokens
- `compliments` - Anonymous compliments with guessing state
- `templates` - Compliment templates by category
- `friendships` - Friend connections & requests
- `friend_circles` - Custom friend groups

### Gamification Tables
- `badges` - Achievement definitions
- `user_badges` - Earned badges
- `token_purchases` - IAP transaction records
- `secret_admirer_chats` - Anonymous conversations
- `user_podium_status` - Leaderboard tracking

## Screenshots

<!-- Add your screenshots here -->
| Home | Send | Friends | Profile |
|------|------|---------|---------|
| ![Home](screenshots/home.png) | ![Send](screenshots/send.png) | ![Friends](screenshots/friends.png) | ![Profile](screenshots/profile.png) |

| Guessing Game | Leaderboard | Secret Admirer |
|---------------|-------------|----------------|
| ![Guess](screenshots/guess.png) | ![Leaderboard](screenshots/leaderboard.png) | ![Secret](screenshots/secret.png) |

## Demo Video

*Coming soon - Demo video will be added here*

## Getting Started

### Prerequisites
- Node.js 18+
- Expo CLI
- Supabase account

### Installation

```bash
# Clone the repo
git clone https://github.com/YOUR_USERNAME/oomf.git
cd oomf

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Add your Supabase URL and anon key

# Run the SQL migrations in Supabase SQL Editor
# (migrations are in supabase/migrations/)

# Start the app
npx expo start
```

### Environment Variables

```env
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## What I Learned

- **React Native** mobile development with Expo
- **PostgreSQL** database design with Row Level Security
- **Real-time** data synchronization patterns
- **Gamification** systems (streaks, badges, leaderboards)
- **Anonymous systems** - hiding data while maintaining relationships
- **In-App Purchases** implementation
- **Push notifications** setup and handling

## Future Improvements

- [ ] Add photo compliments
- [ ] Group compliments (send to multiple friends)
- [ ] Compliment reactions with animations
- [ ] Dark/light theme toggle
- [ ] Analytics dashboard

## License

MIT License - feel free to use this as inspiration for your own projects!

---

**Built with React Native, Expo, and Supabase**
