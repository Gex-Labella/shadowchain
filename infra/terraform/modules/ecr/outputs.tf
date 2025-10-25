# ECR Module Outputs

output "backend_repository_url" {
  description = "URL of the backend ECR repository"
  value       = aws_ecr_repository.backend.repository_url
}

output "backend_repository_arn" {
  description = "ARN of the backend ECR repository"
  value       = aws_ecr_repository.backend.arn
}

output "frontend_repository_url" {
  description = "URL of the frontend ECR repository"
  value       = aws_ecr_repository.frontend.repository_url
}

output "frontend_repository_arn" {
  description = "ARN of the frontend ECR repository"
  value       = aws_ecr_repository.frontend.arn
}

output "substrate_repository_url" {
  description = "URL of the substrate ECR repository"
  value       = aws_ecr_repository.substrate.repository_url
}

output "substrate_repository_arn" {
  description = "ARN of the substrate ECR repository"
  value       = aws_ecr_repository.substrate.arn
}

output "ipfs_repository_url" {
  description = "URL of the IPFS ECR repository"
  value       = aws_ecr_repository.ipfs.repository_url
}

output "ipfs_repository_arn" {
  description = "ARN of the IPFS ECR repository"
  value       = aws_ecr_repository.ipfs.arn
}