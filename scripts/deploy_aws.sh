#!/bin/bash

# Shadow Chain AWS Deployment Script
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
INFRA_DIR="$PROJECT_DIR/infra/terraform"

echo "☁️  Shadow Chain - AWS Deployment"
echo "================================="

# Check prerequisites
check_command() {
    if ! command -v $1 &> /dev/null; then
        echo "❌ $1 is not installed. Please install it first."
        exit 1
    fi
}

echo "📋 Checking prerequisites..."
check_command aws
check_command terraform
check_command docker

# Check AWS credentials
echo "🔐 Checking AWS credentials..."
if ! aws sts get-caller-identity > /dev/null 2>&1; then
    echo "❌ AWS credentials not configured. Please run 'aws configure'."
    exit 1
fi

AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
AWS_REGION=${AWS_REGION:-us-east-1}
echo "   Account: $AWS_ACCOUNT_ID"
echo "   Region:  $AWS_REGION"

# Build Docker images
echo "🐳 Building Docker images..."
cd "$PROJECT_DIR"

# Build images
docker build -f substrate-node/Dockerfile -t shadowchain-node:latest ./substrate-node
docker build -f backend/Dockerfile -t shadowchain-backend:latest .
docker build -f frontend/Dockerfile -t shadowchain-frontend:latest .

# Tag images for ECR
ECR_REGISTRY="$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com"
docker tag shadowchain-node:latest "$ECR_REGISTRY/shadowchain-node:latest"
docker tag shadowchain-backend:latest "$ECR_REGISTRY/shadowchain-backend:latest"
docker tag shadowchain-frontend:latest "$ECR_REGISTRY/shadowchain-frontend:latest"

# Login to ECR
echo "🔑 Logging into ECR..."
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $ECR_REGISTRY

# Create ECR repositories if they don't exist
create_ecr_repo() {
    local repo_name=$1
    aws ecr describe-repositories --repository-names $repo_name --region $AWS_REGION > /dev/null 2>&1 || \
    aws ecr create-repository --repository-name $repo_name --region $AWS_REGION > /dev/null
    echo "   ✅ Repository: $repo_name"
}

echo "📦 Creating ECR repositories..."
create_ecr_repo "shadowchain-node"
create_ecr_repo "shadowchain-backend"
create_ecr_repo "shadowchain-frontend"

# Push images to ECR
echo "⬆️  Pushing images to ECR..."
docker push "$ECR_REGISTRY/shadowchain-node:latest"
docker push "$ECR_REGISTRY/shadowchain-backend:latest"
docker push "$ECR_REGISTRY/shadowchain-frontend:latest"

# Deploy infrastructure with Terraform
echo "🏗️  Deploying infrastructure with Terraform..."
cd "$INFRA_DIR"

# Initialize Terraform
if [ ! -d ".terraform" ]; then
    terraform init
fi

# Create terraform.tfvars if it doesn't exist
if [ ! -f "terraform.tfvars" ]; then
    echo "📝 Creating terraform.tfvars..."
    cat > terraform.tfvars <<EOF
aws_region = "$AWS_REGION"
aws_account_id = "$AWS_ACCOUNT_ID"
environment = "production"
project_name = "shadowchain"

# API Keys (update these!)
github_token = "${GITHUB_TOKEN}"
twitter_bearer_token = "${TWITTER_BEARER_TOKEN}"

# Container images
substrate_image = "$ECR_REGISTRY/shadowchain-node:latest"
backend_image = "$ECR_REGISTRY/shadowchain-backend:latest"
frontend_image = "$ECR_REGISTRY/shadowchain-frontend:latest"
EOF
    echo "⚠️  Please update terraform.tfvars with your API keys!"
    read -p "Press enter when ready..."
fi

# Plan deployment
echo "📋 Planning deployment..."
terraform plan -out=tfplan

# Apply deployment
read -p "🚀 Ready to deploy? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    terraform apply tfplan
    
    # Get outputs
    echo ""
    echo "✅ Deployment complete!"
    echo ""
    echo "📍 Service endpoints:"
    terraform output -json | jq -r '
        "Frontend URL: " + .frontend_url.value,
        "Backend API URL: " + .backend_api_url.value,
        "Substrate RPC URL: " + .substrate_rpc_url.value
    '
    
    # Store outputs
    terraform output -json > "$PROJECT_DIR/deployment-outputs.json"
    echo ""
    echo "💾 Deployment outputs saved to deployment-outputs.json"
else
    echo "❌ Deployment cancelled"
    rm tfplan
    exit 1
fi

echo ""
echo "🎉 Shadow Chain deployed successfully to AWS!"
echo ""
echo "📝 Next steps:"
echo "1. Update your frontend .env with the API endpoints"
echo "2. Configure DNS if using a custom domain"
echo "3. Set up monitoring and alerts in CloudWatch"
echo "4. Configure backup strategy for chain data"