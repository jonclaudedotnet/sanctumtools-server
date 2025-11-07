# AWS Cost Optimization Guide for SanctumTools

## Current Infrastructure Cost Breakdown

### Monthly Cost Estimate: ~$20.70
| Service | Component | Cost/Month | Notes |
|---------|-----------|------------|-------|
| Route53 | Hosted Zone | $0.50 | Per zone |
| Route53 | DNS Queries | $0.40 | ~1M queries |
| ACM | SSL Certificate | $0.00 | Free for AWS resources |
| ALB | Load Balancer Hours | $16.20 | 720 hours × $0.0225 |
| ALB | LCU Usage | $3.60 | Data processing estimate |
| **Total** | | **$20.70** | |

### Annual Cost: ~$248.40

## Cost Optimization Strategies

### Option 1: CloudFront CDN (Recommended for Global Users)
**Potential Savings: $8-10/month**

```yaml
Architecture:
  CloudFront → ALB → EC2
  or
  CloudFront → S3 (static) + API Gateway (dynamic)

Benefits:
  - Better global performance
  - Built-in DDoS protection
  - Reduced ALB data transfer costs
  - Cache static content

Monthly Cost:
  - CloudFront: $8-12/month (includes data transfer)
  - Can eliminate ALB for static content
  - Total: ~$12-15/month

Implementation:
  1. Create CloudFront distribution
  2. Set ALB as origin
  3. Configure caching behaviors
  4. Update Route53 to point to CloudFront
```

### Option 2: Elastic IP with Nginx
**Potential Savings: $15-16/month**

```yaml
Architecture:
  Route53 → Elastic IP → EC2 (Nginx + Node.js)

Benefits:
  - Lowest cost option
  - Simple architecture
  - Direct control

Monthly Cost:
  - Elastic IP: $0.00 (if attached)
  - Route53: $0.90
  - Total: ~$0.90/month

Drawbacks:
  - No automatic failover
  - Manual SSL certificate renewal
  - Single point of failure

Implementation:
  1. Install Nginx on EC2
  2. Configure SSL with Let's Encrypt
  3. Proxy to Node.js on port 3000
  4. Assign Elastic IP
  5. Update Route53
```

### Option 3: Application Load Balancer with Scheduled Scaling
**Potential Savings: $5-8/month**

```bash
# Scale down ALB during off-hours (nights/weekends)
# Using AWS Lambda to stop/start ALB based on schedule

# Stop ALB at night (11 PM)
aws elbv2 modify-load-balancer-attributes \
  --load-balancer-arn YOUR_ALB_ARN \
  --attributes Key=deletion_protection.enabled,Value=false

# Start ALB in morning (7 AM)
# Note: This requires recreating ALB, not ideal
```

### Option 4: Fargate Spot Instances
**For containerized applications**

```yaml
Architecture:
  ALB → Fargate Spot → Container

Monthly Cost:
  - Fargate Spot: $5-10/month (70% discount)
  - ALB: $16.20
  - Total: ~$21-26/month

Benefits:
  - Auto-scaling
  - No server management
  - Cost-effective for variable loads
```

## Immediate Cost Reduction Actions

### 1. Optimize Route53 Queries
```bash
# Increase TTL to reduce queries
aws route53 change-resource-record-sets \
  --hosted-zone-id YOUR_ZONE_ID \
  --change-batch '{
    "Changes": [{
      "Action": "UPSERT",
      "ResourceRecordSet": {
        "Name": "sanctumtools.com",
        "Type": "A",
        "TTL": 3600
      }
    }]
  }'
```

### 2. Enable ALB Request Compression
```bash
# Reduce data transfer costs
aws elbv2 modify-target-group-attributes \
  --target-group-arn YOUR_TG_ARN \
  --attributes Key=deregistration_delay.timeout_seconds,Value=30
```

### 3. Implement Caching Headers
```javascript
// In your Node.js application
app.use((req, res, next) => {
  // Cache static assets for 1 year
  if (req.url.match(/\.(css|js|jpg|png|gif|ico|woff|woff2)$/)) {
    res.setHeader('Cache-Control', 'public, max-age=31536000');
  }
  next();
});
```

## AWS Free Tier Optimization

### Services Always Free
- ACM SSL Certificates
- CloudWatch Basic Monitoring
- AWS Health Dashboard

### Free Tier Limits (First 12 Months)
- EC2: 750 hours t2.micro
- EBS: 30GB storage
- Data Transfer: 15GB out

### Cost Alerts Setup
```bash
# Create billing alert
aws cloudwatch put-metric-alarm \
  --alarm-name sanctumtools-billing-alarm \
  --alarm-description "Alert when bill exceeds $25" \
  --metric-name EstimatedCharges \
  --namespace AWS/Billing \
  --statistic Maximum \
  --period 86400 \
  --threshold 25 \
  --comparison-operator GreaterThanThreshold \
  --dimensions Name=Currency,Value=USD
```

## Reserved Capacity Options

### 1. Savings Plans
- **Compute Savings Plan**: Up to 66% discount
- **EC2 Instance Savings Plan**: Up to 72% discount
- Commitment: 1 or 3 years

### 2. Reserved Instances
- For predictable workloads
- Up to 75% discount
- Can be sold if not needed

## Cost Monitoring Dashboard

### Create Cost Explorer Budget
```bash
aws budgets create-budget \
  --account-id YOUR_ACCOUNT_ID \
  --budget file://budget.json

# budget.json
{
  "BudgetName": "sanctumtools-monthly",
  "BudgetLimit": {
    "Amount": "25.0",
    "Unit": "USD"
  },
  "TimeUnit": "MONTHLY",
  "BudgetType": "COST"
}
```

### CloudWatch Cost Metrics
```bash
# Get daily costs
aws ce get-cost-and-usage \
  --time-period Start=2025-11-01,End=2025-11-30 \
  --granularity DAILY \
  --metrics "UnblendedCost" \
  --group-by Type=DIMENSION,Key=SERVICE
```

## Recommended Architecture by Budget

### Ultra-Low Budget (<$5/month)
```
Route53 → Elastic IP → EC2 (Nginx + SSL + Node.js)
- Use Let's Encrypt for SSL
- Manual management required
- Best for: Development/Testing
```

### Low Budget ($10-15/month)
```
Route53 → CloudFront → EC2
- CloudFront for SSL and caching
- Good global performance
- Best for: Small production sites
```

### Standard Budget ($20-30/month)
```
Route53 → ALB → EC2
- Current setup
- Auto-scaling ready
- Best for: Growing applications
```

### Enterprise Budget ($50+/month)
```
Route53 → CloudFront → ALB → Auto Scaling Group
- High availability
- Global performance
- Best for: Mission-critical applications
```

## Implementation Priority

1. **Immediate (No Cost)**
   - Increase DNS TTL values
   - Add caching headers
   - Enable gzip compression

2. **Short-term (Low Effort)**
   - Set up billing alerts
   - Configure cost budgets
   - Review and remove unused resources

3. **Medium-term (Planning Required)**
   - Evaluate CloudFront implementation
   - Consider Elastic IP + Nginx
   - Implement auto-scaling

4. **Long-term (Strategic)**
   - Evaluate containerization (ECS/Fargate)
   - Consider serverless (Lambda + API Gateway)
   - Implement multi-region for HA

## Cost Tracking Spreadsheet Template

```csv
Month,Route53,ACM,ALB,Data Transfer,EC2,Total,Notes
Nov-2024,0.90,0.00,16.20,3.60,0.00,20.70,Initial setup
Dec-2024,0.90,0.00,16.20,4.20,0.00,21.30,Holiday traffic
Jan-2025,0.90,0.00,8.10,2.10,0.00,11.10,CloudFront added
```

## Scripts for Cost Management

### Monthly Cost Report Script
```bash
#!/bin/bash
# save as: get-monthly-costs.sh

CURRENT_MONTH=$(date +%Y-%m)
START_DATE="${CURRENT_MONTH}-01"
END_DATE=$(date -d "${START_DATE} +1 month" +%Y-%m-%d)

echo "=== AWS Cost Report for ${CURRENT_MONTH} ==="

aws ce get-cost-and-usage \
  --time-period Start=${START_DATE},End=${END_DATE} \
  --granularity MONTHLY \
  --metrics "UnblendedCost" \
  --group-by Type=DIMENSION,Key=SERVICE \
  --output table
```

### Resource Cleanup Script
```bash
#!/bin/bash
# save as: cleanup-unused.sh

echo "=== Checking for unused resources ==="

# Check for unattached EBS volumes
echo "Unattached EBS Volumes:"
aws ec2 describe-volumes \
  --filters "Name=status,Values=available" \
  --query 'Volumes[*].[VolumeId,Size,CreateTime]' \
  --output table

# Check for unused Elastic IPs
echo "Unused Elastic IPs:"
aws ec2 describe-addresses \
  --query 'Addresses[?AssociationId==`null`].[PublicIp,AllocationId]' \
  --output table

# Check for old snapshots
echo "Snapshots older than 30 days:"
THIRTY_DAYS_AGO=$(date -d '30 days ago' +%Y-%m-%d)
aws ec2 describe-snapshots \
  --owner-ids self \
  --query "Snapshots[?StartTime<='${THIRTY_DAYS_AGO}'].[SnapshotId,StartTime,VolumeSize]" \
  --output table
```

## Final Recommendations

### For SanctumTools Specifically:
Given that this is a mental health application with potentially sensitive data:

1. **Keep the ALB** for now - security and reliability are worth the cost
2. **Add CloudFront** when user base grows globally
3. **Implement caching** aggressively for static content
4. **Monitor actual usage** for 1-2 months before optimizing
5. **Set up billing alerts** at $25 and $50 thresholds

### Next Steps:
1. ✅ Run the current setup for 1 month
2. 📊 Analyze actual traffic patterns
3. 💰 Review AWS Cost Explorer data
4. 🔄 Implement optimizations based on real usage
5. 📈 Scale architecture as needed