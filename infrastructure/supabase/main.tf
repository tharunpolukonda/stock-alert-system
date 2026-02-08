terraform {
  required_providers {
    supabase = {
      source  = "supabase/supabase"
      version = "~> 1.0"
    }
  }
}

provider "supabase" {
  access_token = var.supabase_access_token
  # project_ref  = var.supabase_project_ref
}

# Users table - managed by Supabase Auth
# We'll add a profile table to extend user data

resource "supabase_table" "user_profiles" {
  name = "user_profiles"
  
  columns = [
    {
      name = "id"
      type = "uuid"
      primary_key = true
      references = {
        table = "auth.users"
        column = "id"
        on_delete = "CASCADE"
      }
    },
    {
      name = "email"
      type = "text"
      nullable = false
    },
    {
      name = "created_at"
      type = "timestamptz"
      default = "now()"
    },
    {
      name = "updated_at"
      type = "timestamptz"
      default = "now()"
    }
  ]
}

# Stocks table - stores stock information
resource "supabase_table" "stocks" {
  name = "stocks"
  
  columns = [
    {
      name = "id"
      type = "uuid"
      primary_key = true
      default = "gen_random_uuid()"
    },
    {
      name = "company_name"
      type = "text"
      nullable = false
      unique = true
    },
    {
      name = "symbol"
      type = "text"
      nullable = true
    },
    {
      name = "created_at"
      type = "timestamptz"
      default = "now()"
    }
  ]
}

# User alerts table - stores alert configurations
resource "supabase_table" "user_alerts" {
  name = "user_alerts"
  
  columns = [
    {
      name = "id"
      type = "uuid"
      primary_key = true
      default = "gen_random_uuid()"
    },
    {
      name = "user_id"
      type = "uuid"
      nullable = false
      references = {
        table = "auth.users"
        column = "id"
        on_delete = "CASCADE"
      }
    },
    {
      name = "stock_id"
      type = "uuid"
      nullable = false
      references = {
        table = "stocks"
        column = "id"
        on_delete = "CASCADE"
      }
    },
    {
      name = "baseline_price"
      type = "numeric"
      nullable = false
    },
    {
      name = "gain_threshold_percent"
      type = "numeric"
      default = "10.0"
    },
    {
      name = "loss_threshold_percent"
      type = "numeric"
      default = "5.0"
    },
    {
      name = "is_active"
      type = "boolean"
      default = "true"
    },
    {
      name = "created_at"
      type = "timestamptz"
      default = "now()"
    },
    {
      name = "updated_at"
      type = "timestamptz"
      default = "now()"
    }
  ]
}

# Price history table - stores historical price data
resource "supabase_table" "price_history" {
  name = "price_history"
  
  columns = [
    {
      name = "id"
      type = "uuid"
      primary_key = true
      default = "gen_random_uuid()"
    },
    {
      name = "stock_id"
      type = "uuid"
      nullable = false
      references = {
        table = "stocks"
        column = "id"
        on_delete = "CASCADE"
      }
    },
    {
      name = "price"
      type = "numeric"
      nullable = false
    },
    {
      name = "recorded_at"
      type = "timestamptz"
      default = "now()"
    }
  ]
}

# Alert logs table - records triggered alerts
resource "supabase_table" "alert_logs" {
  name = "alert_logs"
  
  columns = [
    {
      name = "id"
      type = "uuid"
      primary_key = true
      default = "gen_random_uuid()"
    },
    {
      name = "alert_id"
      type = "uuid"
      nullable = false
      references = {
        table = "user_alerts"
        column = "id"
        on_delete = "CASCADE"
      }
    },
    {
      name = "user_id"
      type = "uuid"
      nullable = false
      references = {
        table = "auth.users"
        column = "id"
        on_delete = "CASCADE"
      }
    },
    {
      name = "stock_id"
      type = "uuid"
      nullable = false
      references = {
        table = "stocks"
        column = "id"
        on_delete = "CASCADE"
      }
    },
    {
      name = "trigger_price"
      type = "numeric"
      nullable = false
    },
    {
      name = "baseline_price"
      type = "numeric"
      nullable = false
    },
    {
      name = "percent_change"
      type = "numeric"
      nullable = false
    },
    {
      name = "alert_type"
      type = "text"
      nullable = false
    },
    {
      name = "message"
      type = "text"
    },
    {
      name = "triggered_at"
      type = "timestamptz"
      default = "now()"
    }
  ]
}

# Row Level Security Policies
resource "supabase_policy" "user_alerts_select" {
  table = "user_alerts"
  name = "Users can view their own alerts"
  command = "SELECT"
  using = "auth.uid() = user_id"
}

resource "supabase_policy" "user_alerts_insert" {
  table = "user_alerts"
  name = "Users can create their own alerts"
  command = "INSERT"
  with_check = "auth.uid() = user_id"
}

resource "supabase_policy" "user_alerts_update" {
  table = "user_alerts"
  name = "Users can update their own alerts"
  command = "UPDATE"
  using = "auth.uid() = user_id"
  with_check = "auth.uid() = user_id"
}

resource "supabase_policy" "user_alerts_delete" {
  table = "user_alerts"
  name = "Users can delete their own alerts"
  command = "DELETE"
  using = "auth.uid() = user_id"
}

resource "supabase_policy" "alert_logs_select" {
  table = "alert_logs"
  name = "Users can view their own alert logs"
  command = "SELECT"
  using = "auth.uid() = user_id"
}

# Enable RLS on tables
resource "supabase_rls" "user_alerts" {
  table = "user_alerts"
  enabled = true
}

resource "supabase_rls" "alert_logs" {
  table = "alert_logs"
  enabled = true
}
