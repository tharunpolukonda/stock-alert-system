# GitHub Secrets Configuration

To ensure your Stock Alert System runs securely and automatically via GitHub Actions, you need to configure "Secrets" in your GitHub repository. These secrets keep your sensitive keys (like database passwords and API tokens) out of your public code.

## Required Secrets

You need to add the following 3 secrets:

| Secret Name | Description | Where to find it |
|-------------|-------------|------------------|
| `SUPABASE_URL` | Your Supabase Project URL | Supabase Dashboard > Settings > API > Project URL |
| `SUPABASE_SERVICE_KEY` | Service Role Secret (Backend access) | Supabase Dashboard > Settings > API > Project API keys > service_role |
| `DISCORD_WEBHOOK_URL` | URL for the Discord channel to receive alerts | Discord Channel Settings > Integrations > Webhooks |

> [!CAUTION]
> **Use the `service_role` key, NOT the `anon` key** for `SUPABASE_SERVICE_KEY`. The backend needs full access to the database to process alerts for all users.

## How to Add Secrets

1. Go to your GitHub Repository.
2. Click on the **Settings** tab (usually the rightmost tab).
3. In the left sidebar, scroll down to **Secrets and variables**.
4. Click on **Actions**.
5. Click the green **New repository secret** button.
6. For **Name**, enter one of the names from the table above (e.g., `SUPABASE_URL`).
7. For **Secret**, paste the corresponding value (e.g., `https://xyz.supabase.co`).
8. Click **Add secret**.
9. Repeat for all 3 required secrets.

## Verifying the Setup

Once all secrets are added, you can manually trigger the workflow to test:

1. Go to the **Actions** tab in your repository.
2. Select **Stock Alert Cron Job** from the left sidebar.
3. Click the **Run workflow** dropdown button.
4. Click **Run workflow**.

If configured correctly, the workflow should run, set up the environment, and execute the scraper without errors.
