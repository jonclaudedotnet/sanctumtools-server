# SanctumTools Troubleshooting Guide

This document details the errors encountered during the password reset deployment and their solutions.

---

## Error 1: 404 on /forgotpassword Endpoint

### Symptoms
```
Failed to load resource: the server responded with a status of 404 (Not Found)
URL: https://my.sanctumtools.com/forgot-password
```

### Root Causes
1. **Primary**: Email service misconfigured with invalid SMTP credentials
2. **Secondary**: Backend code not deployed or not running
3. **Tertiary**: ALB not routing traffic correctly

### Diagnosis
```bash
# Check if endpoint exists in code
grep -r "forgot-password" /home/jonclaude/Agents/Virgo/sanctumtools-backend/

# Check if service is running
sudo systemctl status sanctumtools

# Check if port 3000 is listening
sudo ss -tlnp | grep 3000

# Test endpoint locally
curl -X POST http://localhost:3000/api/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'

# Check ALB target health
aws elbv2 describe-target-health \
  --target-group-arn arn:aws:elasticloadbalancing:us-east-1:452774097660:targetgroup/sanctumtools-targets/a4a83c57c29d4b0b \
  --region us-east-1
```

### Solution

**Step 1**: Verify backend code is deployed
```bash
ls -la /opt/sanctumtools-server/src/server.js
```

**Step 2**: Check email service configuration
```bash
cat /opt/sanctumtools-server/lib/emailService.js
```
Should use AWS SES SDK, not SMTP.

**Step 3**: Verify .env has correct AWS credentials
```bash
cat /opt/sanctumtools-server/.env
```

**Step 4**: Restart service if needed
```bash
sudo systemctl restart sanctumtools
sudo systemctl status sanctumtools
```

**Step 5**: Check logs for errors
```bash
sudo journalctl -u sanctumtools -n 50 -e
```

---

## Error 2: SMTP Credentials Invalid

### Symptoms
```
Error: connect ECONNREFUSED when attempting to send password reset email
SMTP error: "Invalid credentials" or "Authentication failed"
```

### Root Cause
`emailService.js` was configured to use Nodemailer SMTP with placeholder credentials:
```javascript
// OLD (BROKEN)
transport: nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'your-mailtrap-host',
  port: process.env.SMTP_PORT || 587,
  auth: {
    user: process.env.SMTP_USER || 'your-mailtrap-username',
    pass: process.env.SMTP_PASS || 'your-mailtrap-password'
  }
})
```

### Solution

**Rewrite emailService.js to use AWS SES SDK**:

```javascript
const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');

const sesClient = new SESClient({
  region: process.env.AWS_REGION || 'us-east-1'
});

const sendEmail = async (params) => {
  try {
    const command = new SendEmailCommand(params);
    const response = await sesClient.send(command);
    return {
      success: true,
      messageId: response.MessageId,
      message: 'Email sent successfully'
    };
  } catch (error) {
    console.error('SES send failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

module.exports = { sendEmail };
```

**Update .env with AWS credentials**:
```env
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=<your-access-key>
AWS_SECRET_ACCESS_KEY=<your-secret-key>
SMTP_FROM=support@sanctumtools.com
```

**Install AWS SDK if needed**:
```bash
npm install @aws-sdk/client-ses
```

**Verify SES sender is verified**:
```bash
aws ses list-verified-email-addresses --region us-east-1
aws ses list-identities --identities support@sanctumtools.com --region us-east-1
```

---

## Error 3: Cannot SSH to EC2 Instance

### Symptoms
```
Permission denied (publickey)
No matching host key type found
ssh: connect to host 3.85.53.217 port 22: Operation timed out
```

### Root Causes
1. **No SSH key configured**: EC2 instance launched without key pair
2. **Wrong key**: Using incorrect `.pem` file
3. **Wrong permissions**: Key file has wrong permissions (should be 400)
4. **Security group blocked**: Port 22 not allowed in security group

### Diagnosis
```bash
# List available keys
ls -la ~/.ssh/

# Check if instance has key
aws ec2 describe-instances --instance-ids i-0c841e020508e7227 \
  --region us-east-1 \
  --query 'Reservations[0].Instances[0].KeyName'

# Check security group allows SSH
aws ec2 describe-security-groups \
  --group-ids sg-04ce25cf2c5e7a1cd \
  --region us-east-1 \
  --query 'SecurityGroups[0].IpPermissions'
```

### Solution

**Step 1**: Create new key pair
```bash
aws ec2 create-key-pair \
  --key-name sanctumtools-new \
  --region us-east-1 \
  --query 'KeyMaterial' \
  --output text > ~/sanctumtools-new.pem

chmod 400 ~/sanctumtools-new.pem
```

**Step 2**: Launch instance with correct key
```bash
aws ec2 run-instances \
  --image-id ami-0c3e8df62015275ea \
  --instance-type t3.small \
  --key-name sanctumtools-new \
  --security-group-ids sg-04ce25cf2c5e7a1cd \
  --region us-east-1
```

**Step 3**: Verify security group allows SSH
```bash
aws ec2 authorize-security-group-ingress \
  --group-id sg-04ce25cf2c5e7a1cd \
  --protocol tcp \
  --port 22 \
  --cidr 0.0.0.0/0 \
  --region us-east-1
```

**Step 4**: Test SSH
```bash
ssh -i ~/sanctumtools-new.pem ec2-user@<instance-ip>
```

---

## Error 4: glibc Version Too Old (Amazon Linux 2)

### Symptoms
```
GLIBC_2.28 not found in /lib64/libc.so.6
Node.js 18 requires glibc 2.28 or higher
Cannot install Node.js 18 on Amazon Linux 2
```

### Root Cause
First deployment used Amazon Linux 2 AMI (`ami-0c02fb55956c7d316`) which has:
- glibc 2.26 (too old for Node 18)
- Would require glibc 2.28+

### Diagnosis
```bash
# Check system glibc version
ldd --version | head -1

# Check Node 18 requirements
node --version 2>&1 | grep "GLIBC"
```

### Solution

**Switch to Amazon Linux 2023 AMI** which includes glibc 2.33+:

```bash
# Amazon Linux 2023 AMI ID
ami-0c3e8df62015275ea

# Launch instance with correct AMI
aws ec2 run-instances \
  --image-id ami-0c3e8df62015275ea \
  --instance-type t3.small \
  --key-name sanctumtools-new \
  --security-group-ids sg-04ce25cf2c5e7a1cd \
  --region us-east-1
```

**Verify glibc on new instance**:
```bash
ssh -i ~/sanctumtools-new.pem ec2-user@<ip>
ldd --version | head -1  # Should show 2.33 or higher
```

---

## Error 5: ALB Target Unhealthy - Availability Zone Mismatch

### Symptoms
```
Target is in an Availability Zone that is not enabled for the load balancer
TargetHealth.State = "unavailable"
TargetHealth.ReasonCode = "Elb.RegistrationInProgress" or "Target.InvalidState"
```

### Root Cause
EC2 instance launched in `us-east-1d` but ALB only configured for:
- us-east-1a
- us-east-1b

Subnets:
- us-east-1a: subnet-0c2b8f8d (not added to ALB)
- us-east-1b: subnet-0c2b8f8d (not added to ALB)
- us-east-1d: subnet-3020f37d (added to ALB)

### Diagnosis
```bash
# Check ALB availability zones
aws elbv2 describe-load-balancers \
  --load-balancer-arns arn:aws:elasticloadbalancing:us-east-1:452774097660:loadbalancer/app/sanctumtools-alb/... \
  --region us-east-1

# Check instance AZ
aws ec2 describe-instances \
  --instance-ids i-07a5392c9925c32d8 \
  --region us-east-1 \
  --query 'Reservations[0].Instances[0].Placement.AvailabilityZone'

# Check ALB subnets
aws elbv2 describe-load-balancers \
  --query 'LoadBalancers[0].AvailabilityZones[*].SubnetId'
```

### Solution

**Add missing subnet to ALB**:
```bash
# Get current subnet list
CURRENT_SUBNETS=$(aws elbv2 describe-load-balancers \
  --load-balancer-arns arn:aws:elasticloadbalancing:us-east-1:452774097660:loadbalancer/app/sanctumtools-alb/... \
  --region us-east-1 \
  --query 'LoadBalancers[0].AvailabilityZones[*].SubnetId' \
  --output text)

# Add new subnet (subnet-3020f37d for us-east-1d)
aws elbv2 set-subnets \
  --load-balancer-arn arn:aws:elasticloadbalancing:us-east-1:452774097660:loadbalancer/app/sanctumtools-alb/... \
  --subnets $CURRENT_SUBNETS subnet-3020f37d \
  --region us-east-1
```

**Verify ALB now has the subnet**:
```bash
aws elbv2 describe-load-balancers \
  --query 'LoadBalancers[0].AvailabilityZones'
```

---

## Error 6: Security Group Blocks Port 3000

### Symptoms
```
ALB health check times out
Cannot access port 3000 from ALB
curl: (7) Failed to connect to 3.93.46.170 port 3000
```

### Root Cause
Security group didn't have inbound rule for port 3000 from ALB.

### Solution

**Add inbound rule for port 3000**:
```bash
aws ec2 authorize-security-group-ingress \
  --group-id sg-04ce25cf2c5e7a1cd \
  --protocol tcp \
  --port 3000 \
  --source-group sg-04ce25cf2c5e7a1cd \
  --region us-east-1
```

Or allow from ALB security group:
```bash
# Get ALB security group
ALB_SG=$(aws elbv2 describe-load-balancers \
  --query 'LoadBalancers[0].SecurityGroups[0]' \
  --output text)

# Add rule
aws ec2 authorize-security-group-ingress \
  --group-id sg-04ce25cf2c5e7a1cd \
  --protocol tcp \
  --port 3000 \
  --source-group $ALB_SG \
  --region us-east-1
```

---

## Error 7: Git Not Installed on EC2

### Symptoms
```
git: command not found
Failed to clone repository
```

### Root Cause
User data script didn't install git before attempting clone.

### Solution

**Update user data script**:
```bash
# For Amazon Linux 2023
sudo dnf install -y git nodejs npm

# For Ubuntu/Debian
sudo apt-get update
sudo apt-get install -y git nodejs npm
```

**Or manually install on running instance**:
```bash
ssh -i ~/sanctumtools-new.pem ec2-user@<ip>
sudo dnf install -y git
```

---

## Error 8: Repository Structure Mismatch

### Symptoms
```
Error: Cannot find module 'server.js'
ENOENT: no such file or directory
```

### Root Cause
Repository has nested directory structure:
```
jc-gon-bring-it-to-ya/
  ├─ sanctumtools-server/
  │   ├─ README.md
  │   └─ (deployment docs)
  └─ sanctumtools-backend/
      ├─ package.json
      ├─ src/
      │   └─ server.js
      └─ lib/
          └─ emailService.js
```

When cloning to `/opt/sanctumtools-server/`, the actual code is in `sanctumtools-backend/`, not in `sanctumtools-server/`.

### Solution

**Identify correct codebase**:
```bash
# List contents
ls -la /home/jonclaude/Agents/Virgo/

# Find server.js
find /home/jonclaude/Agents/Virgo/ -name "server.js" -type f
# Output: /home/jonclaude/Agents/Virgo/sanctumtools-backend/src/server.js
```

**Deploy correct backend**:
```bash
ssh -i ~/sanctumtools-new.pem ec2-user@<ip>

# Clear and redeploy
cd /opt
sudo rm -rf sanctumtools-server
sudo cp -r /path/to/sanctumtools-backend sanctumtools-server
sudo chown -R ec2-user:ec2-user sanctumtools-server

# Or copy from local
scp -i ~/sanctumtools-new.pem -r ~/sanctumtools-backend/* ec2-user@<ip>:/opt/sanctumtools-server/
```

---

## Error 9: npm Install Fails - Corrupted Dependencies

### Symptoms
```
ENOTEMPTY: directory not empty, rmdir '/opt/sanctumtools-server/node_modules/yargs/locales'
npm ERR! code ENOTEMPTY
npm ERR! syscall rmdir
```

### Root Cause
Previous failed npm installs left corrupted or partially installed node_modules.

### Solution

**Clean and reinstall**:
```bash
cd /opt/sanctumtools-server

# Remove corrupted node_modules
rm -rf node_modules package-lock.json

# Install fresh
npm install --production

# Verify
node --version
npm --version
npm ls --depth=0
```

**If still fails, check disk space**:
```bash
df -h
# Ensure at least 500MB free

# Clear npm cache
npm cache clean --force

# Try install again
npm install --production
```

---

## Error 10: Service Won't Start

### Symptoms
```
systemctl status sanctumtools shows: failed
systemd[1]: sanctumtools.service: Main process exited, code=exited, status=1/FAILURE
```

### Root Causes
1. Node.js not installed
2. Port 3000 already in use
3. Missing dependencies
4. Incorrect file permissions

### Diagnosis
```bash
# Check service status with full output
sudo systemctl status sanctumtools -n 50

# Check logs
sudo journalctl -u sanctumtools -n 100 -e

# Try running manually to see error
cd /opt/sanctumtools-server
/usr/bin/node src/server.js

# Check if port is in use
sudo ss -tlnp | grep 3000
sudo lsof -i :3000

# Check Node.js is installed
node --version
npm --version
```

### Solution

**Verify prerequisites**:
```bash
# Install Node.js
sudo dnf install -y nodejs npm

# Check installation
node --version
npm --version
```

**Check port availability**:
```bash
# If port in use, kill process
sudo lsof -i :3000
sudo kill -9 <PID>

# Or change PORT in .env
PORT=3001
```

**Fix permissions**:
```bash
sudo chown -R ec2-user:ec2-user /opt/sanctumtools-server
sudo chmod -R 755 /opt/sanctumtools-server
sudo chmod 600 /opt/sanctumtools-server/.env
```

**Restart service**:
```bash
sudo systemctl daemon-reload
sudo systemctl restart sanctumtools
sudo systemctl status sanctumtools
```

---

## Error 11: ALB Health Check Returns 404

### Symptoms
```
ALB target shows: draining, unhealthy
Health check: status code: 404
```

### Root Cause
ALB health check configured to check path `/` but Express server returns 404 on root because there's no handler for `GET /`.

### Background
This is expected behavior. The application doesn't need a root endpoint. Health checks should use the actual API path.

### Solution

**Option A: Add root endpoint handler** (if desired)

In `src/server.js`:
```javascript
app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'sanctumtools', version: '1.0.0' });
});
```

Restart service:
```bash
sudo systemctl restart sanctumtools
```

**Option B: Update ALB health check path**

Change ALB health check to use real endpoint:
```bash
aws elbv2 modify-target-group \
  --target-group-arn arn:aws:elasticloadbalancing:us-east-1:452774097660:targetgroup/sanctumtools-targets/a4a83c57c29d4b0b \
  --health-check-path /api/forgot-password \
  --health-check-interval-seconds 30 \
  --health-check-timeout-seconds 5 \
  --healthy-threshold-count 2 \
  --unhealthy-threshold-count 3 \
  --region us-east-1
```

---

## Error 12: Cannot Send Email via SES

### Symptoms
```
Error: MessageRejected - Email address not verified
User with email example@test.com is not permitted to receive email
```

### Root Causes
1. Sender email not verified in AWS SES
2. Recipient email not verified in SES sandbox mode
3. AWS SES account in sandbox mode
4. Invalid IAM permissions

### Diagnosis
```bash
# Check verified identities
aws ses list-verified-email-addresses --region us-east-1

# Check sender domain
aws ses list-identities --region us-east-1

# Check if account is in sandbox
aws ses describe-configuration-set \
  --configuration-set-name default \
  --region us-east-1
```

### Solution

**Step 1: Verify sender email**
```bash
aws ses verify-email-identity \
  --email-address support@sanctumtools.com \
  --region us-east-1

# Check verification link in email, then verify it
```

**Step 2: If in sandbox mode, request production access**
```
In AWS Console:
1. Go to SES console
2. Click "Edit account details"
3. Request production access
4. Wait for approval (usually 24 hours)
```

**Step 3: If still in sandbox, add recipient email**
```bash
aws ses verify-email-identity \
  --email-address test@example.com \
  --region us-east-1
```

**Step 4: Verify IAM permissions**
```bash
# Ensure access key has SES permissions
aws ses list-verified-email-addresses --region us-east-1
```

---

## Common Debugging Commands

### Service Status
```bash
# Full status
sudo systemctl status sanctumtools

# Quick check
sudo systemctl is-active sanctumtools

# Enable auto-start
sudo systemctl enable sanctumtools
```

### Logs
```bash
# Real-time logs
sudo journalctl -u sanctumtools -f

# Last 50 lines
sudo journalctl -u sanctumtools -n 50

# Last hour
sudo journalctl -u sanctumtools --since "1 hour ago"

# Errors only
sudo journalctl -u sanctumtools -p err

# Export to file
sudo journalctl -u sanctumtools > /tmp/sanctumtools-logs.txt
```

### Network Testing
```bash
# Check port listening
sudo ss -tlnp | grep 3000

# Test endpoint locally
curl -v http://localhost:3000/api/forgot-password

# Test through ALB
curl -v https://my.sanctumtools.com/api/forgot-password

# Check DNS
nslookup my.sanctumtools.com
dig my.sanctumtools.com
```

### AWS Commands
```bash
# EC2 instance status
aws ec2 describe-instances --instance-ids i-07a5392c9925c32d8 --region us-east-1

# ALB target health
aws elbv2 describe-target-health \
  --target-group-arn arn:aws:elasticloadbalancing:us-east-1:452774097660:targetgroup/sanctumtools-targets/a4a83c57c29d4b0b \
  --region us-east-1

# Security group rules
aws ec2 describe-security-groups --group-ids sg-04ce25cf2c5e7a1cd --region us-east-1

# Recent CloudWatch logs
aws logs tail /aws/ec2/sanctumtools --follow --region us-east-1
```

### Performance Monitoring
```bash
# Memory usage
free -h

# CPU usage
top -p $(pgrep -f "node")

# Disk space
df -h

# Open files
lsof -p $(pgrep -f "node")
```

---

## Quick Recovery Checklist

If service is down:

- [ ] SSH to instance: `ssh -i ~/sanctumtools-new.pem ec2-user@3.93.46.170`
- [ ] Check service: `sudo systemctl status sanctumtools`
- [ ] Check logs: `sudo journalctl -u sanctumtools -n 100`
- [ ] Check port: `sudo ss -tlnp | grep 3000`
- [ ] Restart service: `sudo systemctl restart sanctumtools`
- [ ] Wait 30 seconds for ALB health check
- [ ] Verify: `curl https://my.sanctumtools.com/api/forgot-password`

---

## Support Resources

- **AWS SES Setup**: https://docs.aws.amazon.com/ses/
- **EC2 Instance Connect**: SSH troubleshooting guide in AWS docs
- **Systemd**: `man systemctl`, `man journalctl`
- **Node.js**: `node --help`, npm documentation

---

Last Updated: November 9, 2025
