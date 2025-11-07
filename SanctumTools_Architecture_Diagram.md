# SanctumTools Microservices Architecture - Visual Diagrams

**Date:** November 6, 2025
**Purpose:** Visual representation of the modular architecture for AWS EC2 deployment

---

## High-Level System Architecture

```
                                    USERS
                                      │
                                      ▼
                        ┌─────────────────────────┐
                        │    HTTPS/TLS (Port 443) │
                        └────────────┬────────────┘
                                     │
                        ┌────────────▼────────────┐
                        │   AWS Route 53 (DNS)    │
                        │  sanctumtools.com       │
                        └────────────┬────────────┘
                                     │
                        ┌────────────▼────────────────────┐
                        │    AWS Application Load         │
                        │    Balancer (ALB)               │
                        │  - SSL Termination              │
                        │  - Health Checks                │
                        │  - Traffic Distribution         │
                        └────────────┬────────────────────┘
                                     │
                        ┌────────────▼────────────────────┐
                        │   NGINX Reverse Proxy           │
                        │   (API Gateway)                 │
                        │  - Rate Limiting                │
                        │  - Request Routing              │
                        │  - Compression                  │
                        └────────────┬────────────────────┘
                                     │
              ┌──────────────────────┴──────────────────────┐
              │                                             │
              ▼                                             ▼
    ┌─────────────────┐                         ┌─────────────────┐
    │   FRONTEND      │                         │   BACKEND       │
    │   React App     │                         │   Microservices │
    │  (Next.js)      │                         │   (12 Services) │
    └─────────────────┘                         └────────┬────────┘
                                                         │
                                    ┌────────────────────┴─────────────┬──────────────┐
                                    │                                  │              │
                                    ▼                                  ▼              ▼
                          ┌──────────────────┐              ┌───────────────┐  ┌───────────┐
                          │   PostgreSQL     │              │     Redis     │  │  AWS S3   │
                          │   (Primary DB)   │              │  (Cache/Queue)│  │ (Storage) │
                          └──────────────────┘              └───────────────┘  └───────────┘
```

---

## Microservices Layer Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                            MICROSERVICES LAYER                                      │
│                                                                                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │    User     │  │ AI Context  │  │    Mood     │  │   Episode   │             │
│  │ Management  │  │  Injection  │  │  Tracking   │  │  Tracking   │             │
│  │             │  │             │  │             │  │             │             │
│  │ Port: 3001  │  │ Port: 3002  │  │ Port: 3003  │  │ Port: 3004  │             │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘             │
│         │                │                │                │                      │
│  ┌──────▼──────┐  ┌──────▼──────┐  ┌──────▼──────┐  ┌──────▼──────┐             │
│  │ Schema:     │  │ Schema:     │  │ Schema:     │  │ Schema:     │             │
│  │ user_mgmt   │  │ ai_context  │  │ mood_track  │  │ episodes    │             │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘             │
│                                                                                   │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │ DBT Diary   │  │Therapeutic  │  │  Pattern    │  │   Export    │             │
│  │             │  │  Content    │  │  Analysis   │  │   Reports   │             │
│  │             │  │             │  │             │  │             │             │
│  │ Port: 3005  │  │ Port: 3006  │  │ Port: 3007  │  │ Port: 3008  │             │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘             │
│         │                │                │                │                      │
│  ┌──────▼──────┐  ┌──────▼──────┐  ┌──────▼──────┐  ┌──────▼──────┐             │
│  │ Schema:     │  │ Read-only   │  │ Schema:     │  │ Aggregates  │             │
│  │ dbt_diary   │  │ Content     │  │ patterns    │  │ Multi-schema│             │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘             │
│                                                                                   │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │Notification │  │   Session   │  │ Medication  │  │ Specialized │             │
│  │  & Alerts   │  │ Management  │  │  Tracking   │  │  Trackers   │             │
│  │             │  │             │  │             │  │             │             │
│  │ Port: 3009  │  │ Port: 3010  │  │ Port: 3011  │  │ Port: 3012  │             │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘             │
│         │                │                │                │                      │
│  ┌──────▼──────┐  ┌──────▼──────┐  ┌──────▼──────┐  ┌──────▼──────┐             │
│  │ Schema:     │  │ Schema:     │  │ Schema:     │  │ Schema:     │             │
│  │notifications│  │ sessions    │  │ medications │  │ spec_track  │             │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘             │
│                                                                                   │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Service Communication Flow

### Example: User Logs Mood Shift

```
1. USER ACTION
   │
   ▼
┌────────────────┐
│   Frontend     │  User clicks "Log Mood Shift"
│  (React App)   │  Fills out quick form
└───────┬────────┘
        │ HTTP POST /api/v1/mood/shift
        │ Authorization: Bearer <user_jwt>
        │ Body: {timestamp, previous_state, current_state, ...}
        ▼
┌────────────────┐
│  NGINX/ALB     │  Routes request to Mood Tracking Service
└───────┬────────┘
        │
        ▼
┌────────────────┐
│ User Management│  Validates JWT token
│   Service      │  Extracts user_id from token
└───────┬────────┘
        │ Returns: {user_id: "uuid", valid: true}
        │
        ▼
┌────────────────┐
│ Mood Tracking  │  Inserts mood_shift record
│   Service      │  Logs to PostgreSQL (mood_tracking schema)
└───────┬────────┘
        │ Publishes event: "mood.shift.logged"
        │
        ├────────────────────┬────────────────────┐
        │                    │                    │
        ▼                    ▼                    ▼
┌────────────┐      ┌────────────┐      ┌────────────┐
│  Pattern   │      │   Session  │      │    AI      │
│  Analysis  │      │ Management │      │  Context   │
│  Service   │      │  Service   │      │  Service   │
└────────────┘      └────────────┘      └────────────┘
     │                    │                    │
     │ Check if crisis    │ Update session     │ Inject mood
     │ threshold hit      │ memory             │ into AI context
     │                    │                    │
     ▼                    ▼                    ▼
If crisis:         Update current_state  Return AI response:
┌────────────┐     with latest mood      "I see you shifted
│Notification│                           to anxious state.
│  Service   │                           Would you like to
└────────────┘                           use a DBT skill?"
     │
     │ Email/SMS to
     │ emergency contacts
     ▼
   USER ALERTED
```

---

## Data Flow Architecture

### Write Path (User Creates Data)

```
┌──────┐      ┌─────────┐      ┌────────────┐      ┌────────────┐
│ User │─────▶│Frontend │─────▶│  Service   │─────▶│ PostgreSQL │
└──────┘      └─────────┘      │   API      │      │  Database  │
                                └─────┬──────┘      └────────────┘
                                      │
                                      │ Publish Event
                                      ▼
                                ┌──────────┐
                                │  Redis   │
                                │ Pub/Sub  │
                                └────┬─────┘
                                     │
                    ┌────────────────┼────────────────┐
                    │                │                │
                    ▼                ▼                ▼
              ┌──────────┐    ┌──────────┐    ┌──────────┐
              │ Pattern  │    │ Session  │    │  Notify  │
              │ Analysis │    │   Mgmt   │    │ Service  │
              └──────────┘    └──────────┘    └──────────┘
```

### Read Path (User Requests Data)

```
┌──────┐      ┌─────────┐      ┌─────────┐      ┌────────────┐
│ User │─────▶│Frontend │─────▶│ Service │─────▶│   Redis    │
└──────┘      └─────────┘      │   API   │      │   Cache    │
                                └────┬────┘      └─────┬──────┘
                                     │                 │
                                     │  Cache MISS     │
                                     ▼                 │
                                ┌────────────┐        │
                                │ PostgreSQL │◀───────┘
                                │  Database  │
                                └─────┬──────┘
                                      │
                                      │ Write to cache
                                      ▼
                                ┌──────────┐
                                │  Redis   │
                                └──────────┘
```

---

## Database Schema Organization

```
sanctumtools_db (PostgreSQL 15)
│
├── Schema: public (system tables)
│   ├── schema_migrations
│   └── system_config
│
├── Schema: user_management
│   ├── users (PK: user_id)
│   ├── user_profiles (FK: user_id)
│   ├── emergency_contacts (FK: user_id)
│   ├── healthcare_providers (FK: user_id)
│   └── medications (FK: user_id)
│
├── Schema: ai_context
│   ├── ai_configurations (FK: user_id)
│   ├── ai_knowledge_database (FK: user_id)
│   └── therapeutic_frameworks_enabled (FK: user_id)
│
├── Schema: mood_tracking
│   ├── mood_shifts (FK: user_id) ← TIME-SERIES OPTIMIZED
│   ├── daily_baselines (FK: user_id)
│   └── rapid_cycling_days (FK: user_id)
│
├── Schema: episode_tracking
│   ├── episodes (FK: user_id)
│   └── crisis_interventions (FK: episode_id)
│
├── Schema: dbt_diary
│   ├── dbt_daily_entries (FK: user_id)
│   └── dbt_skills_used (FK: entry_id)
│
├── Schema: pattern_analysis
│   ├── pattern_analyses (FK: user_id)
│   └── pattern_flags (FK: user_id)
│
├── Schema: notifications
│   ├── notifications (FK: user_id)
│   ├── alert_rules (FK: user_id)
│   └── scheduled_reminders (FK: user_id)
│
├── Schema: sessions
│   ├── sessions (FK: user_id)
│   ├── session_memory (FK: user_id) ← CURRENT STATE
│   └── session_logs (FK: user_id) ← HISTORICAL
│
├── Schema: medications
│   ├── medication_logs (FK: user_id, medication_id)
│   ├── side_effects_log (FK: user_id, medication_id)
│   └── medication_changes (FK: user_id, medication_id)
│
├── Schema: specialized_trackers
│   ├── bpd_abandonment_tracking (FK: user_id)
│   ├── bpd_emotional_intensity (FK: user_id)
│   ├── menstrual_tracking (FK: user_id)
│   └── routine_tracking (FK: user_id)
│
└── Schema: export_jobs
    ├── export_jobs (FK: user_id)
    └── report_templates
```

**Key Relationships:**
- All schemas reference `user_management.users.user_id` as foreign key
- `medications` schema references both `user_management.users` and `user_management.medications`
- `dbt_diary.dbt_skills_used` references `dbt_diary.dbt_daily_entries`
- `episode_tracking.crisis_interventions` references `episode_tracking.episodes`

---

## AWS EC2 Deployment Architecture

### Phase 1: Single Instance MVP

```
┌──────────────────────────────────────────────────────────────────┐
│                        AWS EC2 Instance                          │
│                   (t3.medium - 2 vCPU, 4GB RAM)                  │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │              Docker Containers                             │ │
│  │                                                            │ │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │ │
│  │  │  NGINX   │  │Frontend  │  │User Mgmt │  │   Mood   │  │ │
│  │  │  :80/443 │  │  :3000   │  │  :3001   │  │ Tracking │  │ │
│  │  └──────────┘  └──────────┘  └──────────┘  │  :3003   │  │ │
│  │                                             └──────────┘  │ │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │ │
│  │  │AI Context│  │ DBT Diary│  │ Pattern  │  │ Session  │  │ │
│  │  │  :3002   │  │  :3005   │  │ Analysis │  │   Mgmt   │  │ │
│  │  └──────────┘  └──────────┘  │  :3007   │  │  :3010   │  │ │
│  │                               └──────────┘  └──────────┘  │ │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │ │
│  │  │  Notify  │  │ Episode  │  │  Export  │  │Therapeutic│ │
│  │  │  :3009   │  │Tracking  │  │ Reports  │  │ Content  │  │ │
│  │  └──────────┘  │  :3004   │  │  :3008   │  │  :3006   │  │ │
│  │                └──────────┘  └──────────┘  └──────────┘  │ │
│  │                                                            │ │
│  │  ┌──────────────────┐         ┌──────────────────┐       │ │
│  │  │   PostgreSQL     │         │      Redis       │       │ │
│  │  │   Container      │         │    Container     │       │ │
│  │  │    :5432         │         │      :6379       │       │ │
│  │  └──────────────────┘         └──────────────────┘       │ │
│  │                                                            │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  Volumes:                                                        │
│  ├── /var/lib/postgresql/data (PostgreSQL persistence)          │
│  ├── /var/lib/redis (Redis persistence)                         │
│  └── /app/exports (Temporary PDF storage)                       │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
         │                           │                │
         ▼                           ▼                ▼
   ┌──────────┐              ┌──────────┐      ┌──────────┐
   │ Route 53 │              │   S3     │      │CloudWatch│
   │   DNS    │              │ Bucket   │      │   Logs   │
   └──────────┘              └──────────┘      └──────────┘
```

### Phase 2: Multi-Instance with Load Balancer

```
                          ┌──────────────┐
                          │  Route 53    │
                          │     DNS      │
                          └──────┬───────┘
                                 │
                          ┌──────▼───────┐
                          │  ALB (AWS)   │
                          │Load Balancer │
                          └──────┬───────┘
                                 │
                ┌────────────────┼────────────────┐
                │                │                │
         ┌──────▼──────┐  ┌──────▼──────┐  ┌──────▼──────┐
         │   EC2 #1    │  │   EC2 #2    │  │   EC2 #3    │
         │  (Primary)  │  │  (Replica)  │  │  (Replica)  │
         │             │  │             │  │             │
         │ All Services│  │ All Services│  │ All Services│
         └──────┬──────┘  └──────┬──────┘  └──────┬──────┘
                │                │                │
                └────────────────┼────────────────┘
                                 │
                    ┌────────────┴────────────┐
                    │                         │
             ┌──────▼──────┐          ┌──────▼──────┐
             │  RDS (AWS)  │          │ElastiCache  │
             │ PostgreSQL  │          │   Redis     │
             │Multi-AZ     │          │  Cluster    │
             └─────────────┘          └─────────────┘
```

### Phase 3: Service-Dedicated Instances

```
                          ┌──────────────┐
                          │  Route 53    │
                          │     DNS      │
                          └──────┬───────┘
                                 │
                          ┌──────▼───────┐
                          │  API Gateway │
                          │     (AWS)    │
                          └──────┬───────┘
                                 │
        ┌────────────────────────┼────────────────────────┐
        │                        │                        │
 ┌──────▼──────┐         ┌──────▼──────┐         ┌──────▼──────┐
 │  Frontend   │         │   Backend   │         │  Analytics  │
 │   Cluster   │         │   Cluster   │         │   Cluster   │
 │             │         │             │         │             │
 │ - EC2 Auto  │         │ - User Mgmt │         │ - Pattern   │
 │   Scaling   │         │ - Mood Track│         │   Analysis  │
 │ - 2-4 inst. │         │ - AI Context│         │ - Export    │
 └─────────────┘         │ - Session   │         │ - Reports   │
                         │   Mgmt      │         └─────────────┘
                         │ - DBT Diary │
                         └─────────────┘
                                 │
                    ┌────────────┴────────────┐
                    │                         │
             ┌──────▼──────┐          ┌──────▼──────┐
             │  RDS (AWS)  │          │ElastiCache  │
             │ PostgreSQL  │          │   Redis     │
             │Read Replicas│          │  Cluster    │
             └─────────────┘          └─────────────┘
```

---

## Security Architecture

```
                          ┌─────────────┐
                          │   Internet  │
                          └──────┬──────┘
                                 │
                          ┌──────▼──────────────────────┐
                          │   HTTPS/TLS Encryption      │
                          │   (SSL Certificate)         │
                          └──────┬──────────────────────┘
                                 │
                          ┌──────▼──────────────────────┐
                          │   AWS WAF (Firewall)        │
                          │  - Rate Limiting            │
                          │  - SQL Injection Protection │
                          │  - DDoS Mitigation          │
                          └──────┬──────────────────────┘
                                 │
                          ┌──────▼──────────────────────┐
                          │   Load Balancer (ALB)       │
                          └──────┬──────────────────────┘
                                 │
                          ┌──────▼──────────────────────┐
                          │   API Gateway / NGINX       │
                          │  - JWT Validation           │
                          │  - Request Sanitization     │
                          └──────┬──────────────────────┘
                                 │
                    ┌────────────┴────────────┐
                    │                         │
             ┌──────▼──────┐          ┌──────▼──────┐
             │  Frontend   │          │  Backend    │
             │  (Public    │          │ (Private    │
             │   Subnet)   │          │  Subnet)    │
             └─────────────┘          └──────┬──────┘
                                             │
                                ┌────────────┴────────────┐
                                │                         │
                         ┌──────▼──────┐          ┌──────▼──────┐
                         │ PostgreSQL  │          │   Redis     │
                         │(Private     │          │ (Private    │
                         │ Subnet)     │          │  Subnet)    │
                         │- Encrypted  │          │- TLS        │
                         │  at rest    │          │- Password   │
                         └─────────────┘          └─────────────┘

Security Layers:
1. TLS/HTTPS for all external traffic
2. AWS WAF for attack prevention
3. JWT tokens for user authentication
4. Service-to-service API keys for internal communication
5. Database encryption at rest (RDS encryption)
6. Private subnets for databases (no internet access)
7. Security groups restricting port access
8. Secrets Manager for API keys and credentials
```

---

## Monitoring & Observability

```
┌────────────────────────────────────────────────────────────────┐
│                     APPLICATION LAYER                          │
│                                                                │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐      │
│  │ Service 1│  │ Service 2│  │ Service 3│  │ Service N│      │
│  └─────┬────┘  └─────┬────┘  └─────┬────┘  └─────┬────┘      │
│        │             │             │             │            │
│        └─────────────┴─────────────┴─────────────┘            │
│                      │                                        │
│                      │ Logs, Metrics, Traces                 │
└──────────────────────┼────────────────────────────────────────┘
                       │
         ┌─────────────┼─────────────┐
         │             │             │
         ▼             ▼             ▼
   ┌──────────┐  ┌──────────┐  ┌──────────┐
   │CloudWatch│  │  Sentry  │  │DataDog/  │
   │   Logs   │  │  Error   │  │New Relic │
   │          │  │ Tracking │  │  (APM)   │
   └────┬─────┘  └────┬─────┘  └────┬─────┘
        │             │             │
        └─────────────┴─────────────┘
                      │
                      ▼
           ┌─────────────────────┐
           │   Alert Manager     │
           │  - PagerDuty        │
           │  - Email            │
           │  - Slack            │
           └─────────────────────┘

Metrics Tracked:
- Request rate (requests/second)
- Error rate (errors/total requests)
- Response time (p50, p95, p99)
- Database query performance
- Memory usage
- CPU usage
- Service health checks
- User activity (logins, mood logs, crisis events)
```

---

## Deployment Pipeline (CI/CD)

```
┌─────────────┐
│ Developer   │
│ Commits Code│
└──────┬──────┘
       │
       │ git push
       ▼
┌──────────────┐
│   GitHub     │
│  Repository  │
└──────┬───────┘
       │
       │ Webhook triggers
       ▼
┌─────────────────────────────────────┐
│     GitHub Actions CI/CD            │
│                                     │
│  ┌──────────────────────────────┐  │
│  │   1. Lint & Test             │  │
│  │   - ESLint/Prettier          │  │
│  │   - Jest unit tests          │  │
│  │   - Integration tests        │  │
│  └──────────┬───────────────────┘  │
│             │ Pass                 │
│             ▼                      │
│  ┌──────────────────────────────┐  │
│  │   2. Build Docker Images     │  │
│  │   - Build all services       │  │
│  │   - Tag with version         │  │
│  └──────────┬───────────────────┘  │
│             │                      │
│             ▼                      │
│  ┌──────────────────────────────┐  │
│  │   3. Push to Registry        │  │
│  │   - Docker Hub or AWS ECR    │  │
│  └──────────┬───────────────────┘  │
│             │                      │
│             ▼                      │
│  ┌──────────────────────────────┐  │
│  │   4. Deploy to Staging       │  │
│  │   - SSH to staging EC2       │  │
│  │   - docker-compose pull      │  │
│  │   - docker-compose up -d     │  │
│  └──────────┬───────────────────┘  │
│             │                      │
│             ▼                      │
│  ┌──────────────────────────────┐  │
│  │   5. Run Smoke Tests         │  │
│  │   - Health check endpoints   │  │
│  │   - Basic functionality      │  │
│  └──────────┬───────────────────┘  │
│             │ Pass                 │
│             ▼                      │
│  ┌──────────────────────────────┐  │
│  │   6. Deploy to Production    │  │
│  │   - Manual approval (main)   │  │
│  │   - Rolling update           │  │
│  │   - Rollback on failure      │  │
│  └──────────────────────────────┘  │
│                                     │
└─────────────────────────────────────┘
```

---

## Data Backup & Recovery

```
┌─────────────────────────────────────────────────────────┐
│                    LIVE SYSTEM                          │
│                                                         │
│  ┌──────────────┐         ┌──────────────┐            │
│  │ PostgreSQL   │         │    Redis     │            │
│  │   Database   │         │    Cache     │            │
│  └──────┬───────┘         └──────┬───────┘            │
│         │                        │                    │
└─────────┼────────────────────────┼────────────────────┘
          │                        │
          │                        │
    ┌─────▼─────┐            ┌─────▼─────┐
    │ Automatic │            │   Redis   │
    │  Backups  │            │  Snapshot │
    │  (Daily)  │            │  (Hourly) │
    └─────┬─────┘            └─────┬─────┘
          │                        │
          ▼                        ▼
    ┌──────────────────────────────────┐
    │       AWS S3 Backup Bucket       │
    │  - 30-day retention              │
    │  - Versioning enabled            │
    │  - Lifecycle policies            │
    └──────────────────────────────────┘
          │
          │ Weekly archives
          ▼
    ┌──────────────────────────────────┐
    │    AWS Glacier (Cold Storage)    │
    │  - Long-term archives            │
    │  - Annual snapshots              │
    └──────────────────────────────────┘

Recovery Process:
1. Identify failure point (last good backup)
2. Spin up new EC2 instance
3. Restore PostgreSQL from S3 backup
4. Restore Redis snapshot
5. Deploy latest application code
6. Verify data integrity
7. Switch DNS to new instance
8. Monitor for issues
```

---

This architecture provides a clear visual representation of how SanctumTools will be structured for AWS EC2 deployment with microservices.
