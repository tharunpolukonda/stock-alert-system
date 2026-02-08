variable "supabase_access_token" {
  description = "Supabase access token for Terraform provider"
  type        = string
  sensitive   = true
}

variable "supabase_project_ref" {
  description = "Supabase project reference ID"
  type        = string
}

variable "supabase_url" {
  description = "Supabase project URL"
  type        = string
}

variable "supabase_anon_key" {
  description = "Supabase anonymous key"
  type        = string
  sensitive   = true
}

variable "supabase_service_key" {
  description = "Supabase service role key"
  type        = string
  sensitive   = true
}
