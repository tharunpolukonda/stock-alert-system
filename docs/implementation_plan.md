# Stock Alert System - Implementation Plan

A comprehensive stock price monitoring and alert system for the Indian stock market with automated price tracking, Discord notifications, and a modern web interface.

## User Review Required

> [!IMPORTANT]
> **Technology Stack Confirmed**:
> - **Backend**: Python with Selenium (using your existing screener.in scraper)
> - **Frontend**: Next.js with modern UI
> - **Database**: Supabase (PostgreSQL)
> - **Secrets Management**: GitHub Secrets for all sensitive credentials
> - **Data Source**: screener.in via Selenium automation

> [!NOTE]
> **New Features Added**:
> 1. **Search API**: Real-time stock price lookup endpoint - enter any company name and get current price
> 2. **GitHub Secrets**: All credentials (Supabase URL, keys, Discord webhook) stored securely
> 3. **Python Backend**: FastAPI server to handle scraping, alerts, and search requests

## Proposed Changes

### Project Structure

```
stocks_alert/
├── frontend/              # Next.js web application
│   ├── app/
│   │   ├── page.tsx      # Landing page with login
│   │   ├── dashboard/    # Main dashboard
│   │   └── api/          # API routes (proxy to Python backend)
│   ├── components/
│   ├── lib/
│   └── public/
├── backend/               # Python backend services
│   ├── scraper.py        # Selenium scraper (your existing code)
│   ├── search_api.py     # Search endpoint for stock lookup
│   ├── alert_engine.py   # Alert comparison logic
│   ├── discord_notifier.py # Discord webhook integration
│   ├── cron_job.py       # Main cron job orchestrator
│   ├── main.py           # FastAPI server
│   └── requirements.txt  # Python dependencies
├── infrastructure/        # Terraform scripts
│   └── supabase/
│       ├── main.tf
│       ├── variables.tf
│       └── outputs.tf
├── .github/
│   └── workflows/
│       └── stock-alert-cron.yml  # Hourly cron job
├── docs/                 # Setup guides
│   ├── SUPABASE_SETUP.md
│   ├── GITHUB_SECRETS.md
│   └── DEPLOYMENT_GUIDE.md
└── .env.example          # Environment template
```

---

### Infrastructure Layer

#### [NEW] [main.tf](file:///c:/Users/N.VenkataRaghuCharan/Desktop/Tharun/Projects/stocks_alert/infrastructure/supabase/main.tf)

Terraform script to create Supabase database schema with:
- **users** table: User authentication and profiles
- **stocks** table: Stock symbols and metadata
- **user_alerts** table: User-configured alert rules (target prices, % thresholds)
- **price_history** table: Historical price data for tracking
- **alert_logs** table: Record of triggered alerts

Includes Row Level Security (RLS) policies for multi-user support.

#### [NEW] [variables.tf](file:///c:/Users/N.VenkataRaghuCharan/Desktop/Tharun/Projects/stocks_alert/infrastructure/supabase/variables.tf)

Terraform variables for Supabase URL and service role key.

#### [NEW] [outputs.tf](file:///c:/Users/N.VenkataRaghuCharan/Desktop/Tharun/Projects/stocks_alert/infrastructure/supabase/outputs.tf)

Output values for database connection details.

---

### Backend Services (Python)

#### [NEW] [scraper.py](file:///c:/Users/N.VenkataRaghuCharan/Desktop/Tharun/Projects/stocks_alert/backend/scraper.py)

Enhanced version of your existing Selenium scraper:
- Uses your proven screener.in scraping logic
- Accepts company name as parameter
- Returns current market cap/price
- Handles errors and timeouts gracefully
- Headless mode for GitHub Actions
- Stores price data in Supabase

#### [NEW] [search_api.py](file:///c:/Users/N.VenkataRaghuCharan/Desktop/Tharun/Projects/stocks_alert/backend/search_api.py)

FastAPI endpoint for real-time stock search:
- **POST /api/search** - accepts company name, returns current price
- Uses scraper.py to fetch live data
- Returns formatted JSON response
- Caches recent searches to reduce scraping load

#### [NEW] [alert_engine.py](file:///c:/Users/N.VenkataRaghuCharan/Desktop/Tharun/Projects/stocks_alert/backend/alert_engine.py)

Alert comparison and notification logic:
- Fetches user alert configurations from Supabase
- Compares current price with baseline prices
- Calculates percentage changes (10% gain, 5% loss)
- Triggers Discord notifications when conditions are met
- Logs alert events to database

#### [NEW] [discord_notifier.py](file:///c:/Users/N.VenkataRaghuCharan/Desktop/Tharun/Projects/stocks_alert/backend/discord_notifier.py)

Discord webhook integration:
- Formats rich embed messages with stock details
- Sends notifications using Discord webhook URL from GitHub secrets
- Handles webhook errors gracefully

#### [NEW] [cron_job.py](file:///c:/Users/N.VenkataRaghuCharan/Desktop/Tharun/Projects/stocks_alert/backend/cron_job.py)

Main cron job entry point for GitHub Actions:
- Validates market hours (Mon-Fri, 9:30 AM - 3:30 PM IST)
- Orchestrates scraping and alert checking
- Reads credentials from environment variables (GitHub secrets)
- Provides logging and error handling

#### [NEW] [main.py](file:///c:/Users/N.VenkataRaghuCharan/Desktop/Tharun/Projects/stocks_alert/backend/main.py)

FastAPI server:
- Hosts search API endpoint
- CORS configuration for frontend
- Health check endpoint
- Supabase client initialization

#### [NEW] [requirements.txt](file:///c:/Users/N.VenkataRaghuCharan/Desktop/Tharun/Projects/stocks_alert/backend/requirements.txt)

Python dependencies:
- selenium
- fastapi
- uvicorn
- supabase-py
- requests (for Discord webhooks)
- python-dotenv

---

### Frontend Application

#### [NEW] [package.json](file:///c:/Users/N.VenkataRaghuCharan/Desktop/Tharun/Projects/stocks_alert/frontend/package.json)

Next.js project with dependencies:
- Next.js 14+ with App Router
- Supabase client for authentication and data
- Tailwind CSS for styling
- Recharts for price visualization

#### [NEW] [layout.tsx](file:///c:/Users/N.VenkataRaghuCharan/Desktop/Tharun/Projects/stocks_alert/frontend/app/layout.tsx)

Root layout with authentication provider and modern design system.

#### [NEW] [page.tsx](file:///c:/Users/N.VenkataRaghuCharan/Desktop/Tharun/Projects/stocks_alert/frontend/app/page.tsx)

Landing page with login/signup interface featuring:
- Modern glassmorphic design
- Smooth animations
- Authentication flow

#### [NEW] [dashboard/page.tsx](file:///c:/Users/N.VenkataRaghuCharan/Desktop/Tharun/Projects/stocks_alert/frontend/app/dashboard/page.tsx)

Main dashboard for authenticated users:
- Stock watchlist with real-time prices
- Alert configuration interface
- Price history charts
- Alert history log

#### [NEW] [components/StockCard.tsx](file:///c:/Users/N.VenkataRaghuCharan/Desktop/Tharun/Projects/stocks_alert/frontend/components/StockCard.tsx)

Reusable stock display component with price trends and alert status.

#### [NEW] [components/AlertForm.tsx](file:///c:/Users/N.VenkataRaghuCharan/Desktop/Tharun/Projects/stocks_alert/frontend/components/AlertForm.tsx)

Form to create/edit alert rules with percentage or absolute price targets.

#### [NEW] [components/SearchBar.tsx](file:///c:/Users/N.VenkataRaghuCharan/Desktop/Tharun/Projects/stocks_alert/frontend/components/SearchBar.tsx)

Real-time stock search component:
- Input field for company name
- Calls Python backend search API on Enter
- Displays current price with loading state
- Modern, animated UI with smooth transitions

---

### GitHub Actions Automation

#### [NEW] [stock-alert-cron.yml](file:///c:/Users/N.VenkataRaghuCharan/Desktop/Tharun/Projects/stocks_alert/.github/workflows/stock-alert-cron.yml)

GitHub Actions workflow:
- Runs every hour using cron schedule (`0 * * * *`)
- Checks if current time is within market hours (Mon-Fri, 9:30 AM - 3:30 PM IST)
- Sets up Python environment and installs dependencies
- Installs Chrome and ChromeDriver for Selenium
- Executes `cron_job.py` for scraping and alert checking
- Uses repository secrets (no credentials in code):
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_KEY`
  - `DISCORD_WEBHOOK_URL`

**GitHub Secrets Configuration** (documented in `GITHUB_SECRETS.md`):
1. Navigate to repository Settings → Secrets and variables → Actions
2. Add the three secrets above
3. Secrets are injected as environment variables during workflow execution

---

### Configuration & Documentation

#### [NEW] [.env.example](file:///c:/Users/N.VenkataRaghuCharan/Desktop/Tharun/Projects/stocks_alert/.env.example)

Environment variable template for local development:
- Supabase URL and keys
- Discord webhook URL
- Timezone configuration (Asia/Kolkata)

> [!WARNING]
> **Never commit actual credentials!** This file is a template only. Real credentials go in GitHub Secrets for production.

#### [NEW] [GITHUB_SECRETS.md](file:///c:/Users/N.VenkataRaghuCharan/Desktop/Tharun/Projects/stocks_alert/docs/GITHUB_SECRETS.md)

Complete guide for configuring GitHub repository secrets:
1. How to create repository secrets
2. Required secret names and where to get values
3. How secrets are accessed in GitHub Actions
4. Security best practices

#### [NEW] [SUPABASE_SETUP.md](file:///c:/Users/N.VenkataRaghuCharan/Desktop/Tharun/Projects/stocks_alert/docs/SUPABASE_SETUP.md)

Comprehensive guide for:
1. Creating a Supabase project (step-by-step with screenshots)
2. Getting API keys and URL
3. Running Terraform scripts to create schema
4. Configuring authentication
5. Setting up Row Level Security policies

#### [NEW] [DEPLOYMENT_GUIDE.md](file:///c:/Users/N.VenkataRaghuCharan/Desktop/Tharun/Projects/stocks_alert/docs/DEPLOYMENT_GUIDE.md)

Step-by-step deployment instructions:
1. Frontend deployment (Vercel)
2. Backend API deployment options
3. GitHub Actions secrets configuration
4. Discord webhook setup
5. Testing the complete flow

## Verification Plan

### Automated Tests

```bash
# Test database schema creation
cd infrastructure/supabase
terraform plan

# Test backend scraper locally
cd backend
npm test

# Test frontend build
cd frontend
npm run build
```

### Manual Verification

1. **Database Setup**: Verify Terraform creates all tables and RLS policies correctly
2. **Scraper Test**: Run scraper manually to confirm it fetches stock prices
3. **Alert Logic**: Test alert conditions with mock data
4. **Discord Integration**: Send test notification to Discord
5. **UI Testing**: Verify login, dashboard, and alert configuration work
6. **GitHub Actions**: Trigger workflow manually to test cron job
7. **End-to-End**: Monitor a real stock during market hours and verify alerts
