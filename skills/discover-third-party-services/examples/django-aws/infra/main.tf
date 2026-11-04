terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.80"
    }
  }
}

provider "aws" {
  region = "eu-central-1"
}

resource "aws_s3_bucket" "media" {
  bucket = "acme-media"
}

resource "aws_db_instance" "main" {
  engine         = "postgres"
  instance_class = "db.t4g.medium"
}
