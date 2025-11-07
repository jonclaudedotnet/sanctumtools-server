# SanctumTools Implementation Roadmap

**Date:** November 6, 2025
**Purpose:** Step-by-step implementation guide for AWS EC2 deployment
**Timeline:** 12-week sprint plan (adjustable for part-time development)

---

## Overview

This roadmap transforms SanctumTools from markdown documentation into a production-ready web application with microservices architecture deployed on AWS EC2.

**Core Principle:** Build incrementally, test continuously, deploy early.

---

## Pre-Implementation Decisions

### ✅ Decision Checkpoints

Before starting Sprint 1, confirm these decisions:

**1. Database Strategy**
- [ ] Single PostgreSQL database with schema separation (recommended for MVP)
- [ ] Database-per-service (for future scaling)

**Decision:** _________________________

**2. Technology Stack**
- [ ] Node.js + Express for backend services (recommended)
- [ ] Python + FastAPI for backend services
- [ ] Mixed (Node.js for most, Python for pattern-analysis)

**Decision:** _________________________

**3. Frontend Framework**
- [ ] React + Next.js (recommended)
- [ ] Vue.js + Nuxt
- [ ] Other: _________________________

**Decision:** _________________________

**4. Development Approach**
- [ ] Full-time development (12-week timeline)
- [ ] Part-time development (6+ month timeline)
- [ ] Hybrid (core team full-time, others part-time)

**Decision:** _________________________

**5. MVP Service Scope**
- [ ] 6 core services (User, Mood, AI Context, Session, DBT, Notifications)
- [ ] 9 services (add Episode, Export, Therapeutic Content)
- [ ] All 12 services

**Decision:** _________________________

**6. Deployment Environment**
- [ ] Single EC2 instance for MVP (recommended)
- [ ] Multi-instance from start
- [ ] ECS/Fargate (container orchestration)

**Decision:** _________________________

---

## Week-by-Week Sprint Plan

### Week 0: Setup & Foundation (5 days)

**Goal:** Development environment ready, repository structured, database designed

**Tasks:**
- [ ] Create GitHub repository: `sanctumtools-platform`
- [ ] Set up directory structure (see Architecture doc)
- [ ] Initialize all service directories with boilerplate
- [ ] Set up Docker development environment
  - [ ] `docker-compose.yml` for local development
  - [ ] PostgreSQL container
  - [ ] Redis container
  - [ ] NGINX container
- [ ] Database schema design
  - [ ] Design schemas for 6 core services
  - [ ] Write migration scripts
  - [ ] Seed therapeutic content
- [ ] Set up linting and code quality tools
  - [ ] ESLint/Prettier for Node.js
  - [ ] Black/Flake8 for Python
- [ ] Create `.env.example` with all required environment variables
- [ ] Write `README.md` with local setup instructions

**Deliverables:**
- Repository with structured directories
- Database schema migrations ready
- Docker Compose running locally
- Development standards documented

**Who:** JC (if full-time) or Melanie + JC (if part-time)

---

### Sprint 1: User Management Service (2 weeks)

**Goal:** Users can register, login, manage profiles and emergency contacts

**Week 1 Tasks:**
- [ ] **Backend: User Management Service**
  - [ ] Set up Express.js (or FastAPI) project
  - [ ] Implement user registration endpoint
    - Email validation
    - Password hashing (bcrypt)
    - Create user record
  - [ ] Implement login endpoint
    - Password verification
    - JWT token generation
    - Return access + refresh tokens
  - [ ] Implement JWT middleware for protected routes
  - [ ] User profile CRUD endpoints
    - GET /users/:id/profile
    - PUT /users/:id/profile
  - [ ] Emergency contacts CRUD endpoints
    - POST /users/:id/emergency-contacts
    - GET /users/:id/emergency-contacts
    - PUT /emergency-contacts/:id
    - DELETE /emergency-contacts/:id
  - [ ] Unit tests for all endpoints

- [ ] **Database:**
  - [ ] Run user_management schema migration
  - [ ] Seed test users

- [ ] **Frontend: Authentication UI**
  - [ ] Set up Next.js project
  - [ ] Create registration page
  - [ ] Create login page
  - [ ] Implement JWT storage (httpOnly cookies or localStorage)
  - [ ] Create protected route wrapper
  - [ ] Basic profile page
  - [ ] Emergency contacts form

**Week 2 Tasks:**
- [ ] **Backend: Healthcare Providers & Medications**
  - [ ] Healthcare providers CRUD endpoints
  - [ ] Medications CRUD endpoints
  - [ ] Profile completion tracking

- [ ] **Frontend: Intake Flow**
  - [ ] Healthcare provider form
  - [ ] Medication list management
  - [ ] Intake progress indicator (5 essential questions)
  - [ ] Dashboard placeholder

- [ ] **Integration Testing:**
  - [ ] End-to-end: User registers → logs in → completes profile
  - [ ] Test JWT expiration and refresh flow
  - [ ] Test emergency contact email validation

- [ ] **DevOps:**
  - [ ] Set up GitHub Actions CI pipeline
    - Lint check
    - Unit tests
    - Build Docker images

**Deliverables:**
- User Management service API fully functional
- Frontend authentication flow complete
- Users can manage profile, emergency contacts, medications
- CI pipeline running on GitHub

**Blockers to Address:**
- Environment variable management (secrets)
- CORS configuration for local dev
- Database connection pooling

---

### Sprint 2: Mood Tracking Service (2 weeks)

**Goal:** Users can log mood shifts with timestamps, view mood history

**Week 3 Tasks:**
- [ ] **Backend: Mood Tracking Service**
  - [ ] Set up service project structure
  - [ ] Implement mood shift logging endpoint
    - POST /mood/shift
    - Automatic timestamp from server
    - Validate user_id from JWT
    - Store in mood_tracking.mood_shifts table
  - [ ] Daily baseline endpoints
    - POST /mood/baseline/morning
    - POST /mood/baseline/evening
    - GET /mood/baseline/:user_id/:date
  - [ ] Mood shift retrieval endpoints
    - GET /mood/shifts/:user_id?start_date&end_date
    - GET /mood/shifts/:user_id/today
    - GET /mood/shifts/:user_id/week
  - [ ] Rapid cycling day summary endpoint
    - GET /mood/rapid-cycling/:user_id/:date
    - Calculate total states, avg duration, crisis count
  - [ ] Unit tests for all endpoints

- [ ] **Database:**
  - [ ] Run mood_tracking schema migration
  - [ ] Seed sample mood data for testing

- [ ] **Frontend: Mood Logger**
  - [ ] Quick mood shift form
    - Timestamp (auto-filled, editable)
    - Previous state (dropdown)
    - Current state (dropdown)
    - Trigger (text input)
    - Physical symptoms (multi-select or text)
    - Functionality level (radio buttons: crisis/limited/functional/high)
    - Activity (text input)
  - [ ] Morning baseline form
  - [ ] Evening baseline form
  - [ ] Mood history timeline view (basic)

**Week 4 Tasks:**
- [ ] **Backend: Pattern Recognition (Basic)**
  - [ ] Calculate rapid cycling stats
    - Total shifts in day/week
    - Average duration per state
    - Most common triggers
  - [ ] Crisis threshold detection
    - Flag if X crisis-level shifts in day
    - Flag if suicidal ideation keywords detected

- [ ] **Frontend: Mood Visualization**
  - [ ] Daily timeline chart (simple D3.js or Chart.js)
  - [ ] Weekly summary stats
  - [ ] Mood state color coding
  - [ ] Filter by date range

- [ ] **Integration Testing:**
  - [ ] End-to-end: User logs mood shift → appears in timeline
  - [ ] Test morning/evening baseline flow
  - [ ] Test rapid cycling calculation accuracy

- [ ] **Service Integration:**
  - [ ] Mood service communicates with User service for auth
  - [ ] Test JWT validation across services

**Deliverables:**
- Mood Tracking service API fully functional
- Frontend mood logger and timeline viewer
- Users can log mood shifts and view history
- Basic pattern recognition (crisis detection)

**Blockers to Address:**
- Timestamp timezone handling (convert to UTC, display in user's timezone)
- Large dataset performance (pagination needed)
- Mood state taxonomy (standardize state names)

---

### Sprint 3: AI Context Injection Service (2 weeks)

**Goal:** AI assistants can retrieve user context, personality settings, knowledge database

**Week 5 Tasks:**
- [ ] **Backend: AI Context Service**
  - [ ] Set up service project structure
  - [ ] AI configuration endpoints
    - GET /ai-config/:user_id (retrieve full config)
    - PUT /ai-config/:user_id/personality
    - POST /ai-config/:user_id/protocols (enable/disable)
  - [ ] Knowledge database endpoints
    - POST /ai-config/:user_id/knowledge (add entry)
    - GET /ai-config/:user_id/knowledge?category
    - PUT /ai-config/:user_id/knowledge/:key (update entry)
    - GET /ai-config/:user_id/knowledge-summary (for AI context injection)
  - [ ] Therapeutic frameworks enabled endpoints
    - POST /ai-config/:user_id/frameworks (enable framework)
    - GET /ai-config/:user_id/frameworks
  - [ ] Unit tests

- [ ] **Database:**
  - [ ] Run ai_context schema migration
  - [ ] Seed default AI personality options

- [ ] **Frontend: AI Settings**
  - [ ] AI personality configuration page
    - Tone slider (clinical ↔ supportive)
    - Pacing selector (brief/detailed/adaptive)
    - Topics to avoid (text list)
    - Crisis language phrases (custom)
  - [ ] Knowledge database viewer (show what AI knows)
  - [ ] Therapeutic frameworks selector (DBT, CBT, Schema, MBSR)

**Week 6 Tasks:**
- [ ] **AI Context Injection Logic**
  - [ ] Build context assembly function
    - Retrieve user profile
    - Retrieve AI personality settings
    - Retrieve knowledge database
    - Retrieve recent mood shifts (last 24 hours)
    - Assemble into prompt injection string
  - [ ] Context versioning (track when context was last updated)
  - [ ] Context caching (Redis) for performance

- [ ] **Frontend: Context Viewer**
  - [ ] Show assembled AI context (for debugging/transparency)
  - [ ] User can review what AI knows about them
  - [ ] Confidence level indicators (confirmed/inferred/uncertain/outdated)

- [ ] **Integration Testing:**
  - [ ] Test context assembly with sample user
  - [ ] Verify context includes all required sections
  - [ ] Test caching invalidation when user updates profile

- [ ] **Documentation:**
  - [ ] API documentation for AI integration
  - [ ] How to use context injection with Claude/ChatGPT/Gemini

**Deliverables:**
- AI Context service API fully functional
- User can configure AI personality and preferences
- Context injection system assembles user data for AI
- Frontend shows what AI knows (transparency)

**Blockers to Address:**
- Context token limits (summarization needed for long contexts)
- Knowledge database structure (flexible vs rigid)
- Privacy concerns (what gets stored vs computed on-demand)

---

### Sprint 4: Session Management Service (1.5 weeks)

**Goal:** Track user sessions, preserve conversation flow, searchable session history

**Week 7-8 Tasks:**
- [ ] **Backend: Session Management Service**
  - [ ] Session lifecycle endpoints
    - POST /sessions/start/:user_id
    - POST /sessions/end/:session_id
    - GET /sessions/:user_id/current (get active session)
  - [ ] Session memory endpoints
    - GET /sessions/:user_id/memory (current state)
    - PUT /sessions/:user_id/memory (update state)
    - POST /sessions/:user_id/snapshot (save to log)
  - [ ] Session log endpoints
    - GET /sessions/:user_id/logs?search&date_range
    - POST /sessions/:user_id/logs (append entry)
  - [ ] Unit tests

- [ ] **Database:**
  - [ ] Run sessions schema migration
  - [ ] Test append-only session log structure

- [ ] **Frontend: Session Viewer**
  - [ ] Session history page
  - [ ] Search session logs (grep-like)
  - [ ] Timeline view of sessions (by date)
  - [ ] Current session state display

- [ ] **Integration Testing:**
  - [ ] Test dual-file system (current state + historical log)
  - [ ] Test session log search functionality
  - [ ] Verify append-only behavior (no overwrites)

**Deliverables:**
- Session Management service API functional
- Users can view session history and search conversations
- Dual-file memory system (current + historical) working

**Blockers to Address:**
- Session log size (how long to retain? compression?)
- Search performance (consider Elasticsearch for large logs)

---

### Sprint 5: DBT Diary & Therapeutic Content Services (2 weeks)

**Goal:** Conversational DBT diary tracking, therapeutic skills library served

**Week 9 Tasks:**
- [ ] **Backend: DBT Diary Service**
  - [ ] Daily entry endpoints
    - POST /dbt/daily (log emotions, behaviors, skills)
    - GET /dbt/entries/:user_id?start_date&end_date
    - GET /dbt/weekly-summary/:user_id
  - [ ] Skills tracking endpoints
    - POST /dbt/skills (log skill usage)
    - GET /dbt/skills/:user_id?category
  - [ ] Unit tests

- [ ] **Backend: Therapeutic Content Service**
  - [ ] Frameworks endpoint
    - GET /therapeutic/frameworks
  - [ ] Skills library endpoints
    - GET /therapeutic/skills?framework&category
    - GET /therapeutic/skills/:skill_id
  - [ ] User skills library endpoints
    - POST /therapeutic/user-skills/:user_id (mark skill learned)
    - GET /therapeutic/user-skills/:user_id
  - [ ] Skill suggestion endpoint (AI-powered)
    - GET /therapeutic/suggest-skill?situation&emotion

- [ ] **Database:**
  - [ ] Run dbt_diary schema migration
  - [ ] Seed therapeutic content (DBT, CBT, Schema, MBSR skills)

- [ ] **Content Migration:**
  - [ ] Convert `/frameworks/*.md` to structured JSON
  - [ ] Import into therapeutic_frameworks and skills_library tables
  - [ ] Verify all skills loaded correctly

**Week 10 Tasks:**
- [ ] **Frontend: Conversational DBT Diary**
  - [ ] Daily check-in wizard (step-by-step questions)
    - Emotions intensity (0-5 scale)
    - Target behaviors (urges vs acts)
    - Skills used
    - PLEASE tracking (meds, sleep, eating, exercise)
  - [ ] DBT diary history view
  - [ ] Weekly summary chart

- [ ] **Frontend: Skills Library**
  - [ ] Browse skills by framework and category
  - [ ] Skill detail view (what it is, when to use, how to do it)
  - [ ] User's learned skills list
  - [ ] Skill search functionality

- [ ] **Integration Testing:**
  - [ ] End-to-end: User completes DBT diary → summary generated
  - [ ] Test skill suggestion based on situation/emotion
  - [ ] Verify therapeutic content serves correctly

**Deliverables:**
- DBT Diary service API functional
- Therapeutic Content service serves all skills
- Conversational DBT diary replaces form anxiety
- Users can browse and learn skills

**Blockers to Address:**
- Content quality (review therapeutic skills for accuracy)
- Skill suggestion algorithm (rule-based vs ML)

---

### Sprint 6: Notifications & Crisis Detection (1.5 weeks)

**Goal:** Crisis alerts sent to emergency contacts, medication reminders, appointment reminders

**Week 11-12 Tasks:**
- [ ] **Backend: Notification Service**
  - [ ] Email notification endpoints
    - POST /notifications/send
    - GET /notifications/:user_id/history
  - [ ] Alert rules endpoints
    - POST /alerts/rules/:user_id (create rule)
    - GET /alerts/rules/:user_id
    - PUT /alerts/rules/:rule_id (update)
  - [ ] Scheduled reminders endpoints
    - POST /reminders/:user_id (schedule reminder)
    - GET /reminders/:user_id
  - [ ] Integration with SendGrid or AWS SES
  - [ ] Unit tests

- [ ] **Crisis Detection Logic:**
  - [ ] Implement crisis keyword detection
    - Suicidal ideation keywords
    - Self-harm indicators
    - Crisis phrases from user's custom list
  - [ ] Threshold-based alerts
    - X crisis-level mood shifts in day
    - Rapid cycling exceeds threshold
  - [ ] Publish crisis event to Redis Pub/Sub

- [ ] **Database:**
  - [ ] Run notifications schema migration
  - [ ] Seed alert rules for test users

- [ ] **Frontend: Alert Settings**
  - [ ] Configure alert rules page
  - [ ] Emergency contact notification preferences
  - [ ] Medication reminder scheduling
  - [ ] Test notification button

- [ ] **Integration Testing:**
  - [ ] End-to-end: Crisis detected → email sent to emergency contacts
  - [ ] Test medication reminder scheduling
  - [ ] Verify alert rules trigger correctly

- [ ] **Service Integration:**
  - [ ] Mood service publishes crisis events
  - [ ] Notification service subscribes to crisis events
  - [ ] Pattern Analysis service triggers alerts

**Deliverables:**
- Notification service API functional
- Crisis detection triggers emergency alerts
- Medication and appointment reminders scheduled
- Email notifications sent successfully

**Blockers to Address:**
- Email deliverability (SendGrid setup, domain verification)
- SMS integration (optional Twilio setup)
- False positive crisis detection (tune thresholds)

---

### Week 12: Integration, Testing, Deployment

**Goal:** All services integrated, end-to-end testing complete, deployed to AWS EC2

**Tasks:**
- [ ] **Integration Testing:**
  - [ ] Full user journey tests
    - User signs up
    - Completes 5-question intake
    - Logs first mood shift
    - AI context assembled correctly
    - Mood shift appears in timeline
    - Pattern analysis runs
    - Crisis detected (if applicable)
    - Alert sent to emergency contact
    - DBT diary completed
    - Weekly summary generated
  - [ ] Load testing (simulate 10 concurrent users)
  - [ ] Security testing (OWASP top 10)

- [ ] **AWS Setup:**
  - [ ] Provision EC2 instance (t3.medium)
  - [ ] Configure security groups (80, 443, 22)
  - [ ] Attach Elastic IP
  - [ ] Set up Route 53 DNS (sanctumtools.com)
  - [ ] Generate SSL certificate (Let's Encrypt or AWS ACM)

- [ ] **Deployment:**
  - [ ] SSH to EC2 instance
  - [ ] Install Docker and Docker Compose
  - [ ] Clone repository
  - [ ] Set up environment variables (`.env` file)
  - [ ] Run `docker-compose up -d` (production compose file)
  - [ ] Verify all containers running
  - [ ] Run database migrations
  - [ ] Seed therapeutic content
  - [ ] Configure NGINX reverse proxy
  - [ ] Enable SSL/TLS

- [ ] **Monitoring:**
  - [ ] Set up CloudWatch logging
  - [ ] Configure health check endpoints
  - [ ] Set up error tracking (Sentry)
  - [ ] Create CloudWatch alarms (high CPU, service failures)

- [ ] **Documentation:**
  - [ ] Production deployment guide
  - [ ] API documentation (OpenAPI/Swagger)
  - [ ] User onboarding guide
  - [ ] Troubleshooting guide

- [ ] **Beta Testing:**
  - [ ] Melanie signs up as first user (Jazmine)
  - [ ] Melanie uses system for 1 week
  - [ ] Collect feedback and iterate

**Deliverables:**
- All 6 core services deployed to AWS EC2
- Production environment running and monitored
- Melanie successfully using Jazmine (dogfooding)
- Documentation complete

**Blockers to Address:**
- SSL certificate setup (verify domain ownership)
- Database backups (automated daily backups)
- Disaster recovery plan (restore from backup)

---

## Post-MVP: Remaining Services (Weeks 13+)

### Sprint 7: Episode Tracking Service

**Goal:** Users can document major psychiatric episodes and crises

**Tasks:**
- [ ] Backend API (episode creation, intervention logging)
- [ ] Database schema migration
- [ ] Frontend episode logger
- [ ] Integration with mood tracking (crisis episodes auto-created)

**Timeline:** 1 week

---

### Sprint 8: Export & Reports Service

**Goal:** Generate PDF reports for psychiatrists, therapists, SSDI applications

**Tasks:**
- [ ] Backend API (PDF generation via Pandoc or Puppeteer)
- [ ] S3 integration for file storage
- [ ] Frontend report request page
- [ ] Template customization (psychiatrist vs SSDI format)

**Timeline:** 1.5 weeks

---

### Sprint 9: Pattern Analysis Service (Advanced)

**Goal:** AI-powered pattern recognition, DSM-5 diagnostic pattern detection

**Tasks:**
- [ ] Backend API (pattern analysis algorithms)
- [ ] Integration with OpenAI/Gemini for advanced insights
- [ ] Frontend pattern insights display
- [ ] Comorbidity flagging logic
- [ ] Weekly analysis automation

**Timeline:** 2 weeks

---

### Sprint 10: Medication Tracking Service

**Goal:** Track medication adherence, side effects, effectiveness

**Tasks:**
- [ ] Backend API (medication logs, side effects)
- [ ] Database schema migration
- [ ] Frontend medication logger
- [ ] Correlation with mood data

**Timeline:** 1 week

---

### Sprint 11: Specialized Trackers Service

**Goal:** BPD trackers, menstrual/hormone tracking, routine tracking

**Tasks:**
- [ ] Backend API (BPD abandonment, emotional intensity, menstrual)
- [ ] Database schema migration
- [ ] Frontend specialized tracker forms
- [ ] Mood-cycle correlation charts

**Timeline:** 1.5 weeks

---

## Development Resources

### Team Composition

**MVP (6 core services):**
- 1 Full-stack developer (Melanie or JC)
- 1 Backend developer (JC if Melanie focuses on frontend)
- 1 DevOps engineer (part-time, or Melanie/JC wearing multiple hats)

**Full Product (12 services):**
- 2 Backend developers
- 1 Frontend developer
- 1 DevOps engineer
- 1 QA tester

### Time Estimates

**Full-time (40 hours/week):**
- MVP (6 services): 12 weeks
- Full product (12 services): 20 weeks

**Part-time (20 hours/week):**
- MVP (6 services): 24 weeks (6 months)
- Full product (12 services): 40 weeks (10 months)

**Sweat Equity (Melanie + JC, 10-15 hours/week each):**
- MVP (6 services): 6-9 months
- Full product (12 services): 12-18 months

---

## Risk Management

### High-Risk Areas

**1. AI Context Injection Complexity**
- **Risk:** Novel feature, may be technically challenging
- **Mitigation:** Prototype with simple prompt concatenation first
- **Contingency:** Use existing AI APIs (OpenAI, Anthropic) instead of custom models

**2. Database Performance at Scale**
- **Risk:** Single database becomes bottleneck
- **Mitigation:** Implement caching, query optimization from day 1
- **Contingency:** Migrate to database-per-service architecture

**3. Crisis Detection Accuracy**
- **Risk:** False positives/negatives harm user trust
- **Mitigation:** User-customizable thresholds, manual override
- **Contingency:** Default to conservative detection (fewer false positives)

**4. HIPAA Compliance**
- **Risk:** Handling sensitive health data requires compliance
- **Mitigation:** Implement encryption, audit logging, user data deletion
- **Contingency:** Consult compliance expert before production launch

---

## Success Metrics

### MVP Success Criteria

**Technical:**
- [ ] All 6 services deployed and communicating
- [ ] Database migrations run successfully
- [ ] API response times < 200ms (95th percentile)
- [ ] Zero data loss in 1-week beta test
- [ ] SSL/TLS encryption working
- [ ] Backups automated and tested

**User Experience:**
- [ ] Melanie completes onboarding in < 5 minutes
- [ ] Melanie logs mood shifts successfully
- [ ] AI context injection works (Jazmine knows Melanie's context)
- [ ] Crisis detection fires correctly (test scenario)
- [ ] Melanie uses system for 1 week without major issues

**Business:**
- [ ] Infrastructure costs < $100/month
- [ ] System can handle 10 beta users concurrently
- [ ] Positive feedback from Melanie (first user)
- [ ] Codebase documented enough for JC to contribute

---

## Next Steps (Before Sprint 1)

1. **Confirm Decisions** (see Decision Checkpoints above)
2. **Set Up GitHub Repository**
3. **Assign Roles** (who builds what?)
4. **Schedule Kickoff Meeting** (Melanie + JC)
5. **Review Architecture Document** (ensure alignment)
6. **Begin Week 0 Setup Tasks**

---

**Ready to begin when you are. Let's build SanctumTools.**
