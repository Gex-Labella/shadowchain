# Shadow Chain AWS Infrastructure

This directory contains Terraform configuration for deploying Shadow Chain to AWS.

## Architecture

The infrastructure includes:
- **VPC** with public/private subnets across multiple AZs
- **ECS Fargate** for running containerized services
- **ECR** for Docker image storage
- **RDS PostgreSQL** for data indexing (optional)
- **ElastiCache Redis** for caching (optional)
- **S3** for frontend hosting and IPFS data
- **Application Load Balancer** for traffic distribution
- **CloudWatch** for monitoring and logging
- **Secrets Manager** for secure credential storage

## Prerequisites

1. **AWS CLI** configured with credentials
2. **Terraform** >= 1.3.0
3. **Docker** for building images
4. **Domain name** with ACM certificate

## Quick Start

### 1. Configure Variables

Copy the example variables file:
```bash
cp terraform.tfvars.example terraform.tfvars
```

Edit `terraform.tfvars` with your values:
```hcl
# Required
environment          = "dev"
frontend_domain_name = "shadowchain.example.com"
acm_certificate_arn  = "arn:aws:acm:..."

# Optional - adjust based on needs
enable_rds   = true
enable_redis = true
```

### 2. Initialize Terraform

```bash
terraform init
```

### 3. Plan Deployment

Review what will be created:
```bash
terraform plan
```

### 4. Deploy Infrastructure

```bash
terraform apply
```

This will create all AWS resources. Note the outputs for ECR repositories and endpoints.

### 5. Build and Push Docker Images

```bash
# Login to ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin <ECR_URL>

# Build images
cd ../..
docker build -t shadow-chain-backend backend/
docker build -t shadow-chain-frontend frontend/
docker build -t shadow-chain-substrate substrate-node/
docker build -t shadow-chain-ipfs -f docker/ipfs.Dockerfile .

# Tag images
docker tag shadow-chain-backend:latest <BACKEND_ECR_URL>:latest
docker tag shadow-chain-frontend:latest <FRONTEND_ECR_URL>:latest
docker tag shadow-chain-substrate:latest <SUBSTRATE_ECR_URL>:latest
docker tag shadow-chain-ipfs:latest <IPFS_ECR_URL>:latest

# Push images
docker push <BACKEND_ECR_URL>:latest
docker push <FRONTEND_ECR_URL>:latest
docker push <SUBSTRATE_ECR_URL>:latest
docker push <IPFS_ECR_URL>:latest
```

### 6. Update Secrets

After deployment, update secrets in AWS Secrets Manager:
1. Go to AWS Console > Secrets Manager
2. Find `shadow-chain-<env>-*` secrets
3. Update with actual values:
   - GitHub Token
   - Twitter Bearer Token
   - Web3.storage Token (if using)

### 7. Deploy Services

Force new deployment with updated images:
```bash
# Update ECS services
aws ecs update-service --cluster shadow-chain-<env> --service backend --force-new-deployment
aws ecs update-service --cluster shadow-chain-<env> --service frontend --force-new-deployment
aws ecs update-service --cluster shadow-chain-<env> --service substrate --force-new-deployment
aws ecs update-service --cluster shadow-chain-<env> --service ipfs --force-new-deployment
```

## Module Structure

```
modules/
├── networking/     # VPC, subnets, NAT gateways
├── security/       # Security groups, NACLs
├── ecr/           # Container registries
├── storage/       # S3 buckets
├── compute/       # ECS cluster and services
├── database/      # RDS PostgreSQL
├── cache/         # ElastiCache Redis
├── iam/           # IAM roles and policies
├── secrets/       # Secrets Manager
├── monitoring/    # CloudWatch alarms and dashboards
├── load_balancer/ # ALB and target groups
├── dns/           # Route53 records
├── cdn/           # CloudFront distribution
├── waf/           # Web Application Firewall
└── backup/        # AWS Backup plans
```

## Environment Management

### Development
```bash
terraform workspace new dev
terraform workspace select dev
terraform apply -var-file=dev.tfvars
```

### Staging
```bash
terraform workspace new staging
terraform workspace select staging
terraform apply -var-file=staging.tfvars
```

### Production
```bash
terraform workspace new prod
terraform workspace select prod
terraform apply -var-file=prod.tfvars
```

## Cost Optimization

### Minimal Setup (Dev)
- Single NAT Gateway
- t3.micro instances
- No Multi-AZ RDS
- No CloudFront CDN
- Estimated: ~$50-100/month

### Production Setup
- NAT Gateway per AZ
- Auto-scaling enabled
- Multi-AZ RDS
- CloudFront CDN
- WAF enabled
- Estimated: ~$500-1000/month

## Monitoring

Access CloudWatch dashboards:
```
https://console.aws.amazon.com/cloudwatch/home?region=<region>#dashboards:name=shadow-chain-<env>
```

## Cleanup

To destroy all resources:
```bash
terraform destroy
```

⚠️ **Warning**: This will delete all infrastructure including data!

## Troubleshooting

### ECS Tasks Not Starting
- Check CloudWatch logs
- Verify ECR images exist
- Check task role permissions
- Verify secrets are configured

### Database Connection Issues
- Check security group rules
- Verify RDS is in correct subnets
- Check database credentials in Secrets Manager

### Frontend Not Loading
- Check ALB target group health
- Verify S3 bucket policy
- Check CloudFront distribution (if enabled)

## Security Considerations

1. **Secrets**: Never commit credentials to git
2. **Network**: Private subnets for backend services
3. **Encryption**: Enable for RDS, S3, and EBS
4. **IAM**: Use least privilege principle
5. **Monitoring**: Set up CloudWatch alarms
6. **Backup**: Enable automated backups for RDS

## Support

For issues or questions:
1. Check CloudWatch logs
2. Review Terraform state: `terraform show`
3. Validate configuration: `terraform validate`