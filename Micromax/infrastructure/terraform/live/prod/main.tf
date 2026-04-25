# Main configuration for multi-region EKS and Istio deployment

# Lookup existing S3 bucket for Terraform state
data "aws_s3_bucket" "terraform_state" {
  bucket = "micromax-terraform-state"
}

# ============================================================================
# PRIMARY REGION (US East) - NYSE, Binance US Data
# ============================================================================

module "eks_primary" {
  source = "../modules/eks"
  
  providers = {
    aws = aws.primary
    kubernetes = kubernetes.primary
    helm = helm.primary
  }

  cluster_name    = "${var.project_name}-primary"
  cluster_version = var.eks_cluster_version
  region          = var.primary_region

  vpc_cidr            = var.vpc_cidr
  availability_zones  = ["${var.primary_region}a", "${var.primary_region}b", "${var.primary_region}c"]
  
  instance_types      = var.instance_types
  min_size            = var.min_size
  max_size            = var.max_size
  desired_size        = var.desired_size
  enable_spot         = var.enable_spot_instances

  enable_vpc_flow_logs = var.enable_vpc_flow_logs
  log_retention_days   = var.flow_logs_retention_days

  tags = merge(
    var.tags,
    {
      Region = "primary"
      Purpose = "Exchange: NYSE, Binance US"
    }
  )
}

# ============================================================================
# EUROPE REGION (EU West) - Binance EU Data
# ============================================================================

module "eks_europe" {
  source = "../modules/eks"
  
  providers = {
    aws = aws.europe
    kubernetes = kubernetes.europe
    helm = helm.europe
  }

  cluster_name    = "${var.project_name}-europe"
  cluster_version = var.eks_cluster_version
  region          = var.europe_region

  vpc_cidr            = var.vpc_cidr
  availability_zones  = ["${var.europe_region}a", "${var.europe_region}b", "${var.europe_region}c"]
  
  instance_types      = var.instance_types
  min_size            = var.min_size
  max_size            = var.max_size
  desired_size        = var.desired_size
  enable_spot         = var.enable_spot_instances

  enable_vpc_flow_logs = var.enable_vpc_flow_logs
  log_retention_days   = var.flow_logs_retention_days

  tags = merge(
    var.tags,
    {
      Region = "europe"
      Purpose = "Exchange: Binance EU"
    }
  )
}

# ============================================================================
# APAC REGION (Singapore) - Binance APAC Data
# ============================================================================

module "eks_apac" {
  source = "../modules/eks"
  
  providers = {
    aws = aws.apac
    kubernetes = kubernetes.apac
    helm = helm.apac
  }

  cluster_name    = "${var.project_name}-apac"
  cluster_version = var.eks_cluster_version
  region          = var.apac_region

  vpc_cidr            = var.vpc_cidr
  availability_zones  = ["${var.apac_region}a", "${var.apac_region}b", "${var.apac_region}c"]
  
  instance_types      = var.instance_types
  min_size            = var.min_size
  max_size            = var.max_size
  desired_size        = var.desired_size
  enable_spot         = var.enable_spot_instances

  enable_vpc_flow_logs = var.enable_vpc_flow_logs
  log_retention_days   = var.flow_logs_retention_days

  tags = merge(
    var.tags,
    {
      Region = "apac"
      Purpose = "Exchange: Binance APAC, Asia Markets"
    }
  )
}

# ============================================================================
# SERVICE MESH (Istio) - Deployed to each region
# ============================================================================

module "service_mesh_primary" {
  source = "../modules/service-mesh"
  
  providers = {
    aws = aws.primary
    kubernetes = kubernetes.primary
    helm = helm.primary
  }

  cluster_name      = module.eks_primary.cluster_name
  istio_version     = var.istio_version
  enable_metrics    = var.enable_istio_metrics
  enable_prometheus = var.enable_prometheus
  enable_jaeger     = var.enable_jaeger

  region = var.primary_region

  tags = merge(var.tags, { Region = "primary" })
}

module "service_mesh_europe" {
  source = "../modules/service-mesh"
  
  providers = {
    aws = aws.europe
    kubernetes = kubernetes.europe
    helm = helm.europe
  }

  cluster_name      = module.eks_europe.cluster_name
  istio_version     = var.istio_version
  enable_metrics    = var.enable_istio_metrics
  enable_prometheus = var.enable_prometheus
  enable_jaeger     = var.enable_jaeger

  region = var.europe_region

  tags = merge(var.tags, { Region = "europe" })
}

module "service_mesh_apac" {
  source = "../modules/service-mesh"
  
  providers = {
    aws = aws.apac
    kubernetes = kubernetes.apac
    helm = helm.apac
  }

  cluster_name      = module.eks_apac.cluster_name
  istio_version     = var.istio_version
  enable_metrics    = var.enable_istio_metrics
  enable_prometheus = var.enable_prometheus
  enable_jaeger     = var.enable_jaeger

  region = var.apac_region

  tags = merge(var.tags, { Region = "apac" })
}

# ============================================================================
# Inter-Region Communication Setup
# ============================================================================
# Configure kubeconfig contexts for easy switching between regions

resource "null_resource" "kubeconfig_setup" {
  provisioners "local-exec" {
    command = <<-EOT
      echo "Configuring kubeconfig for multi-region access..."
      aws eks update-kubeconfig --region ${var.primary_region} --name ${module.eks_primary.cluster_name} --alias micromax-primary
      aws eks update-kubeconfig --region ${var.europe_region} --name ${module.eks_europe.cluster_name} --alias micromax-europe
      aws eks update-kubeconfig --region ${var.apac_region} --name ${module.eks_apac.cluster_name} --alias micromax-apac
    EOT
  }
}
