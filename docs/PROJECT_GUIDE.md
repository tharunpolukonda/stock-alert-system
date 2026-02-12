# 📊 Stock Alert System - Final Documentation

## 🌟 Project Overview
A full-stack Stock Alert System that tracks Indian Stock Market (NSE) prices and sends real-time notifications to Discord when specific gain or loss thresholds are met.

---

## 🛠️ Key Features

### 1. Robust Authentication
- **Custom Username Login**: Users login with a username and password.
- **Behind the Scenes**: Uses Supabase Auth with synthetic emails (`username@stockalert.local`) to bypass email confirmation requirements, ensuring a seamless signup experience.

### 2. Interactive Dashboard
- **Stock Watchlist**: View all your tracked stocks in one place.
- **Live Price Tracking**: Click the "Track Price" button on any card to fetch the most recent market price instantly.
- **Dynamic Indicators**: Thresholds (Gain/Loss %) and price changes are color-coded (Green for Gain, Red for Loss).
- **Manual Refresh**: A "Refresh" button to update your entire watchlist at once.

### 3. Smart Alert Configuration
- **Unified Form**: Search for a company and configure thresholds (e.g., +10% Gain, -5% Loss) in a single, intuitive window.
- **Auto-fetching**: The system automatically pulls the current price to set your "Baseline" when you select a company.

### 4. Automated Alerts (The "Bot")
- **Hourly Checks**: A GitHub Actions script runs every hour to check market prices.
- **Discord Integration**: Get rich, formatted embed messages in your Discord channel when an alert triggers.
- **Cascading Delete**: Removing an alert also cleans up the stock entry if it's no longer tracked, keeping the database tidy.

---

## 🏗️ Technical Architecture

### **Frontend**
- **Framework**: Next.js 15+ (App Router)
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **Database Client**: Supabase SSR

### **Backend**
- **Framework**: Python (FastAPI)
- **Scraper**: Selenium (Headless Chrome) using optimized selectors for NSE data.
- **Notifier**: Custom Discord Webhook integration.

### **Database (Supabase)**
- **RLS (Row Level Security)**: Ensures users can only see and manage their own alerts.
- **Relationships**: Automated triggers link Supabase Auth users to `user_profiles`.

---

## ⚙️ Configuration & Environment Variables

### **Frontend (`.env.local`)**
```env
NEXT_PUBLIC_SUPABASE_URL=your_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_key
NEXT_PUBLIC_API_URL=http://localhost:8000 # Update to production URL after deployment
```

### **Backend (`.env`)**
```env
SUPABASE_URL=your_url
SUPABASE_SERVICE_KEY=your_service_role_key
DISCORD_WEBHOOK_URL=your_discord_webhook_link
HEADLESS_MODE=true
```

---

## 🚀 Deployment Summary
- **Frontend**: Best hosted on **Vercel**.
- **Backend API**: Can be hosted on **Render.com** or **Railway.app** (to support Selenium).
- **Automation**: Runs for free via **GitHub Actions** using the provided `.github/workflows/stock-alert-cron.yml`.

---

## 🔧 Maintenance
- **Pausing Alerts**: You can Disable/Enable the "Stock Alert Cron Job" in your GitHub Actions tab.
- **Adding Stocks**: Simply search and save. The bot handles the rest!

*Documentation generated on February 9, 2026.*
