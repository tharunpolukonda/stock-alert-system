# Stock Alert System - Walkthrough

## What We Built

A comprehensive stock price monitoring system with:
1. **Frontend**: Next.js 14 App Router, Tailwind CSS, Supabase Auth.
2. **Backend**: Python FastAPI, Selenium (headless), Discord Webhooks.
3. **Database**: Supabase (PostgreSQL) with Row Level Security.
4. **Automation**: GitHub Actions Cron Job (hourly).

## How to Test

### 1. Database Setup
Follow [docs/SUPABASE_SETUP.md](file:///c:/Users/N.VenkataRaghuCharan/Desktop/Tharun/Projects/stocks_alert/docs/SUPABASE_SETUP.md) to create your Supabase project and apply the schema using Terraform.

### 2. Configure Secrets
Follow [docs/GITHUB_SECRETS.md](file:///c:/Users/N.VenkataRaghuCharan/Desktop/Tharun/Projects/stocks_alert/docs/GITHUB_SECRETS.md) to add `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, and `DISCORD_WEBHOOK_URL` to your GitHub repository.

### 3. Local Development

**Frontend:**
```bash
cd frontend
cp .env.example .env.local
# Update .env.local with your Supabase keys
npm run dev
```
Visit http://localhost:3000

**Backend:**
```bash
cd backend
python -m venv venv
source venv/bin/activate  # or venv\Scripts\activate on Windows
pip install -r requirements.txt
# Create .env file with Credentials
python main.py
```

### 4. Verify Cron Job
Push your code to GitHub. Go to Actions tab and manually run the "Stock Alert Cron Job" workflow to see it in action.

## Key Features

- **Real-time Search**: Uses Selenium to scrape live prices from screener.in.
- **Smart Alerts**: Get notified on Discord for 10% gains or 5% losses.
- **Market Hours Aware**: Only runs Mon-Fri, 9:30 AM - 3:30 PM IST.
- **Secure**: All sensitive data managed via RLS and GitHub Secrets.
