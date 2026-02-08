# Supabase Setup Guide

This project uses Supabase as the backend database and authentication provider. Follow these steps to set up your project.

## 1. Create a Supabase Project

1. Go to [Supabase Database](https://supabase.com/dashboard) and sign in.
2. Click **"New Project"**.
3. Select your organization.
4. Enter a **Name** (e.g., `StockAlertSystem`).
5. Set a strong **Database Password** (save this, you might need it later).
6. Choose a **Region** close to you (e.g., `Mumbai (South Asia)`).
7. Click **"Create new project"**.

## 2. Get API Credentials

Once your project is ready (it takes a few minutes):

1. Go to **Project Settings** (cog icon) -> **API**.
2. Copy the **Project URL**.
3. Copy the **anon public** key (for frontend).
4. Copy the **service_role secret** key (for backend/GitHub Actions - **keep this secret!**).

## 3. Database Schema Setup

You can set up the database schema using the provided Terraform scripts or manually via the SQL Editor.

### Option A: Using Terraform (Recommended)

1. Install [Terraform](https://developer.hashicorp.com/terraform/downloads).
2. Navigate to the infrastructure directory:
   ```bash
   cd infrastructure/supabase
   ```
3. Create a `terraform.tfvars` file from the example:
   ```bash
   cp terraform.tfvars.example terraform.tfvars
   ```
4. Edit `terraform.tfvars` and add your **Access Token** (from [Account > Access Tokens](https://supabase.com/dashboard/account/tokens)), **Project Reference ID** (from Project Settings > General), and other credentials.
5. Initialize and apply:
   ```bash
   terraform init
   terraform apply
   ```
   Type `yes` to confirm.

### Option B: Manual SQL Setup

If you prefer, you can run the following SQL in the Supabase [SQL Editor](https://supabase.com/dashboard/project/_/sql):

```sql
-- Create custom types if needed
-- (None currently required)

-- 1. Create Stocks Table
create table public.stocks (
  id uuid default gen_random_uuid() primary key,
  company_name text not null unique,
  symbol text,
  created_at timestamptz default now()
);

-- 2. Create User Profiles Table (Linked to Auth)
create table public.user_profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  email text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 3. Create User Alerts Table
create table public.user_alerts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  stock_id uuid references public.stocks(id) on delete cascade not null,
  baseline_price numeric not null,
  gain_threshold_percent numeric default 10.0,
  loss_threshold_percent numeric default 5.0,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 4. Create Price History Table
create table public.price_history (
  id uuid default gen_random_uuid() primary key,
  stock_id uuid references public.stocks(id) on delete cascade not null,
  price numeric not null,
  recorded_at timestamptz default now()
);

-- 5. Create Alert Logs Table
create table public.alert_logs (
  id uuid default gen_random_uuid() primary key,
  alert_id uuid references public.user_alerts(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  stock_id uuid references public.stocks(id) on delete cascade not null,
  trigger_price numeric not null,
  baseline_price numeric not null,
  percent_change numeric not null,
  alert_type text not null,
  message text,
  triggered_at timestamptz default now()
);

-- Enable Row Level Security (RLS)
alter table public.user_alerts enable row level security;
alter table public.alert_logs enable row level security;

-- Create RLS Policies
create policy "Users can view their own alerts"
  on public.user_alerts for select
  using (auth.uid() = user_id);

create policy "Users can create their own alerts"
  on public.user_alerts for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own alerts"
  on public.user_alerts for update
  using (auth.uid() = user_id);
  
create policy "Users can delete their own alerts"
  on public.user_alerts for delete
  using (auth.uid() = user_id);

create policy "Users can view their own alert logs"
  on public.alert_logs for select
  using (auth.uid() = user_id);
  
-- Function to handle new user signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.user_profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$ language plpgsql security definer;

-- Trigger for new user signup
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
```

## 4. Authentication Configuration

1. Go to **Authentication** -> **Providers**.
2. **Email** should be enabled by default.
3. (Optional) Disable "Confirm email" in **Authentication** -> **URL Configuration** if you want to skip email verification during development.

## 5. Get Ready for Development

Update your `.env` file locally and GitHub Secrets for production with the URLs and Keys you gathered in Step 2.
