-- =============================================
-- TOKEN PURCHASES (IAP)
-- Run this in Supabase SQL Editor
-- =============================================

-- Table to track all token purchases
create table if not exists public.token_purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade not null,

  -- Purchase details
  product_id text not null, -- e.g., 'tokens_5', 'tokens_20'
  tokens_amount int not null,
  price_usd decimal(10, 2) not null,

  -- Transaction info
  transaction_id text, -- App Store/Play Store transaction ID
  receipt text, -- Receipt data for verification
  platform text check (platform in ('ios', 'android')),

  -- Status
  status text default 'pending' check (status in ('pending', 'completed', 'failed', 'refunded')),

  created_at timestamptz default now(),
  completed_at timestamptz
);

-- Index for user purchases
create index if not exists idx_token_purchases_user on public.token_purchases(user_id);
create index if not exists idx_token_purchases_transaction on public.token_purchases(transaction_id);

-- Enable RLS
alter table public.token_purchases enable row level security;

-- Users can view their own purchases
create policy "Users can view their own purchases"
  on public.token_purchases for select
  using (auth.uid() = user_id);

-- Users can create purchases (but only server can complete them)
create policy "Users can create purchases"
  on public.token_purchases for insert
  with check (auth.uid() = user_id);

-- Function to complete a token purchase
create or replace function public.complete_token_purchase(
  p_purchase_id uuid,
  p_transaction_id text
)
returns jsonb as $$
declare
  v_purchase record;
  v_user_id uuid := auth.uid();
begin
  -- Get purchase
  select * into v_purchase
  from public.token_purchases
  where id = p_purchase_id;

  if not found then
    raise exception 'Purchase not found';
  end if;

  -- Verify ownership
  if v_purchase.user_id != v_user_id then
    raise exception 'Unauthorized';
  end if;

  -- Check status
  if v_purchase.status != 'pending' then
    raise exception 'Purchase already processed';
  end if;

  -- Update purchase status
  update public.token_purchases
  set status = 'completed',
      transaction_id = p_transaction_id,
      completed_at = now()
  where id = p_purchase_id;

  -- Add tokens to user
  update public.users
  set tokens = tokens + v_purchase.tokens_amount
  where id = v_user_id;

  return jsonb_build_object(
    'success', true,
    'tokens_added', v_purchase.tokens_amount
  );
end;
$$ language plpgsql security definer;

-- Grant execute permission
grant execute on function public.complete_token_purchase to authenticated;

-- =============================================
-- TOKEN PACKAGES
-- These are the available IAP products
-- Product IDs should match App Store Connect / Google Play Console
-- =============================================
-- com.oomf.tokens.starter  -> 5 tokens   -> $0.99
-- com.oomf.tokens.popular  -> 20 tokens  -> $2.99
-- com.oomf.tokens.best     -> 40 tokens  -> $4.99
-- com.oomf.tokens.mega     -> 100 tokens -> $9.99
-- =============================================
