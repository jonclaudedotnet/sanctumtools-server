# Terraform Configuration for SanctumTools AWS Infrastructure
# This is an optional Infrastructure as Code approach for managing AWS resources

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
  required_version = ">= 1.0"
}

provider "aws" {
  region = "us-east-1"
}

# Variables
variable "domain_name" {
  default = "sanctumtools.com"
}

variable "ec2_instance_id" {
  default = "i-0c841e020508e7227"
}

variable "ec2_instance_ip" {
  default = "13.218.249.157"
}

# Data source for existing hosted zone
data "aws_route53_zone" "main" {
  name = var.domain_name
}

# Route53 A Records
resource "aws_route53_record" "root" {
  zone_id = data.aws_route53_zone.main.zone_id
  name    = var.domain_name
  type    = "A"
  ttl     = 300
  records = [var.ec2_instance_ip]
}

resource "aws_route53_record" "www" {
  zone_id = data.aws_route53_zone.main.zone_id
  name    = "www.${var.domain_name}"
  type    = "A"
  ttl     = 300
  records = [var.ec2_instance_ip]
}

resource "aws_route53_record" "mr" {
  zone_id = data.aws_route53_zone.main.zone_id
  name    = "mr.${var.domain_name}"
  type    = "A"
  ttl     = 300
  records = [var.ec2_instance_ip]
}

# ACM Certificate
resource "aws_acm_certificate" "main" {
  domain_name               = var.domain_name
  subject_alternative_names = ["*.${var.domain_name}"]
  validation_method        = "DNS"

  tags = {
    Name        = "sanctumtools-certificate"
    Environment = "production"
    Project     = "SanctumTools"
  }

  lifecycle {
    create_before_destroy = true
  }
}

# Certificate validation DNS records
resource "aws_route53_record" "cert_validation" {
  for_each = {
    for dvo in aws_acm_certificate.main.domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      record = dvo.resource_record_value
      type   = dvo.resource_record_type
    }
  }

  zone_id = data.aws_route53_zone.main.zone_id
  name    = each.value.name
  type    = each.value.type
  records = [each.value.record]
  ttl     = 60
}

# Certificate validation
resource "aws_acm_certificate_validation" "main" {
  certificate_arn         = aws_acm_certificate.main.arn
  validation_record_fqdns = [for record in aws_route53_record.cert_validation : record.fqdn]
}

# Security Group for ALB
resource "aws_security_group" "alb" {
  name        = "sanctumtools-alb-sg"
  description = "Security group for SanctumTools ALB"

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "sanctumtools-alb-sg"
  }
}

# Target Group
resource "aws_lb_target_group" "main" {
  name     = "sanctumtools-targets"
  port     = 3000
  protocol = "HTTP"
  vpc_id   = data.aws_vpc.default.id

  health_check {
    enabled             = true
    healthy_threshold   = 2
    unhealthy_threshold = 2
    timeout             = 5
    interval            = 30
    path                = "/"
    matcher             = "200"
  }

  tags = {
    Name = "sanctumtools-targets"
  }
}

# Target Group Attachment
resource "aws_lb_target_group_attachment" "main" {
  target_group_arn = aws_lb_target_group.main.arn
  target_id        = var.ec2_instance_id
  port             = 3000
}

# Data source for default VPC
data "aws_vpc" "default" {
  default = true
}

# Data source for subnets
data "aws_subnets" "default" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }
}

# Application Load Balancer
resource "aws_lb" "main" {
  name               = "sanctumtools-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets           = data.aws_subnets.default.ids

  enable_deletion_protection = false
  enable_http2              = true

  tags = {
    Name        = "sanctumtools-alb"
    Environment = "production"
  }
}

# HTTP Listener (redirect to HTTPS)
resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.main.arn
  port              = "80"
  protocol          = "HTTP"

  default_action {
    type = "redirect"

    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }
}

# HTTPS Listener
resource "aws_lb_listener" "https" {
  load_balancer_arn = aws_lb.main.arn
  port              = "443"
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS-1-2-2017-01"
  certificate_arn   = aws_acm_certificate_validation.main.certificate_arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.main.arn
  }
}

# Update Route53 records to point to ALB (after ALB is created)
resource "aws_route53_record" "root_alb" {
  zone_id = data.aws_route53_zone.main.zone_id
  name    = var.domain_name
  type    = "A"

  alias {
    name                   = aws_lb.main.dns_name
    zone_id                = aws_lb.main.zone_id
    evaluate_target_health = true
  }

  depends_on = [aws_lb.main]
}

resource "aws_route53_record" "www_alb" {
  zone_id = data.aws_route53_zone.main.zone_id
  name    = "www.${var.domain_name}"
  type    = "A"

  alias {
    name                   = aws_lb.main.dns_name
    zone_id                = aws_lb.main.zone_id
    evaluate_target_health = true
  }

  depends_on = [aws_lb.main]
}

resource "aws_route53_record" "mr_alb" {
  zone_id = data.aws_route53_zone.main.zone_id
  name    = "mr.${var.domain_name}"
  type    = "A"

  alias {
    name                   = aws_lb.main.dns_name
    zone_id                = aws_lb.main.zone_id
    evaluate_target_health = true
  }

  depends_on = [aws_lb.main]
}

# CloudWatch Alarms
resource "aws_cloudwatch_metric_alarm" "unhealthy_targets" {
  alarm_name          = "sanctumtools-unhealthy-targets"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name        = "UnHealthyHostCount"
  namespace          = "AWS/ApplicationELB"
  period             = "300"
  statistic          = "Average"
  threshold          = "0"
  alarm_description  = "This metric monitors unhealthy ALB targets"

  dimensions = {
    LoadBalancer = aws_lb.main.arn_suffix
    TargetGroup  = aws_lb_target_group.main.arn_suffix
  }
}

resource "aws_cloudwatch_metric_alarm" "high_latency" {
  alarm_name          = "sanctumtools-high-latency"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name        = "TargetResponseTime"
  namespace          = "AWS/ApplicationELB"
  period             = "300"
  statistic          = "Average"
  threshold          = "1"
  alarm_description  = "This metric monitors ALB response time"

  dimensions = {
    LoadBalancer = aws_lb.main.arn_suffix
  }
}

# Outputs
output "alb_dns_name" {
  value       = aws_lb.main.dns_name
  description = "DNS name of the Application Load Balancer"
}

output "certificate_arn" {
  value       = aws_acm_certificate.main.arn
  description = "ARN of the ACM certificate"
}

output "target_group_arn" {
  value       = aws_lb_target_group.main.arn
  description = "ARN of the target group"
}

output "estimated_monthly_cost" {
  value = "Approximately $20.70/month (ALB: $16.20, Route53: $0.90, Data: $3.60)"
}