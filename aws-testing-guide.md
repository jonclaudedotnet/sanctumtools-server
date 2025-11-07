# AWS Infrastructure Testing Guide for SanctumTools

## Quick Test Commands

### 1. DNS Resolution Tests
```bash
# Test DNS propagation (should return IP addresses)
nslookup sanctumtools.com
nslookup www.sanctumtools.com
nslookup mr.sanctumtools.com

# Alternative DNS test
dig sanctumtools.com +short
dig www.sanctumtools.com +short
dig mr.sanctumtools.com +short

# Test with specific DNS servers
nslookup sanctumtools.com 8.8.8.8
nslookup sanctumtools.com 1.1.1.1
```

### 2. Direct EC2 Access Test (Before ALB)
```bash
# Test direct EC2 access
curl -I http://13.218.249.157:3000
curl http://13.218.249.157:3000

# If DNS is set to EC2 IP
curl -I http://sanctumtools.com:3000
```

### 3. SSL Certificate Validation
```bash
# Check certificate status in AWS
aws acm describe-certificate \
  --certificate-arn arn:aws:acm:us-east-1:YOUR_ACCOUNT:certificate/YOUR_CERT_ID \
  --query 'Certificate.Status' \
  --output text

# Test SSL connection (after ALB is set up)
openssl s_client -connect sanctumtools.com:443 -servername sanctumtools.com < /dev/null

# Check certificate details
curl -vI https://sanctumtools.com 2>&1 | grep -E "SSL|subject|issuer"
```

### 4. ALB Health Checks
```bash
# Check target health
aws elbv2 describe-target-health \
  --target-group-arn arn:aws:elasticloadbalancing:us-east-1:YOUR_ACCOUNT:targetgroup/sanctumtools-targets/XXXXX \
  --query 'TargetHealthDescriptions[*].[Target.Id,TargetHealth.State,TargetHealth.Description]' \
  --output table

# Get ALB DNS name
aws elbv2 describe-load-balancers \
  --names sanctumtools-alb \
  --query 'LoadBalancers[0].DNSName' \
  --output text
```

### 5. HTTP to HTTPS Redirect Test
```bash
# Should return 301 redirect to HTTPS
curl -I http://sanctumtools.com
curl -I http://www.sanctumtools.com

# Follow redirects
curl -L http://sanctumtools.com
```

### 6. Full Application Tests
```bash
# Test root domain
curl -I https://sanctumtools.com
curl https://sanctumtools.com

# Test www subdomain
curl -I https://www.sanctumtools.com
curl https://www.sanctumtools.com

# Test mr subdomain
curl -I https://mr.sanctumtools.com
curl https://mr.sanctumtools.com

# Test with verbose output
curl -v https://sanctumtools.com
```

### 7. Performance Tests
```bash
# Basic load test
for i in {1..10}; do curl -s -o /dev/null -w "%{http_code} %{time_total}s\n" https://sanctumtools.com; done

# Check response time
curl -o /dev/null -s -w "Time: %{time_total}s\n" https://sanctumtools.com

# DNS lookup time
curl -o /dev/null -s -w "DNS: %{time_namelookup}s\nConnect: %{time_connect}s\nSSL: %{time_appconnect}s\nTotal: %{time_total}s\n" https://sanctumtools.com
```

### 8. Browser Testing
```
1. Open browser and navigate to:
   - http://sanctumtools.com (should redirect to HTTPS)
   - https://sanctumtools.com
   - https://www.sanctumtools.com
   - https://mr.sanctumtools.com

2. Check for:
   - Valid SSL certificate (padlock icon)
   - No security warnings
   - Correct application loading
   - Fast response times
```

## Troubleshooting Commands

### DNS Issues
```bash
# Clear DNS cache (Linux)
sudo systemd-resolve --flush-caches

# Check DNS propagation globally
# Visit: https://www.whatsmydns.net/#A/sanctumtools.com
```

### Certificate Issues
```bash
# List all certificates
aws acm list-certificates --region us-east-1

# Get certificate details
aws acm describe-certificate \
  --certificate-arn YOUR_CERT_ARN \
  --region us-east-1
```

### ALB Issues
```bash
# Check ALB listeners
aws elbv2 describe-listeners \
  --load-balancer-arn YOUR_ALB_ARN

# Check ALB rules
aws elbv2 describe-rules \
  --listener-arn YOUR_LISTENER_ARN

# Check security groups
aws ec2 describe-security-groups \
  --group-ids YOUR_SG_ID
```

### EC2 Instance Issues
```bash
# Check instance status
aws ec2 describe-instance-status \
  --instance-ids i-0c841e020508e7227

# Check security group rules
aws ec2 describe-security-groups \
  --filters "Name=group-id,Values=YOUR_EC2_SG"

# SSH to instance (if needed)
ssh -i your-key.pem ec2-user@13.218.249.157
```

## Expected Results

### ✅ Successful Setup Indicators
1. DNS resolves to ALB (not EC2 IP directly)
2. HTTP automatically redirects to HTTPS
3. SSL certificate shows as valid in browser
4. All domains load the application
5. Target health shows as "healthy"
6. Response times under 1 second

### ❌ Common Issues and Solutions

| Issue | Solution |
|-------|----------|
| DNS not resolving | Wait 5-10 minutes for propagation |
| Certificate pending | Check CNAME validation records |
| Target unhealthy | Check security groups and application |
| 504 Gateway Timeout | Increase target group health check timeout |
| Connection refused | Check EC2 instance and port 3000 |
| SSL error | Verify certificate is attached to listener |

## Monitoring Commands

### CloudWatch Metrics
```bash
# Get ALB metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/ApplicationELB \
  --metric-name RequestCount \
  --dimensions Name=LoadBalancer,Value=app/sanctumtools-alb/XXXXX \
  --statistics Sum \
  --start-time 2025-11-07T00:00:00Z \
  --end-time 2025-11-07T23:59:59Z \
  --period 3600

# Check for errors
aws cloudwatch get-metric-statistics \
  --namespace AWS/ApplicationELB \
  --metric-name HTTPCode_Target_5XX_Count \
  --dimensions Name=LoadBalancer,Value=app/sanctumtools-alb/XXXXX \
  --statistics Sum \
  --start-time 2025-11-07T00:00:00Z \
  --end-time 2025-11-07T23:59:59Z \
  --period 3600
```

## Quick Status Check Script
```bash
#!/bin/bash
echo "=== SanctumTools Infrastructure Status ==="
echo ""
echo "DNS Resolution:"
dig sanctumtools.com +short
echo ""
echo "HTTPS Status:"
curl -Is https://sanctumtools.com | head -n 1
echo ""
echo "SSL Certificate:"
echo | openssl s_client -connect sanctumtools.com:443 2>/dev/null | openssl x509 -noout -dates
echo ""
echo "Response Time:"
curl -o /dev/null -s -w "Total time: %{time_total}s\n" https://sanctumtools.com
```

Save this as `check-status.sh` and run with `bash check-status.sh`