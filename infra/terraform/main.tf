# Shadow Chain AWS Infrastructure
# Main Terraform configuration

terraform {
  required_version = ">= 1.3.0"
  
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.5"
    }
  }
  
  # Backend configuration for state storage
  backend "s3" {
    # Configure these values in terraform/backend.tf or via CLI
    # bucket         = "shadow-chain-terraform-state"
    # key            = "infrastructure/terraform.tfstate"
    # region         = "us-east-1"
    # dynamodb_table = "shadow-chain-terraform-locks"
    # encrypt        = true
  }
}

# Provider configuration
provider "aws" {
  region = var.aws_region
  
  default_tags {
    tags = {
      Project     = "ShadowChain"
      Environment = var.environment
      ManagedBy   = "Terraform"
      CreatedAt   = timestamp()
    }
  }
}

# Random suffix for unique resource names
resource "random_string" "suffix" {
  length  = 8
  special = false
  upper   = false
}

# Local variables
locals {
  name_prefix = "shadow-chain-${var.environment}"
  common_tags = {
    Project     = "ShadowChain"
    Environment = var.environment
  }
  
  # Availability zones
  azs = slice(data.aws_availability_zones.available.names, 0, var.az_count)
  
  # Container definitions
  backend_container_name   = "shadow-chain-backend"
  frontend_container_name  = "shadow-chain-frontend"
  substrate_container_name = "shadow-chain-substrate"
  ipfs_container_name     = "shadow-chain-ipfs"
}

# Data sources
data "aws_availability_zones" "available" {
  state = "available"
}

data "aws_caller_identity" "current" {}

# Modules
module "networking" {
  source = "./modules/networking"
  
  name_prefix     = local.name_prefix
  vpc_cidr        = var.vpc_cidr
  azs             = local.azs
  private_subnets = var.private_subnets
  public_subnets  = var.public_subnets
  
  enable_nat_gateway   = var.enable_nat_gateway
  single_nat_gateway   = var.single_nat_gateway
  enable_dns_hostnames = true
  enable_dns_support   = true
  
  tags = local.common_tags
}

module "security" {
  source = "./modules/security"
  
  name_prefix = local.name_prefix
  vpc_id      = module.networking.vpc_id
  vpc_cidr    = var.vpc_cidr
  
  tags = local.common_tags
}

module "iam" {
  source = "./modules/iam"
  
  name_prefix    = local.name_prefix
  aws_account_id = data.aws_caller_identity.current.account_id
  aws_region     = var.aws_region
  
  ecr_repositories = [
    module.ecr.backend_repository_arn,
    module.ecr.frontend_repository_arn,
    module.ecr.substrate_repository_arn,
    module.ecr.ipfs_repository_arn
  ]
  
  s3_buckets = [
    module.storage.frontend_bucket_arn,
    module.storage.ipfs_data_bucket_arn
  ]
  
  enable_secrets_access = var.enable_secrets_manager
  
  tags = local.common_tags
}

module "ecr" {
  source = "./modules/ecr"
  
  name_prefix         = local.name_prefix
  image_tag_mutability = var.ecr_image_tag_mutability
  scan_on_push        = var.ecr_scan_on_push
  
  tags = local.common_tags
}

module "storage" {
  source = "./modules/storage"
  
  name_prefix          = local.name_prefix
  random_suffix        = random_string.suffix.result
  frontend_domain_name = var.frontend_domain_name
  
  enable_versioning   = var.s3_enable_versioning
  enable_encryption   = var.s3_enable_encryption
  enable_public_access = var.s3_enable_public_access
  
  tags = local.common_tags
}

module "database" {
  source = "./modules/database"
  
  count = var.enable_rds ? 1 : 0
  
  name_prefix          = local.name_prefix
  vpc_id               = module.networking.vpc_id
  database_subnets     = module.networking.database_subnet_ids
  security_group_id    = module.security.database_security_group_id
  
  engine_version       = var.rds_engine_version
  instance_class       = var.rds_instance_class
  allocated_storage    = var.rds_allocated_storage
  storage_encrypted    = var.rds_storage_encrypted
  
  database_name        = var.rds_database_name
  master_username      = var.rds_master_username
  
  backup_retention_period = var.rds_backup_retention_period
  backup_window          = var.rds_backup_window
  maintenance_window     = var.rds_maintenance_window
  
  skip_final_snapshot = var.rds_skip_final_snapshot
  deletion_protection = var.rds_deletion_protection
  
  tags = local.common_tags
}

module "cache" {
  source = "./modules/cache"
  
  count = var.enable_redis ? 1 : 0
  
  name_prefix       = local.name_prefix
  vpc_id            = module.networking.vpc_id
  cache_subnets     = module.networking.cache_subnet_ids
  security_group_id = module.security.cache_security_group_id
  
  node_type               = var.redis_node_type
  num_cache_nodes         = var.redis_num_cache_nodes
  engine_version          = var.redis_engine_version
  port                    = var.redis_port
  
  automatic_failover_enabled = var.redis_automatic_failover
  at_rest_encryption_enabled = var.redis_at_rest_encryption
  transit_encryption_enabled = var.redis_transit_encryption
  
  tags = local.common_tags
}

module "compute" {
  source = "./modules/compute"
  
  name_prefix = local.name_prefix
  
  # Networking
  vpc_id             = module.networking.vpc_id
  private_subnet_ids = module.networking.private_subnet_ids
  public_subnet_ids  = module.networking.public_subnet_ids
  
  # Security Groups
  backend_security_group_id   = module.security.backend_security_group_id
  frontend_security_group_id  = module.security.frontend_security_group_id
  substrate_security_group_id = module.security.substrate_security_group_id
  ipfs_security_group_id      = module.security.ipfs_security_group_id
  
  # IAM Roles
  ecs_task_execution_role_arn = module.iam.ecs_task_execution_role_arn
  ecs_task_role_arn           = module.iam.ecs_task_role_arn
  
  # ECR Repositories
  backend_repository_url   = module.ecr.backend_repository_url
  frontend_repository_url  = module.ecr.frontend_repository_url
  substrate_repository_url = module.ecr.substrate_repository_url
  ipfs_repository_url      = module.ecr.ipfs_repository_url
  
  # Container Configuration
  backend_image_tag   = var.backend_image_tag
  frontend_image_tag  = var.frontend_image_tag
  substrate_image_tag = var.substrate_image_tag
  ipfs_image_tag      = var.ipfs_image_tag
  
  backend_cpu    = var.backend_cpu
  backend_memory = var.backend_memory
  frontend_cpu   = var.frontend_cpu
  frontend_memory = var.frontend_memory
  substrate_cpu  = var.substrate_cpu
  substrate_memory = var.substrate_memory
  ipfs_cpu       = var.ipfs_cpu
  ipfs_memory    = var.ipfs_memory
  
  # Service Configuration
  backend_desired_count   = var.backend_desired_count
  frontend_desired_count  = var.frontend_desired_count
  substrate_desired_count = var.substrate_desired_count
  ipfs_desired_count      = var.ipfs_desired_count
  
  # Environment Variables
  environment = var.environment
  
  backend_environment = [
    {
      name  = "NODE_ENV"
      value = var.environment
    },
    {
      name  = "SUBSTRATE_WS"
      value = "ws://substrate.shadow-chain.local:9944"
    },
    {
      name  = "IPFS_API_URL"
      value = var.use_web3_storage ? "https://api.web3.storage" : "http://ipfs.shadow-chain.local:5001"
    },
    {
      name  = "DATABASE_URL"
      value = var.enable_rds ? module.database[0].connection_string : ""
    },
    {
      name  = "REDIS_URL"
      value = var.enable_redis ? module.cache[0].connection_string : ""
    }
  ]
  
  frontend_environment = [
    {
      name  = "REACT_APP_BACKEND_URL"
      value = "https://api.${var.frontend_domain_name}"
    },
    {
      name  = "REACT_APP_SUBSTRATE_WS"
      value = "wss://chain.${var.frontend_domain_name}"
    }
  ]
  
  substrate_environment = [
    {
      name  = "CHAIN"
      value = "shadow-chain"
    }
  ]
  
  ipfs_environment = [
    {
      name  = "IPFS_PROFILE"
      value = "server"
    }
  ]
  
  # Secrets (from AWS Secrets Manager or Parameter Store)
  backend_secrets = var.enable_secrets_manager ? [
    {
      name      = "GITHUB_TOKEN"
      valueFrom = "${module.secrets[0].github_token_arn}"
    },
    {
      name      = "TWITTER_BEARER_TOKEN"
      valueFrom = "${module.secrets[0].twitter_token_arn}"
    },
    {
      name      = "WEB3_STORAGE_TOKEN"
      valueFrom = var.use_web3_storage ? "${module.secrets[0].web3_storage_token_arn}" : ""
    }
  ] : []
  
  # Auto Scaling
  enable_autoscaling = var.enable_autoscaling
  
  backend_min_capacity   = var.backend_min_capacity
  backend_max_capacity   = var.backend_max_capacity
  frontend_min_capacity  = var.frontend_min_capacity
  frontend_max_capacity  = var.frontend_max_capacity
  
  target_cpu_utilization    = var.target_cpu_utilization
  target_memory_utilization = var.target_memory_utilization
  
  tags = local.common_tags
}

module "load_balancer" {
  source = "./modules/load_balancer"
  
  name_prefix = local.name_prefix
  
  vpc_id            = module.networking.vpc_id
  public_subnet_ids = module.networking.public_subnet_ids
  security_group_id = module.security.alb_security_group_id
  
  # Certificate
  certificate_arn = var.acm_certificate_arn
  
  # Target Groups
  backend_target_group_arn   = module.compute.backend_target_group_arn
  frontend_target_group_arn  = module.compute.frontend_target_group_arn
  substrate_target_group_arn = module.compute.substrate_target_group_arn
  
  # Health Check Configuration
  health_check_path     = "/health"
  health_check_interval = 30
  health_check_timeout  = 5
  
  tags = local.common_tags
}

module "secrets" {
  source = "./modules/secrets"
  
  count = var.enable_secrets_manager ? 1 : 0
  
  name_prefix = local.name_prefix
  
  # Initial secret values (update these after deployment)
  github_token_value         = var.github_token
  twitter_token_value        = var.twitter_bearer_token
  web3_storage_token_value   = var.web3_storage_token
  backend_signer_key_value   = var.backend_signer_private_key
  
  tags = local.common_tags
}

module "monitoring" {
  source = "./modules/monitoring"
  
  name_prefix = local.name_prefix
  
  # Services to monitor
  backend_service_name   = module.compute.backend_service_name
  frontend_service_name  = module.compute.frontend_service_name
  substrate_service_name = module.compute.substrate_service_name
  ipfs_service_name      = module.compute.ipfs_service_name
  
  # Notification settings
  alarm_email_endpoint = var.alarm_email_endpoint
  
  # Thresholds
  cpu_utilization_threshold    = var.cpu_alarm_threshold
  memory_utilization_threshold = var.memory_alarm_threshold
  error_rate_threshold         = var.error_rate_threshold
  
  tags = local.common_tags
}

module "dns" {
  source = "./modules/dns"
  
  count = var.create_route53_records ? 1 : 0
  
  domain_name = var.frontend_domain_name
  
  # ALB DNS
  alb_dns_name    = module.load_balancer.alb_dns_name
  alb_zone_id     = module.load_balancer.alb_zone_id
  
  # CloudFront Distribution (if enabled)
  cloudfront_domain_name = var.enable_cloudfront ? module.cdn[0].distribution_domain_name : ""
  cloudfront_zone_id     = var.enable_cloudfront ? module.cdn[0].distribution_zone_id : ""
  
  # Subdomains
  create_api_subdomain   = true
  create_chain_subdomain = true
  create_ipfs_subdomain  = var.ipfs_desired_count > 0
  
  tags = local.common_tags
}

module "cdn" {
  source = "./modules/cdn"
  
  count = var.enable_cloudfront ? 1 : 0
  
  name_prefix = local.name_prefix
  
  # Origin Configuration
  frontend_bucket_domain = module.storage.frontend_bucket_domain
  api_domain_name       = "api.${var.frontend_domain_name}"
  
  # Certificate
  acm_certificate_arn = var.acm_certificate_arn
  
  # Domain
  domain_aliases = [var.frontend_domain_name, "www.${var.frontend_domain_name}"]
  
  # Caching
  default_ttl = 86400
  max_ttl     = 31536000
  
  # Security
  web_acl_id = var.enable_waf ? module.waf[0].web_acl_id : ""
  
  tags = local.common_tags
}

module "waf" {
  source = "./modules/waf"
  
  count = var.enable_waf ? 1 : 0
  
  name_prefix = local.name_prefix
  
  # Rules configuration
  rate_limit_requests = var.waf_rate_limit
  
  # IP allowlist/blocklist
  ip_allowlist = var.waf_ip_allowlist
  ip_blocklist = var.waf_ip_blocklist
  
  tags = local.common_tags
}

module "backup" {
  source = "./modules/backup"
  
  count = var.enable_backup ? 1 : 0
  
  name_prefix = local.name_prefix
  
  # Resources to backup
  rds_instance_arn = var.enable_rds ? module.database[0].db_instance_arn : ""
  s3_bucket_arns = [
    module.storage.frontend_bucket_arn,
    module.storage.ipfs_data_bucket_arn
  ]
  
  # Backup configuration
  backup_retention_days = var.backup_retention_days
  backup_schedule      = var.backup_schedule
  
  tags = local.common_tags
}

# Outputs
output "vpc_id" {
  description = "VPC ID"
  value       = module.networking.vpc_id
}

output "alb_dns_name" {
  description = "ALB DNS name"
  value       = module.load_balancer.alb_dns_name
}

output "frontend_bucket_url" {
  description = "Frontend S3 bucket URL"
  value       = module.storage.frontend_bucket_url
}

output "ecr_repositories" {
  description = "ECR repository URLs"
  value = {
    backend   = module.ecr.backend_repository_url
    frontend  = module.ecr.frontend_repository_url
    substrate = module.ecr.substrate_repository_url
    ipfs      = module.ecr.ipfs_repository_url
  }
}

output "database_endpoint" {
  description = "RDS database endpoint"
  value       = var.enable_rds ? module.database[0].endpoint : null
  sensitive   = true
}

output "redis_endpoint" {
  description = "Redis cache endpoint"
  value       = var.enable_redis ? module.cache[0].endpoint : null
  sensitive   = true
}

output "cloudfront_distribution_id" {
  description = "CloudFront distribution ID"
  value       = var.enable_cloudfront ? module.cdn[0].distribution_id : null
}

output "service_endpoints" {
  description = "Service endpoints"
  value = {
    frontend  = var.enable_cloudfront ? "https://${var.frontend_domain_name}" : "http://${module.load_balancer.alb_dns_name}"
    api       = "https://api.${var.frontend_domain_name}"
    chain     = "wss://chain.${var.frontend_domain_name}"
    ipfs      = var.ipfs_desired_count > 0 ? "https://ipfs.${var.frontend_domain_name}" : null
  }
}

output "monitoring_dashboard_url" {
  description = "CloudWatch dashboard URL"
  value       = "https://console.aws.amazon.com/cloudwatch/home?region=${var.aws_region}#dashboards:name=${local.name_prefix}"
}