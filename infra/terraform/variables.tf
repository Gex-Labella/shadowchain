# Shadow Chain Infrastructure Variables

# General Configuration
variable "aws_region" {
  description = "AWS region for deployment"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be dev, staging, or prod."
  }
}

variable "az_count" {
  description = "Number of availability zones to use"
  type        = number
  default     = 2
  validation {
    condition     = var.az_count >= 2 && var.az_count <= 3
    error_message = "AZ count must be between 2 and 3."
  }
}

# Networking Configuration
variable "vpc_cidr" {
  description = "CIDR block for VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "public_subnets" {
  description = "CIDR blocks for public subnets"
  type        = list(string)
  default     = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
}

variable "private_subnets" {
  description = "CIDR blocks for private subnets"
  type        = list(string)
  default     = ["10.0.11.0/24", "10.0.12.0/24", "10.0.13.0/24"]
}

variable "enable_nat_gateway" {
  description = "Enable NAT Gateway for private subnets"
  type        = bool
  default     = true
}

variable "single_nat_gateway" {
  description = "Use a single NAT Gateway for all private subnets (cost optimization)"
  type        = bool
  default     = false
}

# ECR Configuration
variable "ecr_image_tag_mutability" {
  description = "ECR image tag mutability setting"
  type        = string
  default     = "MUTABLE"
  validation {
    condition     = contains(["MUTABLE", "IMMUTABLE"], var.ecr_image_tag_mutability)
    error_message = "ECR image tag mutability must be MUTABLE or IMMUTABLE."
  }
}

variable "ecr_scan_on_push" {
  description = "Enable vulnerability scanning on image push"
  type        = bool
  default     = true
}

# S3 Configuration
variable "s3_enable_versioning" {
  description = "Enable versioning for S3 buckets"
  type        = bool
  default     = true
}

variable "s3_enable_encryption" {
  description = "Enable encryption for S3 buckets"
  type        = bool
  default     = true
}

variable "s3_enable_public_access" {
  description = "Enable public access for frontend bucket"
  type        = bool
  default     = false
}

# RDS Configuration
variable "enable_rds" {
  description = "Enable RDS PostgreSQL database"
  type        = bool
  default     = true
}

variable "rds_engine_version" {
  description = "PostgreSQL engine version"
  type        = string
  default     = "15.5"
}

variable "rds_instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.t3.micro"
}

variable "rds_allocated_storage" {
  description = "Allocated storage in GB"
  type        = number
  default     = 20
}

variable "rds_storage_encrypted" {
  description = "Enable storage encryption"
  type        = bool
  default     = true
}

variable "rds_database_name" {
  description = "Database name"
  type        = string
  default     = "shadowchain"
}

variable "rds_master_username" {
  description = "Master username for database"
  type        = string
  default     = "shadowadmin"
}

variable "rds_backup_retention_period" {
  description = "Backup retention period in days"
  type        = number
  default     = 7
}

variable "rds_backup_window" {
  description = "Preferred backup window"
  type        = string
  default     = "03:00-04:00"
}

variable "rds_maintenance_window" {
  description = "Preferred maintenance window"
  type        = string
  default     = "sun:04:00-sun:05:00"
}

variable "rds_skip_final_snapshot" {
  description = "Skip final snapshot on deletion"
  type        = bool
  default     = false
}

variable "rds_deletion_protection" {
  description = "Enable deletion protection"
  type        = bool
  default     = false
}

# Redis Configuration
variable "enable_redis" {
  description = "Enable Redis cache"
  type        = bool
  default     = true
}

variable "redis_node_type" {
  description = "Redis node type"
  type        = string
  default     = "cache.t3.micro"
}

variable "redis_num_cache_nodes" {
  description = "Number of cache nodes"
  type        = number
  default     = 1
}

variable "redis_engine_version" {
  description = "Redis engine version"
  type        = string
  default     = "7.0"
}

variable "redis_port" {
  description = "Redis port"
  type        = number
  default     = 6379
}

variable "redis_automatic_failover" {
  description = "Enable automatic failover"
  type        = bool
  default     = false
}

variable "redis_at_rest_encryption" {
  description = "Enable at-rest encryption"
  type        = bool
  default     = true
}

variable "redis_transit_encryption" {
  description = "Enable transit encryption"
  type        = bool
  default     = true
}

# ECS Service Configuration
variable "backend_image_tag" {
  description = "Backend Docker image tag"
  type        = string
  default     = "latest"
}

variable "frontend_image_tag" {
  description = "Frontend Docker image tag"
  type        = string
  default     = "latest"
}

variable "substrate_image_tag" {
  description = "Substrate Docker image tag"
  type        = string
  default     = "latest"
}

variable "ipfs_image_tag" {
  description = "IPFS Docker image tag"
  type        = string
  default     = "latest"
}

# Task CPU and Memory
variable "backend_cpu" {
  description = "Backend task CPU units"
  type        = number
  default     = 512
}

variable "backend_memory" {
  description = "Backend task memory in MB"
  type        = number
  default     = 1024
}

variable "frontend_cpu" {
  description = "Frontend task CPU units"
  type        = number
  default     = 256
}

variable "frontend_memory" {
  description = "Frontend task memory in MB"
  type        = number
  default     = 512
}

variable "substrate_cpu" {
  description = "Substrate task CPU units"
  type        = number
  default     = 1024
}

variable "substrate_memory" {
  description = "Substrate task memory in MB"
  type        = number
  default     = 2048
}

variable "ipfs_cpu" {
  description = "IPFS task CPU units"
  type        = number
  default     = 512
}

variable "ipfs_memory" {
  description = "IPFS task memory in MB"
  type        = number
  default     = 1024
}

# Service Desired Count
variable "backend_desired_count" {
  description = "Desired count for backend service"
  type        = number
  default     = 2
}

variable "frontend_desired_count" {
  description = "Desired count for frontend service"
  type        = number
  default     = 2
}

variable "substrate_desired_count" {
  description = "Desired count for substrate service"
  type        = number
  default     = 1
}

variable "ipfs_desired_count" {
  description = "Desired count for IPFS service"
  type        = number
  default     = 1
}

# Auto Scaling Configuration
variable "enable_autoscaling" {
  description = "Enable auto scaling for services"
  type        = bool
  default     = true
}

variable "backend_min_capacity" {
  description = "Minimum capacity for backend auto scaling"
  type        = number
  default     = 1
}

variable "backend_max_capacity" {
  description = "Maximum capacity for backend auto scaling"
  type        = number
  default     = 10
}

variable "frontend_min_capacity" {
  description = "Minimum capacity for frontend auto scaling"
  type        = number
  default     = 1
}

variable "frontend_max_capacity" {
  description = "Maximum capacity for frontend auto scaling"
  type        = number
  default     = 10
}

variable "target_cpu_utilization" {
  description = "Target CPU utilization for auto scaling"
  type        = number
  default     = 70
}

variable "target_memory_utilization" {
  description = "Target memory utilization for auto scaling"
  type        = number
  default     = 80
}

# Domain and Certificate Configuration
variable "frontend_domain_name" {
  description = "Domain name for frontend (e.g., shadowchain.example.com)"
  type        = string
}

variable "acm_certificate_arn" {
  description = "ACM certificate ARN for HTTPS"
  type        = string
  default     = ""
}

variable "create_route53_records" {
  description = "Create Route53 DNS records"
  type        = bool
  default     = false
}

# CloudFront Configuration
variable "enable_cloudfront" {
  description = "Enable CloudFront CDN"
  type        = bool
  default     = false
}

# WAF Configuration
variable "enable_waf" {
  description = "Enable AWS WAF"
  type        = bool
  default     = false
}

variable "waf_rate_limit" {
  description = "WAF rate limit per IP per 5 minutes"
  type        = number
  default     = 2000
}

variable "waf_ip_allowlist" {
  description = "IP addresses to allow"
  type        = list(string)
  default     = []
}

variable "waf_ip_blocklist" {
  description = "IP addresses to block"
  type        = list(string)
  default     = []
}

# Secrets Manager Configuration
variable "enable_secrets_manager" {
  description = "Enable AWS Secrets Manager"
  type        = bool
  default     = true
}

variable "github_token" {
  description = "GitHub personal access token"
  type        = string
  default     = ""
  sensitive   = true
}

variable "twitter_bearer_token" {
  description = "Twitter API bearer token"
  type        = string
  default     = ""
  sensitive   = true
}

variable "web3_storage_token" {
  description = "Web3.storage API token"
  type        = string
  default     = ""
  sensitive   = true
}

variable "backend_signer_private_key" {
  description = "Backend signer private key"
  type        = string
  default     = ""
  sensitive   = true
}

# IPFS Configuration
variable "use_web3_storage" {
  description = "Use Web3.storage instead of self-hosted IPFS"
  type        = bool
  default     = false
}

# Monitoring Configuration
variable "alarm_email_endpoint" {
  description = "Email address for CloudWatch alarms"
  type        = string
  default     = ""
}

variable "cpu_alarm_threshold" {
  description = "CPU utilization threshold for alarms"
  type        = number
  default     = 80
}

variable "memory_alarm_threshold" {
  description = "Memory utilization threshold for alarms"
  type        = number
  default     = 80
}

variable "error_rate_threshold" {
  description = "Error rate threshold for alarms"
  type        = number
  default     = 5
}

# Backup Configuration
variable "enable_backup" {
  description = "Enable AWS Backup"
  type        = bool
  default     = true
}

variable "backup_retention_days" {
  description = "Backup retention in days"
  type        = number
  default     = 30
}

variable "backup_schedule" {
  description = "Backup schedule in cron format"
  type        = string
  default     = "cron(0 3 * * ? *)"
}

# Tags
variable "additional_tags" {
  description = "Additional tags to apply to all resources"
  type        = map(string)
  default     = {}
}