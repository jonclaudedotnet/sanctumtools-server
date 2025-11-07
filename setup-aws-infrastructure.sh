#!/bin/bash

# AWS Infrastructure Setup Script for SanctumTools
# This script provides AWS CLI commands to set up the infrastructure
# Run sections manually to maintain control over the process

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
DOMAIN="sanctumtools.com"
EC2_INSTANCE_ID="i-0c841e020508e7227"
EC2_IP="13.218.249.157"
REGION="us-east-1"
ALB_NAME="sanctumtools-alb"
TARGET_GROUP_NAME="sanctumtools-targets"

echo -e "${GREEN}=== AWS Infrastructure Setup for SanctumTools ===${NC}"
echo "Domain: $DOMAIN"
echo "EC2 Instance: $EC2_INSTANCE_ID ($EC2_IP)"
echo "Region: $REGION"
echo ""

# Function to check AWS CLI
check_aws_cli() {
    if ! command -v aws &> /dev/null; then
        echo -e "${RED}AWS CLI is not installed. Please install it first.${NC}"
        exit 1
    fi
    echo -e "${GREEN}✓ AWS CLI found${NC}"
}

# Function to check AWS credentials
check_aws_credentials() {
    if ! aws sts get-caller-identity &> /dev/null; then
        echo -e "${RED}AWS credentials not configured. Run 'aws configure' first.${NC}"
        exit 1
    fi
    echo -e "${GREEN}✓ AWS credentials configured${NC}"
    aws sts get-caller-identity --query Account --output text
}

# 1. CREATE ROUTE53 DNS RECORDS
create_route53_records() {
    echo -e "${YELLOW}\n=== Step 1: Creating Route53 DNS Records ===${NC}"

    # Get hosted zone ID
    ZONE_ID=$(aws route53 list-hosted-zones-by-name --query "HostedZones[?Name=='${DOMAIN}.'].Id" --output text | cut -d'/' -f3)

    if [ -z "$ZONE_ID" ]; then
        echo -e "${RED}Hosted zone for $DOMAIN not found${NC}"
        return 1
    fi

    echo "Found hosted zone: $ZONE_ID"

    # Create A record for root domain
    cat > /tmp/route53-root.json << EOF
{
    "Changes": [{
        "Action": "UPSERT",
        "ResourceRecordSet": {
            "Name": "${DOMAIN}",
            "Type": "A",
            "TTL": 300,
            "ResourceRecords": [{"Value": "${EC2_IP}"}]
        }
    }]
}
EOF

    # Create A record for www subdomain
    cat > /tmp/route53-www.json << EOF
{
    "Changes": [{
        "Action": "UPSERT",
        "ResourceRecordSet": {
            "Name": "www.${DOMAIN}",
            "Type": "A",
            "TTL": 300,
            "ResourceRecords": [{"Value": "${EC2_IP}"}]
        }
    }]
}
EOF

    # Create A record for mr subdomain
    cat > /tmp/route53-mr.json << EOF
{
    "Changes": [{
        "Action": "UPSERT",
        "ResourceRecordSet": {
            "Name": "mr.${DOMAIN}",
            "Type": "A",
            "TTL": 300,
            "ResourceRecords": [{"Value": "${EC2_IP}"}]
        }
    }]
}
EOF

    # Apply changes
    echo "Creating A record for ${DOMAIN}..."
    aws route53 change-resource-record-sets --hosted-zone-id $ZONE_ID --change-batch file:///tmp/route53-root.json

    echo "Creating A record for www.${DOMAIN}..."
    aws route53 change-resource-record-sets --hosted-zone-id $ZONE_ID --change-batch file:///tmp/route53-www.json

    echo "Creating A record for mr.${DOMAIN}..."
    aws route53 change-resource-record-sets --hosted-zone-id $ZONE_ID --change-batch file:///tmp/route53-mr.json

    echo -e "${GREEN}✓ DNS records created successfully${NC}"
}

# 2. REQUEST ACM CERTIFICATE
request_acm_certificate() {
    echo -e "${YELLOW}\n=== Step 2: Requesting ACM SSL Certificate ===${NC}"

    # Request certificate
    CERT_ARN=$(aws acm request-certificate \
        --domain-name ${DOMAIN} \
        --validation-method DNS \
        --subject-alternative-names "*.${DOMAIN}" \
        --region ${REGION} \
        --query CertificateArn \
        --output text)

    echo "Certificate requested: $CERT_ARN"

    # Wait for validation records to be available
    echo "Waiting for validation records..."
    sleep 10

    # Get validation records
    VALIDATION_RECORDS=$(aws acm describe-certificate \
        --certificate-arn $CERT_ARN \
        --region ${REGION} \
        --query 'Certificate.DomainValidationOptions[*].[ResourceRecord.Name,ResourceRecord.Value]' \
        --output text)

    echo -e "${YELLOW}Validation CNAME records needed:${NC}"
    echo "$VALIDATION_RECORDS"

    # Auto-create validation records in Route53
    ZONE_ID=$(aws route53 list-hosted-zones-by-name --query "HostedZones[?Name=='${DOMAIN}.'].Id" --output text | cut -d'/' -f3)

    aws acm describe-certificate --certificate-arn $CERT_ARN --region ${REGION} \
        --query 'Certificate.DomainValidationOptions[*]' \
        --output json | jq -c '.[]' | while read -r domain; do

        RECORD_NAME=$(echo $domain | jq -r '.ResourceRecord.Name')
        RECORD_VALUE=$(echo $domain | jq -r '.ResourceRecord.Value')

        cat > /tmp/validation-record.json << EOF
{
    "Changes": [{
        "Action": "UPSERT",
        "ResourceRecordSet": {
            "Name": "${RECORD_NAME}",
            "Type": "CNAME",
            "TTL": 60,
            "ResourceRecords": [{"Value": "${RECORD_VALUE}"}]
        }
    }]
}
EOF

        echo "Creating validation record for: $RECORD_NAME"
        aws route53 change-resource-record-sets --hosted-zone-id $ZONE_ID --change-batch file:///tmp/validation-record.json
    done

    echo -e "${GREEN}✓ Certificate requested and validation records created${NC}"
    echo "Certificate ARN: $CERT_ARN"
    echo "Validation usually completes in 5-10 minutes"

    # Save certificate ARN for later use
    echo $CERT_ARN > /tmp/sanctumtools-cert-arn.txt
}

# 3. CREATE APPLICATION LOAD BALANCER
create_alb() {
    echo -e "${YELLOW}\n=== Step 3: Creating Application Load Balancer ===${NC}"

    # Get default VPC
    VPC_ID=$(aws ec2 describe-vpcs --filters "Name=is-default,Values=true" --query "Vpcs[0].VpcId" --output text)
    echo "Using VPC: $VPC_ID"

    # Get subnets (at least 2 required)
    SUBNETS=$(aws ec2 describe-subnets --filters "Name=vpc-id,Values=$VPC_ID" --query "Subnets[*].SubnetId" --output text | tr '\t' ' ')
    SUBNET_ARRAY=($SUBNETS)
    SUBNET1=${SUBNET_ARRAY[0]}
    SUBNET2=${SUBNET_ARRAY[1]}
    echo "Using subnets: $SUBNET1, $SUBNET2"

    # Create security group for ALB
    echo "Creating security group for ALB..."
    ALB_SG=$(aws ec2 create-security-group \
        --group-name sanctumtools-alb-sg \
        --description "Security group for SanctumTools ALB" \
        --vpc-id $VPC_ID \
        --query GroupId \
        --output text)

    echo "Security group created: $ALB_SG"

    # Add ingress rules
    aws ec2 authorize-security-group-ingress --group-id $ALB_SG --protocol tcp --port 80 --cidr 0.0.0.0/0
    aws ec2 authorize-security-group-ingress --group-id $ALB_SG --protocol tcp --port 443 --cidr 0.0.0.0/0

    # Create target group
    echo "Creating target group..."
    TARGET_GROUP_ARN=$(aws elbv2 create-target-group \
        --name ${TARGET_GROUP_NAME} \
        --protocol HTTP \
        --port 3000 \
        --vpc-id $VPC_ID \
        --health-check-path / \
        --health-check-interval-seconds 30 \
        --health-check-timeout-seconds 5 \
        --healthy-threshold-count 2 \
        --unhealthy-threshold-count 2 \
        --query 'TargetGroups[0].TargetGroupArn' \
        --output text)

    echo "Target group created: $TARGET_GROUP_ARN"

    # Register EC2 instance with target group
    echo "Registering EC2 instance with target group..."
    aws elbv2 register-targets \
        --target-group-arn $TARGET_GROUP_ARN \
        --targets Id=${EC2_INSTANCE_ID},Port=3000

    # Create load balancer
    echo "Creating Application Load Balancer..."
    ALB_ARN=$(aws elbv2 create-load-balancer \
        --name ${ALB_NAME} \
        --subnets $SUBNET1 $SUBNET2 \
        --security-groups $ALB_SG \
        --scheme internet-facing \
        --type application \
        --ip-address-type ipv4 \
        --query 'LoadBalancers[0].LoadBalancerArn' \
        --output text)

    ALB_DNS=$(aws elbv2 describe-load-balancers \
        --load-balancer-arns $ALB_ARN \
        --query 'LoadBalancers[0].DNSName' \
        --output text)

    echo "ALB created: $ALB_DNS"

    # Get certificate ARN
    CERT_ARN=$(cat /tmp/sanctumtools-cert-arn.txt 2>/dev/null || echo "")

    if [ -z "$CERT_ARN" ]; then
        echo -e "${YELLOW}Certificate ARN not found. Please run step 2 first or provide the ARN.${NC}"
        read -p "Enter Certificate ARN: " CERT_ARN
    fi

    # Create HTTP listener (redirect to HTTPS)
    echo "Creating HTTP listener..."
    aws elbv2 create-listener \
        --load-balancer-arn $ALB_ARN \
        --protocol HTTP \
        --port 80 \
        --default-actions Type=redirect,RedirectConfig="{Protocol=HTTPS,Port=443,StatusCode=HTTP_301}"

    # Create HTTPS listener
    echo "Creating HTTPS listener..."
    aws elbv2 create-listener \
        --load-balancer-arn $ALB_ARN \
        --protocol HTTPS \
        --port 443 \
        --certificates CertificateArn=$CERT_ARN \
        --default-actions Type=forward,TargetGroupArn=$TARGET_GROUP_ARN

    echo -e "${GREEN}✓ Application Load Balancer created successfully${NC}"
    echo "ALB DNS: $ALB_DNS"

    # Save ALB details
    echo $ALB_ARN > /tmp/sanctumtools-alb-arn.txt
    echo $ALB_DNS > /tmp/sanctumtools-alb-dns.txt
    echo $ALB_SG > /tmp/sanctumtools-alb-sg.txt
}

# 4. UPDATE EC2 SECURITY GROUP
update_ec2_security_group() {
    echo -e "${YELLOW}\n=== Step 4: Updating EC2 Security Group ===${NC}"

    # Get ALB security group
    ALB_SG=$(cat /tmp/sanctumtools-alb-sg.txt 2>/dev/null || echo "")

    if [ -z "$ALB_SG" ]; then
        echo -e "${YELLOW}ALB security group not found. Please run step 3 first.${NC}"
        return 1
    fi

    # Get EC2 instance security group
    EC2_SG=$(aws ec2 describe-instances \
        --instance-ids ${EC2_INSTANCE_ID} \
        --query 'Reservations[0].Instances[0].SecurityGroups[0].GroupId' \
        --output text)

    echo "EC2 Security Group: $EC2_SG"
    echo "ALB Security Group: $ALB_SG"

    # Remove public access to port 3000
    echo "Removing public access to port 3000..."
    aws ec2 revoke-security-group-ingress \
        --group-id $EC2_SG \
        --protocol tcp \
        --port 3000 \
        --cidr 0.0.0.0/0 2>/dev/null || true

    # Add ALB access to port 3000
    echo "Adding ALB access to port 3000..."
    aws ec2 authorize-security-group-ingress \
        --group-id $EC2_SG \
        --protocol tcp \
        --port 3000 \
        --source-group $ALB_SG

    echo -e "${GREEN}✓ Security groups updated successfully${NC}"
}

# 5. UPDATE ROUTE53 TO POINT TO ALB
update_route53_to_alb() {
    echo -e "${YELLOW}\n=== Step 5: Updating Route53 to point to ALB ===${NC}"

    # Get ALB DNS
    ALB_DNS=$(cat /tmp/sanctumtools-alb-dns.txt 2>/dev/null || echo "")

    if [ -z "$ALB_DNS" ]; then
        echo -e "${YELLOW}ALB DNS not found. Please run step 3 first.${NC}"
        return 1
    fi

    # Get ALB hosted zone ID
    ALB_ZONE=$(aws elbv2 describe-load-balancers \
        --query "LoadBalancers[?DNSName=='${ALB_DNS}'].CanonicalHostedZoneId" \
        --output text)

    # Get Route53 hosted zone ID
    ZONE_ID=$(aws route53 list-hosted-zones-by-name --query "HostedZones[?Name=='${DOMAIN}.'].Id" --output text | cut -d'/' -f3)

    # Update root domain
    cat > /tmp/route53-alb-root.json << EOF
{
    "Changes": [{
        "Action": "UPSERT",
        "ResourceRecordSet": {
            "Name": "${DOMAIN}",
            "Type": "A",
            "AliasTarget": {
                "HostedZoneId": "${ALB_ZONE}",
                "DNSName": "${ALB_DNS}",
                "EvaluateTargetHealth": true
            }
        }
    }]
}
EOF

    # Update www subdomain
    cat > /tmp/route53-alb-www.json << EOF
{
    "Changes": [{
        "Action": "UPSERT",
        "ResourceRecordSet": {
            "Name": "www.${DOMAIN}",
            "Type": "A",
            "AliasTarget": {
                "HostedZoneId": "${ALB_ZONE}",
                "DNSName": "${ALB_DNS}",
                "EvaluateTargetHealth": true
            }
        }
    }]
}
EOF

    # Update mr subdomain
    cat > /tmp/route53-alb-mr.json << EOF
{
    "Changes": [{
        "Action": "UPSERT",
        "ResourceRecordSet": {
            "Name": "mr.${DOMAIN}",
            "Type": "A",
            "AliasTarget": {
                "HostedZoneId": "${ALB_ZONE}",
                "DNSName": "${ALB_DNS}",
                "EvaluateTargetHealth": true
            }
        }
    }]
}
EOF

    # Apply changes
    echo "Updating A record for ${DOMAIN} to point to ALB..."
    aws route53 change-resource-record-sets --hosted-zone-id $ZONE_ID --change-batch file:///tmp/route53-alb-root.json

    echo "Updating A record for www.${DOMAIN} to point to ALB..."
    aws route53 change-resource-record-sets --hosted-zone-id $ZONE_ID --change-batch file:///tmp/route53-alb-www.json

    echo "Updating A record for mr.${DOMAIN} to point to ALB..."
    aws route53 change-resource-record-sets --hosted-zone-id $ZONE_ID --change-batch file:///tmp/route53-alb-mr.json

    echo -e "${GREEN}✓ Route53 records updated to point to ALB${NC}"
}

# 6. CHECK STATUS
check_status() {
    echo -e "${YELLOW}\n=== Status Check ===${NC}"

    # Check DNS resolution
    echo "DNS Resolution:"
    dig +short ${DOMAIN}
    dig +short www.${DOMAIN}
    dig +short mr.${DOMAIN}

    # Check certificate status
    if [ -f /tmp/sanctumtools-cert-arn.txt ]; then
        CERT_ARN=$(cat /tmp/sanctumtools-cert-arn.txt)
        CERT_STATUS=$(aws acm describe-certificate \
            --certificate-arn $CERT_ARN \
            --query 'Certificate.Status' \
            --output text)
        echo "Certificate Status: $CERT_STATUS"
    fi

    # Check target health
    if [ -f /tmp/sanctumtools-alb-arn.txt ]; then
        TARGET_GROUP_ARN=$(aws elbv2 describe-target-groups \
            --names ${TARGET_GROUP_NAME} \
            --query 'TargetGroups[0].TargetGroupArn' \
            --output text)

        echo "Target Health:"
        aws elbv2 describe-target-health \
            --target-group-arn $TARGET_GROUP_ARN \
            --query 'TargetHealthDescriptions[*].[Target.Id,TargetHealth.State]' \
            --output table
    fi

    # Check ALB DNS
    if [ -f /tmp/sanctumtools-alb-dns.txt ]; then
        ALB_DNS=$(cat /tmp/sanctumtools-alb-dns.txt)
        echo "ALB DNS: $ALB_DNS"
    fi

    echo -e "${GREEN}\n=== Cost Estimate ===${NC}"
    echo "Route53 Hosted Zone:  $0.50/month"
    echo "Route53 Queries:      ~$0.40/month"
    echo "ACM Certificate:      $0.00 (free)"
    echo "Application LB:       $16.20/month"
    echo "Data Processing:      ~$3.60/month"
    echo "--------------------------------"
    echo "Total:                ~$20.70/month"
}

# Main menu
main_menu() {
    echo -e "${GREEN}\n=== AWS Infrastructure Setup Menu ===${NC}"
    echo "1. Check Prerequisites"
    echo "2. Create Route53 DNS Records (Point to EC2 IP)"
    echo "3. Request ACM SSL Certificate"
    echo "4. Create Application Load Balancer"
    echo "5. Update EC2 Security Group"
    echo "6. Update Route53 to point to ALB"
    echo "7. Check Status"
    echo "8. Run All Steps"
    echo "0. Exit"
    echo ""
    read -p "Select option: " choice

    case $choice in
        1)
            check_aws_cli
            check_aws_credentials
            ;;
        2)
            create_route53_records
            ;;
        3)
            request_acm_certificate
            ;;
        4)
            create_alb
            ;;
        5)
            update_ec2_security_group
            ;;
        6)
            update_route53_to_alb
            ;;
        7)
            check_status
            ;;
        8)
            check_aws_cli
            check_aws_credentials
            create_route53_records
            request_acm_certificate
            echo "Waiting for certificate validation (this may take 5-10 minutes)..."
            sleep 60
            create_alb
            update_ec2_security_group
            update_route53_to_alb
            check_status
            ;;
        0)
            echo "Exiting..."
            exit 0
            ;;
        *)
            echo -e "${RED}Invalid option${NC}"
            ;;
    esac

    main_menu
}

# Run main menu
main_menu