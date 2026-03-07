-- 1. DROP EVERYTHING
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();
drop table if exists public.alert_logs cascade;
drop table if exists public.price_history cascade;
drop table if exists public.user_alerts cascade;
drop table if exists public.stocks cascade;
drop table if exists public.sectors cascade;
drop table if exists public.user_profiles cascade;

-- 2. CREATE TABLES

-- User Profiles Table
create table public.user_profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  username text unique,
  email text,
  created_at timestamptz default now()
);

-- Sectors Table (NEW)
create table public.sectors (
  id uuid default gen_random_uuid() primary key,
  name text not null unique,
  created_at timestamptz default now()
);

-- Stocks Table (MODIFIED - added sector_id)
create table public.stocks (
  id uuid default gen_random_uuid() primary key,
  company_name text not null unique,
  symbol text,
  current_price numeric,
  market_cap text,
  sector_id uuid references public.sectors(id) on delete set null,
  created_at timestamptz default now()
);

-- User Alerts Table (MODIFIED - added is_portfolio and shares_count)
create table public.user_alerts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.user_profiles(id) on delete cascade not null,
  stock_id uuid references public.stocks(id) on delete cascade not null,
  baseline_price numeric not null,
  gain_threshold_percent numeric default 10.0,
  loss_threshold_percent numeric default 5.0,
  is_active boolean default true,
  is_portfolio boolean default false,
  shares_count integer default null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, stock_id)
);

-- Price History Table
create table public.price_history (
  id uuid default gen_random_uuid() primary key,
  stock_id uuid references public.stocks(id) on delete cascade not null,
  price numeric not null,
  recorded_at timestamptz default now()
);

-- Alert Logs Table
create table public.alert_logs (
  id uuid default gen_random_uuid() primary key,
  alert_id uuid references public.user_alerts(id) on delete set null,
  user_id uuid references public.user_profiles(id) on delete cascade not null,
  stock_id uuid references public.stocks(id) on delete cascade not null,
  trigger_price numeric not null,
  baseline_price numeric not null,
  percent_change numeric not null,
  alert_type text not null,
  message text,
  triggered_at timestamptz default now()
);

-- 3. CREATE INDEXES FOR PERFORMANCE
create index idx_stocks_sector_id on public.stocks(sector_id);
create index idx_user_alerts_portfolio on public.user_alerts(user_id, is_portfolio);

-- 4. ROBUST TRIGGER (Auto-create Profile)
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.user_profiles (id, email, username)
  values (
    new.id, 
    new.email, 
    COALESCE(new.raw_user_meta_data->>'username', 'user_' || substr(new.id::text, 1, 8))
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 5. SECURITY (RLS)
alter table public.user_profiles enable row level security;
alter table public.user_alerts enable row level security;
alter table public.stocks enable row level security;
alter table public.sectors enable row level security;
alter table public.alert_logs enable row level security;

-- ALLOW LOGIN (Find email by username)
create policy "Public profiles" on public.user_profiles for select using (true);

-- USER PROFILES POLICIES
create policy "Users view own profile" on public.user_profiles for update using (auth.uid() = id);

-- USER ALERTS POLICIES
create policy "Users view own alerts" on public.user_alerts for select using (auth.uid() = user_id);
create policy "Users create own alerts" on public.user_alerts for insert with check (auth.uid() = user_id);
create policy "Users update own alerts" on public.user_alerts for update using (auth.uid() = user_id);
create policy "Users delete own alerts" on public.user_alerts for delete using (auth.uid() = user_id);

-- STOCKS POLICIES
create policy "Public view stocks" on public.stocks for select to authenticated, anon using (true);
create policy "Authenticated insert stocks" on public.stocks for insert to authenticated with check (true);
create policy "Authenticated update stocks" on public.stocks for update to authenticated using (true);
create policy "Authenticated delete stocks" on public.stocks for delete to authenticated using (true);

-- SECTORS POLICIES (NEW)
create policy "Anyone can view sectors" on public.sectors for select using (auth.uid() is not null);
create policy "Anyone can create sectors" on public.sectors for insert with check (auth.uid() is not null);


-- 1. Add 'interest' column to the stocks table 06-03-2026
ALTER TABLE stocks 
ADD COLUMN interest TEXT NOT NULL DEFAULT 'not-interested' 
CHECK (interest IN ('interested', 'not-interested'));

-- 2. Set all existing portfolio stocks to 'interested'
UPDATE stocks 
SET interest = 'interested' 
WHERE id IN (
  SELECT DISTINCT stock_id FROM user_alerts WHERE is_portfolio = true
);

-- 3. Create Journal & Ledger History table
CREATE TABLE journal_ledger_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stock_id UUID NOT NULL REFERENCES stocks(id) ON DELETE CASCADE,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('buy', 'sell')),
  transaction_price NUMERIC(12,2) NOT NULL,
  num_shares INTEGER NOT NULL,
  previous_baseline_price NUMERIC(12,2) NOT NULL,
  updated_baseline_price NUMERIC(12,2) NOT NULL,
  previous_shares_count INTEGER NOT NULL,
  updated_shares_count INTEGER NOT NULL,
  profit_loss NUMERIC(12,2) DEFAULT 0,
  profit_loss_per_share NUMERIC(12,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Enable RLS on the new table
ALTER TABLE journal_ledger_history ENABLE ROW LEVEL SECURITY;

-- 5. RLS policies for journal_ledger_history
CREATE POLICY "Users can view own journal entries" ON journal_ledger_history
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own journal entries" ON journal_ledger_history
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- 6. Transaction Records Table (07-03-2026)
-- Purpose: Track investment history per company/user for fast
--          lookups without scanning journal_ledger_history
-- SELECT BELOW SQL AND RUN IN SUPABASE SQL EDITOR
-- ============================================================

CREATE TABLE public.transaction_records (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stock_id UUID NOT NULL REFERENCES public.stocks(id) ON DELETE CASCADE,
  is_invested_previous BOOLEAN NOT NULL DEFAULT false,
  no_trans_records INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, stock_id)
);

-- 7. Indexes for performance
CREATE INDEX idx_transaction_records_user_stock ON public.transaction_records(user_id, stock_id);
CREATE INDEX idx_transaction_records_invested ON public.transaction_records(user_id, is_invested_previous);

-- 8. Enable RLS
ALTER TABLE public.transaction_records ENABLE ROW LEVEL SECURITY;

-- 9. RLS Policies for transaction_records
CREATE POLICY "Users can view own transaction records"
  ON public.transaction_records FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own transaction records"
  ON public.transaction_records FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own transaction records"
  ON public.transaction_records FOR UPDATE
  USING (auth.uid() = user_id);

-- 10. Backfill from existing journal_ledger_history data
INSERT INTO public.transaction_records (user_id, stock_id, is_invested_previous, no_trans_records)
SELECT
  jlh.user_id,
  jlh.stock_id,
  true AS is_invested_previous,
  COUNT(*) AS no_trans_records
FROM public.journal_ledger_history jlh
GROUP BY jlh.user_id, jlh.stock_id
ON CONFLICT (user_id, stock_id) DO UPDATE
SET
  is_invested_previous = true,
  no_trans_records = EXCLUDED.no_trans_records,
  updated_at = NOW();
