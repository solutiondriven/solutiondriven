# Multi-region provider configuration
# Enables deployment of Micromax infrastructure across US, EU, and APAC regions
# Each region has its own cluster handling local exchange connections

provider "aws" {
  alias  = "primary"
  region = var.primary_region   # us-east-1 (NYSE, Binance US)

  default_tags {
    tags = {
      Project     = "micromax"
      Environment = "production"
      ManagedBy   = "terraform"
      Region      = var.primary_region
    }
  }
}

provider "aws" {
  alias  = "europe"
  region = var.europe_region   # eu-west-1 (Binance EU)

  default_tags {
    tags = {
      Project     = "micromax"
      Environment = "production"
      ManagedBy   = "terraform"
      Region      = var.europe_region
    }
  }
}

provider "aws" {
  alias  = "apac"
  region = var.apac_region     # ap-southeast-1 (Singapore, Binance APAC)

  default_tags {
    tags = {
      Project     = "micromax"
      Environment = "production"
      ManagedBy   = "terraform"
      Region      = var.apac_region
    }
  }
}

# Kubernetes providers for each region
provider "kubernetes" {
  alias = "primary"
  host  = module.eks_primary.cluster_endpoint
  token = data.aws_eks_cluster_auth.primary.token
  cluster_ca_certificate = base64decode(
    module.eks_primary.cluster_certificate_authority_data
  )
}

provider "kubernetes" {
  alias = "europe"
  host  = module.eks_europe.cluster_endpoint
  token = data.aws_eks_cluster_auth.europe.token
  cluster_ca_certificate = base64decode(
    module.eks_europe.cluster_certificate_authority_data
  )
}

provider "kubernetes" {
  alias = "apac"
  host  = module.eks_apac.cluster_endpoint
  token = data.aws_eks_cluster_auth.apac.token
  cluster_ca_certificate = base64decode(
    module.eks_apac.cluster_certificate_authority_data
  )
}

# Helm providers for each region
provider "helm" {
  alias = "primary"
  kubernetes {
    host  = module.eks_primary.cluster_endpoint
    token = data.aws_eks_cluster_auth.primary.token
    cluster_ca_certificate = base64decode(
      module.eks_primary.cluster_certificate_authority_data
    )
  }
}

provider "helm" {
  alias = "europe"
  kubernetes {
    host  = module.eks_europe.cluster_endpoint
    token = data.aws_eks_cluster_auth.europe.token
    cluster_ca_certificate = base64decode(
      module.eks_europe.cluster_certificate_authority_data
    )
  }
}

provider "helm" {
  alias = "apac"
  kubernetes {
    host  = module.eks_apac.cluster_endpoint
    token = data.aws_eks_cluster_auth.apac.token
    cluster_ca_certificate = base64decode(
      module.eks_apac.cluster_certificate_authority_data
    )
  }
}

# Data sources for cluster authentication
data "aws_eks_cluster_auth" "primary" {
  name = module.eks_primary.cluster_name
}

data "aws_eks_cluster_auth" "europe" {
  name = module.eks_europe.cluster_name
}

data "aws_eks_cluster_auth" "apac" {
  name = module.eks_apac.cluster_name
}
