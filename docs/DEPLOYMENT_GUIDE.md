# Deployment Guide

## 1. GitHub Repository Setup
Before pushing to GitHub, ensure your secrets are NOT in the code. We correctly use `.env` files which are ignored by git.

### Files successfully ignored (Safe to push):
- `frontend/.env.local`
- `backend/.env`
- `infrastructure/terraform.tfstate`

### Step 1: Create Repository
1. Go to GitHub and create a new repository (e.g., `stock-alert-system`).
2. Run these commands in your project root:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/stock-alert-system.git
   git push -u origin main
   ```

## 2. GitHub Actions (Cron Job)
Go to your GitHub Repository -> **Settings** -> **Secrets and variables** -> **Actions** -> **New repository secret**.
Add these secrets (Copy values from your `backend/.env`):

| Secret Name | Value Description |
|---|---|
| `SUPABASE_URL` | Your Supabase Project URL |
| `SUPABASE_SERVICE_KEY` | Your Supabase Service Role Key |
| `DISCORD_WEBHOOK_URL` | Your Discord Webhook URL |

## 3. Vercel Deployment (Frontend)
1. Go to [Vercel](https://vercel.com) -> **Add New** -> **Project**.
2. Import your GitHub repository.
3. Select the `frontend` directory as the **Root Directory**.
4. In **Environment Variables**, add:

| Variable Name | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Copy from `frontend/.env.local` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Copy from `frontend/.env.local` |
| `NEXT_PUBLIC_API_URL` | **IMPORTANT:** This will be your Backend URL. <br>If deploying Backend to Vercel, it might be `https://your-backend.vercel.app`. <br>For now, you can leave it empty or set to localhost for testing, but it needs a live backend URL to work in production. |

## 4. Backend Deployment (Vercel Option)
**Note:** Selenium (Headless Chrome) is difficult to run on Vercel's free tier due to size limits. It is recommended to use **Render.com** or **Railway** for the Python backend if Vercel fails.

If trying Vercel:
1. Create a NEW Project in Vercel.
2. Select the `backend` directory as Root.
3. Add Environment Variables:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_KEY`
   - `DISCORD_WEBHOOK_URL`
   - `HEADLESS_MODE=true`

## 5. Connecting Frontend to Backend
Once your Backend is deployed (e.g., on Render or Vercel) and you have a URL (e.g., `https://stock-backend.onrender.com`), go back to your **Frontend Project in Vercel**:
1. Settings -> Environment Variables.
2. Edit `NEXT_PUBLIC_API_URL` and set it to your Backend URL (no trailing slash).
3. Redeploy the Frontend.
