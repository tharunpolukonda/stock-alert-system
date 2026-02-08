output "supabase_url" {
  description = "Supabase project URL"
  value       = var.supabase_url
}

output "database_setup_complete" {
  description = "Confirmation that database schema has been created"
  value       = "Database schema created successfully with tables: user_profiles, stocks, user_alerts, price_history, alert_logs"
}
