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
