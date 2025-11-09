# SanctumTools Password Reset - Architecture & Design

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                      End User (Browser)                          │
│                  https://my.sanctumtools.com                     │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            │ HTTPS
                            │
        ┌───────────────────▼──────────────────┐
        │   AWS Route 53 (DNS Resolution)      │
        │   my.sanctumtools.com → ALB IP       │
        └───────────────────┬──────────────────┘
                            │
        ┌───────────────────▼──────────────────┐
        │   Application Load Balancer (ALB)    │
        │   - Port: 443 (HTTPS)                │
        │   - Certificate: ACM (sanctumtools)  │
        │   - Target: sanctumtools-targets     │
        └───────────────────┬──────────────────┘
                            │
                ┌───────────┴────────────┐
                │                        │
    Port 3000   │            Port 3000   │
    ┌───────────▼──────┐   ┌────────────▼──────┐
    │  EC2 Instance 1  │   │  EC2 Instance 2   │
    │  i-0c841e0205..  │   │  (Standby/Backup) │
    │  3.85.53.217     │   │                   │
    │  ❌ Offline      │   │  (not deployed)   │
    └──────────────────┘   └───────────────────┘
                │
    ┌───────────▼──────────────────┐
    │   Current Instance (ACTIVE)  │
    │   EC2: i-07a5392c9925c32d8   │
    │   IP: 3.93.46.170            │
    │   Region: us-east-1d         │
    │                              │
    │   Node.js 18.20.8            │
    │   Express.js                 │
    │   Systemd Service            │
    │   Port: 3000                 │
    └───────────────┬──────────────┘
                    │
        ┌───────────┼────────────┬────────────┐
        │           │            │            │
        │           │            │            │
        ▼           ▼            ▼            ▼
    ┌───────┐ ┌─────────┐ ┌──────────┐ ┌────────┐
    │ DDB   │ │ DDB     │ │ AWS SES  │ │CloudWatch
    │users  │ │password │ │(Email)   │ │(Logs)
    │table  │ │-reset   │ │          │ │
    │       │ │-tokens  │ │          │ │
    └───────┘ └─────────┘ └──────────┘ └────────┘
```

---

## Components

### 1. Frontend (sanctumtools-frontend)

**Technology**: React.js

**Key Files**:
- `/forgot-password` - Forgot password page
- Auth components - User authentication UI
- Onboarding components - New user setup

**Responsibilities**:
- Display forgot password form
- Collect user email address
- Submit to backend API
- Handle reset token from email link
- Display password change form
- Submit new password to backend

**API Calls**:
```
POST /api/forgot-password
  Body: { email: "user@example.com" }
  Response: { success: true, message: "Check your email" }

POST /api/reset-password
  Body: { token: "...", newPassword: "..." }
  Response: { success: true, message: "Password updated" }
```

### 2. Backend (sanctumtools-backend)

**Technology**: Node.js 18 + Express.js

**Entry Point**: `src/server.js`

**Key Files**:
- `src/server.js` - Express application setup
- `src/routes/auth.js` - Authentication endpoints
- `lib/emailService.js` - Email delivery via AWS SES
- `lib/passwordReset.js` - Token generation and validation
- `.env` - Configuration

**Runtime**: Systemd service on EC2 instance

**Environment**:
```
PORT=3000
NODE_ENV=production
SESSION_SECRET=<secure-random-string>
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=<IAM-key>
AWS_SECRET_ACCESS_KEY=<IAM-secret>
SMTP_FROM=support@sanctumtools.com
BASE_URL=https://my.sanctumtools.com
```

**Key Routes**:
```
POST /api/forgot-password
  - Receives user email
  - Validates user exists in DynamoDB
  - Generates reset token
  - Stores token with TTL
  - Sends email via AWS SES
  - Returns success message

POST /api/reset-password
  - Receives token and new password
  - Validates token is valid and not expired
  - Hashes new password with bcrypt
  - Updates user record in DynamoDB
  - Deletes reset token
  - Returns success message

GET /api/validate-reset-token
  - Receives token
  - Validates token exists and not expired
  - Returns user email and token validity
```

### 3. AWS DynamoDB

**Database**: NoSQL document store

**Tables**:

#### Table 1: `users`
```
Primary Key: email (String)
Attributes:
  - email (String) - Partition key
  - passwordHash (String) - bcrypt hash
  - createdAt (Number) - Unix timestamp
  - updatedAt (Number) - Unix timestamp
  - verified (Boolean) - Email verified
  - profile (Object) - User profile data
    - firstName
    - lastName
    - phone
    - etc.
GSI: none (email used as primary key)
```

#### Table 2: `password-reset-tokens`
```
Primary Key: tokenHash (String)
Attributes:
  - tokenHash (String) - Partition key (SHA256 hash of token)
  - email (String) - User email
  - expiresAt (Number) - Unix timestamp
  - createdAt (Number) - Token creation time
TTL: expiresAt (3600 seconds = 1 hour)
GSI: email-index (for looking up user's reset tokens)
```

**Data Flow**:
1. User initiates password reset
2. Backend generates UUID token
3. Token is hashed (SHA256) and stored with user email
4. Original token sent in email (not stored)
5. When user clicks link, token hashed again and verified against stored hash
6. Token auto-deletes after 1 hour via DynamoDB TTL

**Security Benefits**:
- Original token never stored (can't be extracted from database)
- Hash of token stored instead (one-way cryptographic protection)
- Auto-expiration prevents indefinite reset link validity

### 4. AWS SES (Simple Email Service)

**Email Delivery**: AWS native email service

**Configuration**:
- Verified Sender: `support@sanctumtools.com`
- Verified Domain: `sanctumtools.com`
- Region: us-east-1

**Email Template**:
```
To: <user-email>
From: support@sanctumtools.com
Subject: Password Reset Request

Body:
Hello [User],

You requested a password reset. Click the link below to set a new password:

https://my.sanctumtools.com/reset-password?token=<UUID>

This link expires in 1 hour.

If you didn't request this, ignore this email.

SanctumTools Team
```

**Integration**:
```javascript
const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');

const sesClient = new SESClient({ region: 'us-east-1' });

const sendEmail = async (params) => {
  const command = new SendEmailCommand(params);
  return await sesClient.send(command);
};
```

**Credentials**:
- Uses IAM access key / secret key from .env
- Requires SES:SendEmail and SES:SendRawEmail permissions

### 5. Application Load Balancer (ALB)

**Purpose**: Route HTTPS traffic from domain to EC2 backend

**Configuration**:
- **DNS**: my.sanctumtools.com (AWS Route 53)
- **Protocol**: HTTPS on port 443
- **Certificate**: AWS ACM (sanctumtools.com)
- **Target Group**: sanctumtools-targets
  - Protocol: HTTP
  - Port: 3000
  - Health Check: /api/forgot-password every 30 seconds
  - Healthy threshold: 2 successful checks
  - Unhealthy threshold: 3 failed checks

**Availability Zones**:
- us-east-1a
- us-east-1b
- us-east-1d

**Security Group**: sg-04ce25cf2c5e7a1cd
- Inbound:
  - Port 443 (HTTPS) from 0.0.0.0/0
  - Port 22 (SSH) from authorized IPs
- Outbound:
  - All traffic allowed

**Target Registration**:
```bash
aws elbv2 register-targets \
  --target-group-arn arn:aws:elasticloadbalancing:us-east-1:452774097660:targetgroup/sanctumtools-targets/a4a83c57c29d4b0b \
  --targets Id=i-07a5392c9925c32d8,Port=3000 \
  --region us-east-1
```

### 6. EC2 Instance

**Instance Details**:
- Instance ID: i-07a5392c9925c32d8
- Instance Type: t3.small (1 vCPU, 2GB RAM)
- AMI: Amazon Linux 2023 (ami-0c3e8df62015275ea)
- Region: us-east-1d
- Public IP: 3.93.46.170
- Key Pair: sanctumtools-new
- Root Volume: 20GB GP2 SSD

**Software Stack**:
- OS: Amazon Linux 2023 (glibc 2.33+)
- Node.js: 18.20.8
- npm: 10.2.4
- Git: Installed
- Systemd: Service manager

**Systemd Service** (`/etc/systemd/system/sanctumtools.service`):
```ini
[Unit]
Description=SanctumTools Server
After=network.target

[Service]
Type=simple
User=ec2-user
WorkingDirectory=/opt/sanctumtools-server
EnvironmentFile=/opt/sanctumtools-server/.env
ExecStart=/usr/bin/node src/server.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

**File Permissions**:
- App dir: `/opt/sanctumtools-server`
- Owner: ec2-user:ec2-user
- Mode: 755 (rwxr-xr-x)
- .env file mode: 600 (rw-------)

---

## Password Reset Flow - Detailed

### Phase 1: Initiation

```
1. User visits https://my.sanctumtools.com/forgot-password
   ├─ Frontend: React component renders form
   └─ User sees: "Enter your email address"

2. User submits email (e.g., "alice@example.com")
   ├─ Frontend: POST /api/forgot-password
   │  Body: { email: "alice@example.com" }
   │  Headers: Content-Type: application/json
   └─ ALB routes to backend:3000

3. Backend receives request
   ├─ Express route handler: POST /api/forgot-password
   ├─ Validation: Check if email is valid format
   ├─ Database query: SELECT * FROM users WHERE email = "alice@example.com"
   └─ Decision: If user exists → continue, else → return success (prevent enumeration)
```

### Phase 2: Token Generation & Storage

```
4. Backend generates reset token
   ├─ UUID v4: e.g., "550e8400-e29b-41d4-a716-446655440000"
   ├─ Hash token: SHA256("550e8400-e29b-41d4-a716-446655440000")
   │  Result: "f3a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0"
   └─ Store in DynamoDB:
      Table: password-reset-tokens
      Item: {
        tokenHash: "f3a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0",
        email: "alice@example.com",
        expiresAt: 1699625400,  // Unix timestamp (now + 1 hour)
        createdAt: 1699621800   // Unix timestamp (now)
      }
      TTL: expiresAt attribute (auto-delete in 1 hour)

5. Token is NOT stored in plain text
   └─ Only hash stored; original token is one-way encrypted
```

### Phase 3: Email Delivery

```
6. Backend sends email via AWS SES
   ├─ API call: SESClient.send(SendEmailCommand)
   ├─ Parameters:
   │  Source: "support@sanctumtools.com"
   │  Destination: { ToAddresses: ["alice@example.com"] }
   │  Message: {
   │    Subject: { Data: "Password Reset Request" },
   │    Body: { Html: { Data: "... reset link ..." } }
   │  }
   └─ Reset Link:
      https://my.sanctumtools.com/reset-password?token=550e8400-e29b-41d4-a716-446655440000

7. Email delivery
   ├─ AWS SES validates sender (support@sanctumtools.com verified)
   ├─ SES sends email via SMTP to user's email provider
   ├─ Email arrives in alice@example.com inbox
   └─ Status: Success or bounce notification to CloudWatch
```

### Phase 4: User Receives Email

```
8. User clicks "Reset Password" link in email
   ├─ Link URL: https://my.sanctumtools.com/reset-password?token=550e8400-...
   ├─ ALB routes to frontend:3000
   └─ Frontend: React component receives token from URL query param

9. Frontend validates token with backend
   ├─ API call: GET /api/validate-reset-token?token=550e8400-...
   ├─ Backend receives token
   ├─ Hashes token again: SHA256("550e8400-...") → "f3a1b2c3..."
   ├─ DynamoDB query: SELECT * FROM password-reset-tokens
   │                  WHERE tokenHash = "f3a1b2c3..."
   ├─ Checks:
   │  ✓ Token exists in database
   │  ✓ Token not expired (expiresAt > now)
   └─ Response: { valid: true, email: "alice@example.com" }

10. Frontend shows password change form
    └─ User sees: "Enter new password" and "Confirm password" fields
```

### Phase 5: Password Update

```
11. User enters new password
    ├─ Example: "NewSecurePassword123!"
    └─ Frontend validates:
       ✓ Minimum length (e.g., 8 characters)
       ✓ Complexity (uppercase, numbers, symbols)
       ✓ Passwords match

12. Frontend submits password change
    ├─ API call: POST /api/reset-password
    ├─ Body: {
    │  token: "550e8400-e29b-41d4-a716-446655440000",
    │  newPassword: "NewSecurePassword123!"
    │}
    └─ ALB routes to backend:3000

13. Backend processes password reset
    ├─ Hash token: SHA256("550e8400-...")
    ├─ Validate token:
    │  ✓ Query DynamoDB for matching tokenHash
    │  ✓ Check expiration time
    │  ✓ Get email from token record
    ├─ Hash new password with bcrypt:
    │  bcrypt.hash("NewSecurePassword123!", 10)
    │  Result: "$2b$10$N9qo8uLOickgx2ZMRZoMyexamplehash..."
    ├─ Update user in DynamoDB:
    │  Table: users
    │  Update: email = "alice@example.com"
    │  Set: passwordHash = "$2b$10$N9qo8uLOickgx2ZMRZoMyexamplehash..."
    │       updatedAt = now
    ├─ Delete reset token:
    │  Table: password-reset-tokens
    │  Delete: tokenHash = "f3a1b2c3..."
    └─ Response: { success: true, message: "Password updated" }

14. Frontend receives success
    ├─ Show confirmation message
    ├─ Redirect to login page
    └─ User can now log in with new password
```

### Phase 6: Login with New Password

```
15. User logs in with new credentials
    ├─ API call: POST /api/login
    ├─ Body: { email: "alice@example.com", password: "NewSecurePassword123!" }
    └─ ALB routes to backend:3000

16. Backend authenticates user
    ├─ Query DynamoDB: SELECT * FROM users WHERE email = "alice@example.com"
    ├─ Compare password:
    │  bcrypt.compare("NewSecurePassword123!", "$2b$10$N9qo8...")
    ├─ Result: ✓ Password matches!
    ├─ Generate session:
    │  - Create session token
    │  - Store in session table (or memory)
    │  - Set HTTP cookie or return token
    └─ Response: { success: true, sessionToken: "..." }

17. User is logged in
    ├─ Frontend stores session token
    ├─ Subsequent requests include session header
    └─ User can access application features
```

---

## Security Architecture

### Encryption & Hashing

**Password Hashing**:
- Algorithm: bcrypt
- Salt rounds: 10
- Cost: Each hash takes ~100ms (prevents brute force)
- Never stored: Plain text password never stored anywhere
- Irreversible: Cannot decrypt password from hash

**Reset Token Hashing**:
- Algorithm: SHA256
- Format: UUID → hash
- Purpose: Store hash in database, send original in email
- If database is compromised: Attacker cannot use stolen hashes as tokens
- If email is intercepted: Token is one-way encrypted in database

**Communication**:
- Protocol: HTTPS (TLS 1.2+)
- Certificate: AWS ACM (sanctumtools.com)
- All traffic encrypted in transit

### Rate Limiting (Recommended)

**Not yet implemented**, but should be added:

```javascript
// Prevent brute force attacks
const rateLimit = require('express-rate-limit');

const passwordResetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 5,                     // 5 requests per window
  message: 'Too many password reset attempts, try again later',
  skip: (req) => req.user     // Skip for authenticated users
});

app.post('/api/forgot-password', passwordResetLimiter, ...)
```

### Token Expiration

- Reset link valid for: **1 hour**
- After 1 hour: Token auto-deleted by DynamoDB TTL
- User must request new reset link
- Prevents indefinite use of old reset links

### Email Security

- Verified domain: `sanctumtools.com`
- Verified sender: `support@sanctumtools.com`
- AWS SES verified identities (prevents spoofing)
- Email contains: Reset link (no passwords sent via email)
- SMTP SPF/DKIM configured (optional, prevents impersonation)

---

## Monitoring & Logging

### CloudWatch Logs

**Log Group**: `/aws/ec2/sanctumtools`

**Captured Events**:
- Service startup/shutdown
- Password reset requests
- Email delivery success/failure
- Authentication attempts
- Errors and exceptions

**Query Example**:
```bash
# View real-time logs
sudo journalctl -u sanctumtools -f

# View errors only
sudo journalctl -u sanctumtools -p err

# View last 1000 lines
sudo journalctl -u sanctumtools -n 1000 --output json | jq '.MESSAGE' -r
```

### AWS SES Monitoring

**Metrics to Monitor**:
- Delivery rate (should be >95%)
- Bounce rate (should be <1%)
- Complaint rate (should be <0.1%)
- Reject rate (should be 0%)

**Commands**:
```bash
# List verified identities
aws ses list-identities --region us-east-1

# Check account status
aws ses get-account-sending-enabled --region us-east-1

# View sending quota
aws ses get-send-quota --region us-east-1
```

### ALB Health Checks

**Health Check Details**:
- Protocol: HTTP
- Port: 3000
- Path: /api/forgot-password (or / if root handler added)
- Interval: 30 seconds
- Timeout: 5 seconds
- Healthy threshold: 2 consecutive successes
- Unhealthy threshold: 3 consecutive failures

**Status Codes**:
- 200-399: Healthy
- 400+: Unhealthy

---

## Deployment Architecture

### Current Production Setup

```
┌──────────────────────────────────┐
│   Development Machine            │
│   /home/jonclaude/               │
│   ├─ sanctumtools-frontend/      │
│   ├─ sanctumtools-backend/       │
│   ├─ sanctumtools-server/        │
│   │  ├─ EC2_DEPLOYMENT.md        │
│   │  ├─ quick-deploy.sh          │
│   │  └─ DEPLOYMENT_COMPLETE.md   │
│   └─ sanctumtools-new.pem        │
└──────────────────────────────────┘
         │
         │ Git push / SCP
         │ SSH private key
         │
    ┌────▼────────────────────────────┐
    │   GitHub Repository              │
    │   jonclaudedotnet/               │
    │   jc-gon-bring-it-to-ya          │
    │                                  │
    │   ├─ sanctumtools-backend/       │
    │   │  ├─ src/server.js            │
    │   │  ├─ lib/emailService.js      │
    │   │  ├─ package.json             │
    │   │  └─ .env (on EC2 only)       │
    │   │                              │
    │   └─ sanctumtools-frontend/      │
    │      └─ (React app)              │
    └────┬────────────────────────────┘
         │
         │ git clone / npm install
         │
    ┌────▼────────────────────────────────────┐
    │   EC2 Instance (i-07a5392c9925c32d8)    │
    │   /opt/sanctumtools-server/              │
    │                                         │
    │   ├─ src/server.js                     │
    │   ├─ lib/emailService.js               │
    │   ├─ lib/passwordReset.js              │
    │   ├─ node_modules/                     │
    │   ├─ package.json                      │
    │   ├─ .env (NEVER in git)               │
    │   └─ systemd service running           │
    │      └─ Process: /usr/bin/node src/... │
    │         Port: 3000                     │
    │         Memory: ~22MB                  │
    │         Status: active (running)       │
    └────┬────────────────────────────────────┘
         │
    HTTP │
    3000 │
         │
    ┌────▼────────────────────────────────┐
    │  Application Load Balancer          │
    │  HTTPS port 443                     │
    │  → HTTP port 3000 on EC2            │
    └────┬────────────────────────────────┘
         │
    HTTPS│ my.sanctumtools.com
         │
    ┌────▼────────────────────────────┐
    │  User Browser                    │
    │  https://my.sanctumtools.com/... │
    └──────────────────────────────────┘
```

### Infrastructure as Code (IaC) Recommendations

**Currently**: Manual deployment via SSH scripts

**Recommended**: Terraform or CloudFormation

```hcl
# Example Terraform setup (future improvement)
resource "aws_ec2_instance" "sanctumtools" {
  ami           = "ami-0c3e8df62015275ea"
  instance_type = "t3.small"
  key_name      = "sanctumtools-new"

  vpc_security_group_ids = [aws_security_group.backend.id]
  subnet_id              = aws_subnet.us_east_1d.id

  user_data = base64encode(templatefile("${path.module}/user_data.sh", {
    github_token = var.github_token
  }))

  tags = {
    Name = "sanctumtools-backend"
  }
}

resource "aws_elbv2_target_group" "sanctumtools" {
  name        = "sanctumtools-targets"
  port        = 3000
  protocol    = "HTTP"
  vpc_id      = aws_vpc.main.id

  health_check {
    healthy_threshold   = 2
    unhealthy_threshold = 3
    timeout             = 5
    interval            = 30
    path                = "/api/forgot-password"
    matcher             = "200-299"
  }
}
```

---

## Performance Characteristics

### Request Latency

**Password Reset Initiation**:
- Frontend rendering: ~50ms
- Network round trip: ~20ms
- Backend processing: ~100ms (DynamoDB queries + SES)
- Total user-perceived: ~170ms

**Password Reset Submission**:
- Frontend validation: ~5ms
- Network round trip: ~20ms
- Backend processing: ~150ms (bcrypt hashing + DynamoDB update)
- Total user-perceived: ~175ms

**Database Operations**:
- DynamoDB query: ~5-10ms (cached)
- DynamoDB write: ~10-20ms
- Bcrypt hash: ~100ms (intentional slowdown for security)

### Email Delivery

**AWS SES Latency**:
- API call: ~50ms
- Email delivery to recipient: 1-5 minutes (normal)
- Bounce notifications: Real-time or within 5 minutes

### Throughput

**Capacity**:
- t3.small instance: ~100-200 concurrent connections
- AWS SES: Default quota 50 emails/second
- DynamoDB: On-demand pricing (auto-scales)

**Bottlenecks**:
- Instance CPU: t3.small has 1 vCPU
- AWS SES quota: 50/second default
- DynamoDB: None (on-demand, unlimited)

**Scaling Recommendation** (future):
- Add t3.small instance 2 (already infrastructure ready)
- Increase ALB target group size
- Monitor DynamoDB capacity usage
- Request SES quota increase if needed

---

## Disaster Recovery

### Backup Strategy

**DynamoDB**:
- On-demand backup: AWS handles automatic backups
- Point-in-time recovery: Enabled by default
- Manual backup: Can create snapshots via AWS Console

**Source Code**:
- Git repository: GitHub (remote backup)
- SSH key: Multiple copies needed (sanctumtools-new.pem)
- .env file: Stored securely on EC2 only (not in Git)

### Failure Scenarios

**Scenario 1: EC2 Instance Crashes**
```
1. ALB detects unhealthy target (3 failed health checks = 90 seconds)
2. ALB removes instance from rotation
3. User requests → Error (no healthy targets)
4. Fix: SSH to instance and restart service
   sudo systemctl restart sanctumtools
5. ALB re-adds instance after 2 successful health checks (~60 seconds)
6. Total downtime: ~90 seconds until fix + ~60 seconds detection
```

**Scenario 2: EC2 Instance Disk Full**
```
1. npm install or service startup fails
2. Symptoms: service won't start, disk full error in logs
3. Fix: SSH and clean up old logs or code
   sudo journalctl --vacuum=50M
   rm -rf /opt/sanctumtools-server/node_modules
   npm install --production
   sudo systemctl restart sanctumtools
```

**Scenario 3: Database Corruption**
```
1. DynamoDB auto-replicates (no corruption risk in AWS)
2. If table deleted accidentally:
   a. Use DynamoDB backup to restore
   b. Or recreate table from CloudFormation template
3. If user data lost:
   a. DynamoDB point-in-time recovery available
   b. Restore to previous state
```

**Scenario 4: AWS SES Suspended**
```
1. Email delivery fails (bounce notifications)
2. Fix: Check AWS SES sending quota status
   aws ses get-send-quota --region us-east-1
3. Options:
   a. Request quota increase
   b. Switch to different email service (SNS, third-party)
   c. Implement email queuing/retry logic
```

### Recovery Time Objectives (RTO)

- **Password reset unavailable**: ~2 minutes (if EC2 crashes)
- **All data lost**: ~5 minutes (if table deleted, from backup)
- **Email delivery failure**: Immediate notification to user to try again

---

## Future Improvements

### Short-term (Weeks 1-4)

1. **Add rate limiting** - Prevent brute force password reset attempts
2. **Add root endpoint handler** - Let ALB health checks pass 200 OK
3. **Implement email queuing** - Handle SES throttling gracefully
4. **Add metrics** - CloudWatch metrics for password resets

### Medium-term (Months 1-3)

1. **Enable ALB access logs** - Track all requests
2. **Setup CloudWatch alarms** - Alert on service failures
3. **Multi-AZ deployment** - Add second EC2 instance
4. **Infrastructure as Code** - Terraform templates for reproducibility
5. **Automated testing** - Unit tests for reset logic
6. **Load testing** - Verify capacity under stress

### Long-term (Months 3+)

1. **Containerization** - Docker + ECR
2. **Kubernetes migration** - EKS cluster
3. **CI/CD pipeline** - GitHub Actions / AWS CodePipeline
4. **Observability** - Prometheus + Grafana
5. **Security hardening** - WAF, additional encryption
6. **Multi-region deployment** - Global redundancy

---

## Contact & Support

**Current Deployment Owner**: Claude Code (automated)

**Infrastructure**:
- AWS Account: 452774097660
- Region: us-east-1
- Instance: i-07a5392c9925c32d8

**For Questions**:
1. Check DEPLOYMENT_COMPLETE.md
2. Check TROUBLESHOOTING.md
3. Review logs: `sudo journalctl -u sanctumtools -f`
4. Check AWS Console for resource status

---

**Architecture Document Version**: 1.0
**Last Updated**: November 9, 2025
**Status**: Production
