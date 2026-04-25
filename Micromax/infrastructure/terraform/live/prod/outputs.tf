# Outputs for accessing cluster endpoints and important resources

output "primary_cluster_endpoint" {
  description = "Kubernetes API endpoint for primary cluster (US East)"
  value       = module.eks_primary.cluster_endpoint
}

output "europe_cluster_endpoint" {
  description = "Kubernetes API endpoint for Europe cluster (EU West)"
  value       = module.eks_europe.cluster_endpoint
}

output "apac_cluster_endpoint" {
  description = "Kubernetes API endpoint for APAC cluster (Singapore)"
  value       = module.eks_apac.cluster_endpoint
}

output "primary_cluster_name" {
  description = "Name of primary EKS cluster"
  value       = module.eks_primary.cluster_name
}

output "europe_cluster_name" {
  description = "Name of Europe EKS cluster"
  value       = module.eks_europe.cluster_name
}

output "apac_cluster_name" {
  description = "Name of APAC EKS cluster"
  value       = module.eks_apac.cluster_name
}

output "s3_terraform_state_bucket" {
  description = "S3 bucket for Terraform remote state"
  value       = data.aws_s3_bucket.terraform_state.id
}

output "regional_service_meshes" {
  description = "Istio service mesh endpoints for each region"
  value = {
    primary = module.eks_primary.istio_gateway_ip
    europe  = module.eks_europe.istio_gateway_ip
    apac    = module.eks_apac.istio_gateway_ip
  }
}
