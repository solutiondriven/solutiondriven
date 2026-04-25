# Variable definitions for multi-region production infrastructure

variable "primary_region" {
  description = "Primary AWS region (US East) - closest to NYSE, Binance US headquarters"
  type        = string
  default     = "us-east-1"
}

variable "europe_region" {
  description = "Europe AWS region - closest to Binance EU data center"
  type        = string
  default     = "eu-west-1"
}

variable "apac_region" {
  description = "Asia-Pacific AWS region - closest to Binance APAC (Singapore)"
  type        = string
  default     = "ap-southeast-1"
}

variable "vpc_cidr" {
  description = "CIDR block for VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "eks_cluster_version" {
  description = "Kubernetes cluster version"
  type        = string
  default     = "1.27"
}

variable "instance_types" {
  description = "EC2 instance types for worker nodes (optimized for low latency)"
  type        = list(string)
  default     = ["c6i.2xlarge", "c6i.4xlarge"]  # Compute-optimized for trading
}

variable "min_size" {
  description = "Minimum number of worker nodes per AZ"
  type        = number
  default     = 2
}

variable "max_size" {
  description = "Maximum number of worker nodes per AZ"
  type        = number
  default     = 10
}

variable "desired_size" {
  description = "Desired number of worker nodes per AZ"
  type        = number
  default     = 3
}

variable "enable_spot_instances" {
  description = "Use spot instances for cost optimization (not suitable for critical nodes)"
  type        = bool
  default     = false
}

variable "project_name" {
  description = "Project name for resource naming"
  type        = string
  default     = "micromax"
}

variable "tags" {
  description = "Common tags for all resources"
  type        = map(string)
  default = {
    Terraform   = "true"
    Environment = "production"
    Project     = "micromax"
  }
}

# Istio configuration variables
variable "istio_version" {
  description = "Istio version to deploy"
  type        = string
  default     = "1.18.2"
}

variable "enable_istio_metrics" {
  description = "Enable Istio metrics collection"
  type        = bool
  default     = true
}

# Networking variables
variable "enable_vpc_flow_logs" {
  description = "Enable VPC Flow Logs for network monitoring"
  type        = bool
  default     = true
}

variable "flow_logs_retention_days" {
  description = "CloudWatch log retention for VPC Flow Logs (in days)"
  type        = number
  default     = 90
}

# Monitoring and observability
variable "enable_prometheus" {
  description = "Deploy Prometheus for metrics collection"
  type        = bool
  default     = true
}

variable "enable_jaeger" {
  description = "Deploy Jaeger for distributed tracing"
  type        = bool
  default     = true
}
