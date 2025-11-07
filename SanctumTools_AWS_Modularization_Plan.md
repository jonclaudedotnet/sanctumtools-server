# SanctumTools AWS EC2 Modularization Plan

**Analysis Date:** November 6, 2025, 8:50 PM EST
**Analyst:** Fred (Claude Code)
**Purpose:** Restructure SanctumTools for scalable AWS EC2 deployment with microservices architecture

---

## Executive Summary

SanctumTools is currently a **documentation-based mental health tracking system** with AI assistant integration protocols. To deploy on AWS EC2 as a web application, we need to transform static markdown templates and AI instructions into **dynamic, modular services**.

**Current State:** Markdown documentation + AI configuration files
**Target State:** Microservices architecture with separated concerns, independent scaling, and clean API boundaries

**Key Insight:** SanctumTools has 17 distinct systems (8 automatic, 9 opt-in) that can be separated into independent microservices for better scalability, maintainability, and deployment.

---

## Current Product Structure Analysis

### What Exists Now

**Root Level (Core Product):**
- `README.md` - Product overview
- `AI_ASSISTANT_SETUP_GUIDE.md` - AI configuration protocols
- `AI_PERSONALITY_GUIDE.md` - AI customization options
- `AI_TRACKING_TOOLS_GUIDE.md` - AI tool integration
- `ai_dsm5_pattern_recognition.md` - Pattern recognition protocols
- `user_intake_form.md` - AI knowledge database structure
- Core tracking templates (mood shifts, episodes, rapid cycling)
- `dbt_diary_conversational_tracking.md` - DBT diary card alternative
- `pdf_export_guide.md` - Export functionality
- `ssdi_documentation_guide.md` - Disability documentation

**Frameworks Directory (Therapeutic Content):**
- DBT (core skills + conversational teaching guide)
- CBT (core skills + conversational teaching guide)
- Schema Therapy (core skills + conversational teaching guide)
- MBSR (core skills + conversational teaching guide)

**Templates Directory (Specialized Tracking):**
- Morning/evening routine templates
- Medication log template
- Menstrual/hormone tracker
- BPD-specific trackers (abandonment, emotional intensity, relationship)
- Lifeline email template (emergency contact system)

### Product Philosophy

**User-Initiated Tracking:** Users report when THEY notice changes (not AI-prompted)
**Conversational Over Forms:** AI asks questions naturally, captures structured data behind the scenes
**Precision Over Vaguness:** Exact timestamps, no approximations
**Real-Time Skills Coaching:** Teach therapeutic skills in context when needed
**Privacy-First:** User controls data, secure storage, encrypted exports

---

## The 17 Systems Breakdown

### Automatic Systems (8) - AI Knowledge Base

These run automatically when AI is configured with SanctumTools:

1. **Crisis Override Protocol** - Immediate safety intervention when self-harm/suicidal indicators detected
2. **Time Awareness System** - Mandatory timestamp verification (AI runs `date` command)
3. **Good Morning Protocol** - Day start baseline, morning check-in, medication tracking
4. **Good Night Protocol** - End-of-day summary, DBT diary card, session memory save
5. **Mood Shift Tracking** - Real-time emotional state logging with timestamps
6. **Session Memory Management** - Dual-file system (current state + historical log)
7. **Pattern Recognition** - DSM-5 based symptom pattern detection
8. **Emergency Contact System** - Automated crisis notification capability

### Opt-In Systems (9) - User-Activated Tools

These are tools users can choose to use:

1. **DBT Skills Coaching** - Teach DBT skills in real-time situations
2. **Episode Tracker** - Major psychiatric events logging
3. **Rapid Cycling Tracker** - Daily comprehensive timeline
4. **Medication Log** - Adherence and side effect tracking
5. **BPD-Specific Trackers** - Abandonment, emotional intensity, relationships
6. **Menstrual/Hormone Tracker** - Cycle correlation with mood
7. **Morning/Evening Routines** - Structured daily habits
8. **PDF Export System** - Healthcare appointment preparation
9. **SSDI Documentation** - Disability claim evidence compilation

---

## Proposed Microservices Architecture

### Service Separation Strategy

**Principle:** Each service should have a single responsibility and clear boundaries.

### 1. **User Management Service**

**Responsibility:** User accounts, authentication, authorization, profile data

**Components:**
- User registration/login
- Profile management
- Emergency contacts storage
- Healthcare provider information
- Medication list management
- Privacy settings
- Data export controls

**Database Schema:**
```
users
├── user_id (PK)
├── email
├── password_hash
├── created_at
├── timezone
└── account_status

user_profiles
├── profile_id (PK)
├── user_id (FK)
├── preferred_name
├── ai_companion_name
├── diagnosis
├── date_of_birth
└── intake_tier (1-5)

emergency_contacts
├── contact_id (PK)
├── user_id (FK)
├── name
├── relationship
├── email
├── phone
└── when_to_call

healthcare_providers
├── provider_id (PK)
├── user_id (FK)
├── provider_type (psychiatrist/therapist/pcp)
├── name
├── practice
├── phone
├── email
└── next_appointment

medications
├── medication_id (PK)
├── user_id (FK)
├── name
├── dosage
├── frequency
├── prescribing_doctor
├── start_date
└── active (boolean)
```

**API Endpoints:**
- `POST /users/register`
- `POST /users/login`
- `GET /users/{user_id}/profile`
- `PUT /users/{user_id}/profile`
- `POST /users/{user_id}/emergency-contacts`
- `GET /users/{user_id}/emergency-contacts`
- `POST /users/{user_id}/medications`
- `GET /users/{user_id}/medications`

**Technology Stack:**
- Node.js/Express or Python/FastAPI
- PostgreSQL for user data
- JWT for authentication
- bcrypt for password hashing

---

### 2. **AI Context Injection Service**

**Responsibility:** Manage AI assistant configuration, personality settings, and knowledge database

**Components:**
- AI personality configuration (tone, pacing, communication style)
- Knowledge database population (tiered intake system)
- Protocol activation/deactivation
- Custom crisis language definitions
- AI learning tracking (what AI knows about user)

**Database Schema:**
```
ai_configurations
├── config_id (PK)
├── user_id (FK)
├── personality_tone (clinical/supportive/balanced)
├── pacing (brief/detailed/adaptive)
├── daily_affirmation_preference
├── topics_to_avoid (JSON array)
├── crisis_language_phrases (JSON array)
└── active_protocols (JSON array)

ai_knowledge_database
├── knowledge_id (PK)
├── user_id (FK)
├── category (diagnosis/triggers/coping_skills/patterns)
├── key
├── value
├── confidence_level (confirmed/inferred/uncertain/outdated)
├── learned_date
└── last_updated

therapeutic_frameworks_enabled
├── framework_id (PK)
├── user_id (FK)
├── framework_type (DBT/CBT/Schema/MBSR)
├── skills_practicing (JSON array)
├── skills_mastered (JSON array)
└── skills_to_learn (JSON array)
```

**API Endpoints:**
- `GET /ai-config/{user_id}` - Retrieve full AI configuration
- `PUT /ai-config/{user_id}/personality` - Update personality settings
- `POST /ai-config/{user_id}/knowledge` - Add knowledge entry
- `GET /ai-config/{user_id}/knowledge` - Retrieve knowledge database
- `PUT /ai-config/{user_id}/protocols` - Enable/disable protocols
- `POST /ai-config/{user_id}/crisis-language` - Add custom crisis phrases

**Technology Stack:**
- Node.js/Express or Python/FastAPI
- PostgreSQL for structured configuration
- MongoDB for flexible knowledge database (optional)
- Redis for caching frequently accessed configs

---

### 3. **Mood Tracking Service**

**Responsibility:** Real-time mood shift logging, daily baseline tracking, pattern storage

**Components:**
- Mood shift capture (timestamp, trigger, symptoms, functionality)
- Daily baseline (morning/evening check-ins)
- Functionality level tracking
- Physical symptom correlation
- Quick-log vs full-detail modes

**Database Schema:**
```
mood_shifts
├── shift_id (PK)
├── user_id (FK)
├── timestamp (with timezone)
├── previous_state
├── current_state
├── trigger
├── physical_symptoms (JSON array)
├── functionality_level (crisis/limited/functional/high)
├── activity
├── notes
└── logged_by (user/ai_prompt)

daily_baselines
├── baseline_id (PK)
├── user_id (FK)
├── date
├── wake_time
├── sleep_duration
├── bedtime_previous_night
├── how_woke_up (easy/struggled/energized/depressed)
├── morning_mood
├── morning_meds_taken (boolean)
├── morning_meds_time
├── evening_mood
├── evening_meds_taken (boolean)
├── evening_meds_time
└── total_shifts_count

rapid_cycling_days
├── day_id (PK)
├── user_id (FK)
├── date
├── total_states
├── avg_duration_minutes
├── crisis_states_count
├── functional_states_count
└── summary_notes
```

**API Endpoints:**
- `POST /mood/shift` - Log mood shift
- `GET /mood/shifts/{user_id}?start_date&end_date` - Retrieve mood history
- `POST /mood/baseline/morning` - Log morning baseline
- `POST /mood/baseline/evening` - Log evening baseline
- `GET /mood/patterns/{user_id}?period=week` - Get pattern analysis
- `GET /mood/rapid-cycling/{user_id}/{date}` - Get day summary

**Technology Stack:**
- Node.js/Express or Python/FastAPI
- PostgreSQL with TimescaleDB extension (time-series optimization)
- Redis for real-time state caching

---

### 4. **Episode Tracking Service**

**Responsibility:** Major psychiatric episode documentation (crises, hospitalizations, severe episodes)

**Components:**
- Episode creation (type, trigger, symptoms, interventions)
- Crisis timeline tracking
- Hospitalization records
- Medical intervention documentation
- Episode outcome tracking

**Database Schema:**
```
episodes
├── episode_id (PK)
├── user_id (FK)
├── start_timestamp
├── end_timestamp
├── episode_type (suicidal_crisis/severe_depression/mania/mixed/psychosis/hospitalization)
├── trigger
├── physical_symptoms (JSON array)
├── cognitive_symptoms (JSON array)
├── behavioral_symptoms (JSON array)
├── what_user_did (JSON array)
├── what_others_did (JSON array)
├── medical_intervention (boolean)
├── hospitalization (boolean)
├── hospital_name
├── duration_hours
├── how_ended
├── impact_on_daily_life
└── notes

crisis_interventions
├── intervention_id (PK)
├── episode_id (FK)
├── timestamp
├── intervention_type (called_988/emergency_contact/therapist/ER/skills_used)
├── who_helped
├── effectiveness_rating (1-10)
└── notes
```

**API Endpoints:**
- `POST /episodes` - Create episode record
- `PUT /episodes/{episode_id}` - Update episode (add end time, outcome)
- `GET /episodes/{user_id}?type&start_date&end_date` - Retrieve episodes
- `POST /episodes/{episode_id}/interventions` - Log intervention
- `GET /episodes/{user_id}/summary` - Crisis frequency summary

**Technology Stack:**
- Node.js/Express or Python/FastAPI
- PostgreSQL for episode records

---

### 5. **DBT Diary Card Service**

**Responsibility:** Conversational DBT tracking (emotions, target behaviors, skills used)

**Components:**
- Daily emotion intensity logging (0-5 scale)
- Target behavior tracking (urges vs acts)
- Skills usage logging
- PLEASE tracking (meds, sleep, eating, exercise)
- Weekly summary generation

**Database Schema:**
```
dbt_daily_entries
├── entry_id (PK)
├── user_id (FK)
├── date
├── sadness_intensity (0-5)
├── anxiety_intensity (0-5)
├── anger_intensity (0-5)
├── shame_intensity (0-5)
├── joy_intensity (0-5)
├── self_harm_urge_intensity (0-5)
├── self_harm_act (boolean)
├── suicidal_thought_intensity (0-5)
├── suicidal_plan (boolean)
├── meds_taken_as_prescribed (boolean)
├── sleep_hours
├── ate_regular_meals (boolean)
├── exercise_minutes
└── notes

dbt_skills_used
├── skill_use_id (PK)
├── entry_id (FK)
├── skill_category (distress_tolerance/emotion_regulation/interpersonal/mindfulness)
├── specific_skill (TIPP/STOP/DEAR_MAN/etc)
├── situation
├── effectiveness_rating (1-10)
└── notes
```

**API Endpoints:**
- `POST /dbt/daily` - Log daily DBT entry
- `GET /dbt/entries/{user_id}?start_date&end_date` - Retrieve entries
- `POST /dbt/skills` - Log skill usage
- `GET /dbt/skills/{user_id}?skill_category` - Get skills history
- `GET /dbt/weekly-summary/{user_id}` - Generate weekly report

**Technology Stack:**
- Node.js/Express or Python/FastAPI
- PostgreSQL for diary data

---

### 6. **Therapeutic Content Service**

**Responsibility:** Serve therapeutic framework content (DBT, CBT, Schema, MBSR skills)

**Components:**
- Skills library (categorized by framework and skill type)
- Conversational teaching protocols
- Context-based skill suggestions
- Skill effectiveness tracking
- User's personal skills library

**Database Schema:**
```
therapeutic_frameworks
├── framework_id (PK)
├── framework_name (DBT/CBT/Schema/MBSR)
├── description
└── source_references

skills_library
├── skill_id (PK)
├── framework_id (FK)
├── skill_category
├── skill_name
├── description
├── when_to_use
├── step_by_step_instructions (JSON array)
├── examples (JSON array)
└── contraindications

user_skills_learned
├── learned_id (PK)
├── user_id (FK)
├── skill_id (FK)
├── learned_date
├── practice_count
├── effectiveness_average (1-10)
├── status (learning/practicing/mastered)
└── notes
```

**API Endpoints:**
- `GET /therapeutic/frameworks` - List all frameworks
- `GET /therapeutic/skills?framework&category` - Get skills
- `GET /therapeutic/skills/{skill_id}` - Get skill details
- `POST /therapeutic/user-skills/{user_id}` - Add skill to user library
- `GET /therapeutic/user-skills/{user_id}` - Get user's learned skills
- `GET /therapeutic/suggest-skill?situation&emotion` - AI skill suggestion

**Technology Stack:**
- Node.js/Express or Python/FastAPI
- PostgreSQL for skills content
- Elasticsearch for skill search/recommendation (optional)

---

### 7. **Pattern Analysis Service**

**Responsibility:** AI-powered pattern recognition, weekly analysis, DSM-5 pattern detection

**Components:**
- Aggregate mood data analysis
- Trigger identification
- Cycle pattern detection (ultradian, PMDD correlation)
- Medication effectiveness correlation
- Warning sign detection
- Comorbidity pattern flagging

**Database Schema:**
```
pattern_analyses
├── analysis_id (PK)
├── user_id (FK)
├── analysis_date
├── period_start
├── period_end
├── total_mood_shifts
├── avg_shifts_per_day
├── crisis_frequency
├── identified_triggers (JSON array)
├── medication_correlation (JSON)
├── cycle_correlation (JSON)
├── warning_signs_detected (JSON array)
├── recommendations (JSON array)
└── ai_confidence_score (0-100)

pattern_flags
├── flag_id (PK)
├── user_id (FK)
├── flagged_date
├── pattern_type (potential_comorbidity/medication_side_effect/escalation_warning)
├── description
├── supporting_data (JSON)
├── severity (low/medium/high)
├── user_acknowledged (boolean)
└── provider_discussed (boolean)
```

**API Endpoints:**
- `POST /patterns/analyze/{user_id}?start_date&end_date` - Run analysis
- `GET /patterns/analyses/{user_id}` - Retrieve past analyses
- `GET /patterns/flags/{user_id}` - Get pattern flags
- `PUT /patterns/flags/{flag_id}/acknowledge` - User acknowledges flag
- `GET /patterns/triggers/{user_id}?frequency=top10` - Get common triggers
- `GET /patterns/medication-correlation/{user_id}` - Medication effectiveness

**Technology Stack:**
- Python/FastAPI (better ML libraries)
- PostgreSQL for pattern storage
- Python ML libraries (pandas, numpy, scikit-learn) for analysis
- Optional: OpenAI/Gemini API for advanced pattern analysis

---

### 8. **Export & Report Service**

**Responsibility:** Generate PDFs, provider reports, SSDI documentation

**Components:**
- PDF generation from tracking data
- Provider-specific report formatting (psychiatrist vs therapist vs disability)
- SSDI evidence compilation
- Custom date range exports
- Anonymized data for research (opt-in)

**Database Schema:**
```
export_jobs
├── job_id (PK)
├── user_id (FK)
├── export_type (pdf/psychiatrist_report/ssdi_doc)
├── requested_date
├── start_date
├── end_date
├── status (pending/processing/completed/failed)
├── file_url
└── expires_at

report_templates
├── template_id (PK)
├── template_name
├── template_type (psychiatrist/therapist/ssdi/personal)
├── description
├── sections_included (JSON array)
└── template_content
```

**API Endpoints:**
- `POST /export/pdf/{user_id}` - Request PDF export
- `POST /export/psychiatrist-report/{user_id}` - Generate provider report
- `POST /export/ssdi-documentation/{user_id}` - Generate SSDI package
- `GET /export/jobs/{job_id}` - Check export status
- `GET /export/download/{job_id}` - Download completed export
- `GET /export/templates` - List available report templates

**Technology Stack:**
- Node.js/Express or Python/FastAPI
- Pandoc or Puppeteer for PDF generation
- S3 for temporary file storage
- Scheduled cleanup jobs (exports expire after 7 days)

---

### 9. **Notification & Alert Service**

**Responsibility:** Crisis alerts, emergency contact notifications, medication reminders

**Components:**
- Email notification system
- SMS alerts (optional, Twilio integration)
- Emergency contact cascade
- Medication reminder scheduling
- Appointment reminder system
- Daily check-in prompts (configurable)

**Database Schema:**
```
notifications
├── notification_id (PK)
├── user_id (FK)
├── notification_type (crisis/medication/appointment/check_in)
├── sent_at
├── delivery_method (email/sms/in_app)
├── recipient
├── status (sent/failed/delivered)
└── content

alert_rules
├── rule_id (PK)
├── user_id (FK)
├── trigger_condition (crisis_detected/missed_meds/rapid_cycling_threshold)
├── notify_user (boolean)
├── notify_emergency_contacts (boolean)
├── emergency_contact_ids (JSON array)
├── active (boolean)
└── last_triggered

scheduled_reminders
├── reminder_id (PK)
├── user_id (FK)
├── reminder_type (medication/appointment/check_in)
├── schedule_time
├── recurrence (daily/weekly/once)
├── active (boolean)
└── last_sent
```

**API Endpoints:**
- `POST /notifications/send` - Send notification
- `GET /notifications/{user_id}` - Retrieve notification history
- `POST /alerts/rules/{user_id}` - Create alert rule
- `GET /alerts/rules/{user_id}` - Get user's alert rules
- `PUT /alerts/rules/{rule_id}` - Update alert rule
- `POST /reminders/{user_id}` - Schedule reminder
- `GET /reminders/{user_id}` - Get scheduled reminders

**Technology Stack:**
- Node.js/Express or Python/FastAPI
- PostgreSQL for notification tracking
- SendGrid or AWS SES for email
- Twilio for SMS (optional)
- Redis for job queue (scheduled reminders)

---

### 10. **Session Management Service**

**Responsibility:** Track user sessions, preserve conversation flow, manage AI context

**Components:**
- Session state management
- Session log preservation (append-only)
- Context switching (current state vs historical)
- Session snapshot creation
- Git-like version control for session history

**Database Schema:**
```
sessions
├── session_id (PK)
├── user_id (FK)
├── start_timestamp
├── end_timestamp
├── session_duration_minutes
├── mood_shifts_logged
├── skills_used
├── crisis_detected (boolean)
└── summary_notes

session_memory
├── memory_id (PK)
├── user_id (FK)
├── current_state (JSON - latest session context)
├── last_updated
└── version

session_logs
├── log_id (PK)
├── user_id (FK)
├── timestamp
├── session_snapshot (JSON - full session state at time)
├── day_number (e.g., "Day 22 Lamotrigine")
└── searchable_content (for grep-like search)
```

**API Endpoints:**
- `POST /sessions/start/{user_id}` - Start session
- `POST /sessions/end/{session_id}` - End session
- `GET /sessions/{user_id}/current` - Get current session memory
- `PUT /sessions/{user_id}/memory` - Update session memory
- `POST /sessions/{user_id}/snapshot` - Save session snapshot to log
- `GET /sessions/{user_id}/logs?search&date_range` - Search session history

**Technology Stack:**
- Node.js/Express or Python/FastAPI
- PostgreSQL for session data
- Elasticsearch for session log search (optional)
- Redis for current session state caching

---

### 11. **Medication Tracking Service**

**Responsibility:** Medication adherence, side effects, timing, effectiveness tracking

**Components:**
- Daily medication logging (taken/missed, time)
- Side effect documentation
- Medication changes timeline
- Effectiveness correlation with mood data
- Pharmacy information

**Database Schema:**
```
medication_logs
├── log_id (PK)
├── user_id (FK)
├── medication_id (FK)
├── date
├── scheduled_time
├── actual_time
├── taken (boolean)
├── missed_reason
└── notes

side_effects_log
├── effect_id (PK)
├── user_id (FK)
├── medication_id (FK)
├── date
├── side_effect
├── severity (1-10)
├── duration_hours
└── action_taken

medication_changes
├── change_id (PK)
├── user_id (FK)
├── medication_id (FK)
├── change_date
├── change_type (started/stopped/dose_increased/dose_decreased)
├── old_dose
├── new_dose
├── prescriber
├── reason
└── notes
```

**API Endpoints:**
- `POST /medications/log` - Log medication taken/missed
- `GET /medications/logs/{user_id}?date_range` - Get medication history
- `POST /medications/side-effects` - Log side effect
- `GET /medications/side-effects/{user_id}/{medication_id}` - Get side effects
- `POST /medications/changes` - Log medication change
- `GET /medications/adherence/{user_id}?period=month` - Adherence report

**Technology Stack:**
- Node.js/Express or Python/FastAPI
- PostgreSQL for medication data

---

### 12. **Specialized Tracker Service**

**Responsibility:** BPD trackers, menstrual/hormone tracking, routine tracking

**Components:**
- BPD abandonment fear tracking
- BPD emotional intensity tracking
- BPD relationship interaction logging
- Menstrual cycle tracking + mood correlation
- Morning/evening routine adherence

**Database Schema:**
```
bpd_abandonment_tracking
├── entry_id (PK)
├── user_id (FK)
├── timestamp
├── trigger_situation
├── fear_intensity (0-10)
├── physical_response
├── thought_patterns (JSON array)
├── behavior_response
├── reality_check_evidence (JSON)
└── outcome

bpd_emotional_intensity
├── entry_id (PK)
├── user_id (FK)
├── timestamp
├── emotion_type
├── intensity (0-10)
├── trigger
├── duration_minutes
├── physical_symptoms (JSON array)
├── coping_used
└── effectiveness (1-10)

menstrual_tracking
├── entry_id (PK)
├── user_id (FK)
├── date
├── cycle_day
├── flow_level (none/spotting/light/medium/heavy)
├── mood_correlation (JSON - mood states during cycle)
├── physical_symptoms (JSON array)
├── energy_level (1-10)
└── notes

routine_tracking
├── entry_id (PK)
├── user_id (FK)
├── date
├── routine_type (morning/evening)
├── completed_steps (JSON array)
├── skipped_steps (JSON array)
├── completion_percentage
└── notes
```

**API Endpoints:**
- `POST /trackers/bpd/abandonment` - Log abandonment fear episode
- `POST /trackers/bpd/emotional-intensity` - Log emotional intensity
- `POST /trackers/menstrual` - Log menstrual data
- `GET /trackers/menstrual/{user_id}/correlation` - Mood-cycle correlation
- `POST /trackers/routine` - Log routine completion
- `GET /trackers/routine/{user_id}/adherence` - Routine adherence stats

**Technology Stack:**
- Node.js/Express or Python/FastAPI
- PostgreSQL for specialized tracking data

---

## Proposed Directory Structure

```
sanctumtools-platform/
│
├── services/
│   ├── user-management/
│   │   ├── src/
│   │   ├── tests/
│   │   ├── Dockerfile
│   │   └── package.json
│   │
│   ├── ai-context/
│   │   ├── src/
│   │   ├── tests/
│   │   ├── Dockerfile
│   │   └── package.json
│   │
│   ├── mood-tracking/
│   │   ├── src/
│   │   ├── tests/
│   │   ├── Dockerfile
│   │   └── package.json
│   │
│   ├── episode-tracking/
│   │   ├── src/
│   │   ├── tests/
│   │   ├── Dockerfile
│   │   └── package.json
│   │
│   ├── dbt-diary/
│   │   ├── src/
│   │   ├── tests/
│   │   ├── Dockerfile
│   │   └── package.json
│   │
│   ├── therapeutic-content/
│   │   ├── src/
│   │   ├── content/ (DBT, CBT, Schema, MBSR markdown)
│   │   ├── tests/
│   │   ├── Dockerfile
│   │   └── package.json
│   │
│   ├── pattern-analysis/
│   │   ├── src/
│   │   ├── tests/
│   │   ├── Dockerfile
│   │   └── requirements.txt (Python)
│   │
│   ├── export-reports/
│   │   ├── src/
│   │   ├── templates/
│   │   ├── tests/
│   │   ├── Dockerfile
│   │   └── package.json
│   │
│   ├── notifications/
│   │   ├── src/
│   │   ├── tests/
│   │   ├── Dockerfile
│   │   └── package.json
│   │
│   ├── session-management/
│   │   ├── src/
│   │   ├── tests/
│   │   ├── Dockerfile
│   │   └── package.json
│   │
│   ├── medication-tracking/
│   │   ├── src/
│   │   ├── tests/
│   │   ├── Dockerfile
│   │   └── package.json
│   │
│   └── specialized-trackers/
│       ├── src/
│       ├── tests/
│       ├── Dockerfile
│       └── package.json
│
├── frontend/
│   ├── web-app/
│   │   ├── public/
│   │   ├── src/
│   │   │   ├── components/
│   │   │   ├── pages/
│   │   │   ├── api/
│   │   │   └── utils/
│   │   ├── Dockerfile
│   │   └── package.json
│   │
│   └── ai-chat-interface/
│       ├── src/
│       ├── Dockerfile
│       └── package.json
│
├── shared/
│   ├── database/
│   │   ├── migrations/
│   │   └── seeds/
│   │
│   ├── schemas/
│   │   └── api-contracts.yaml (OpenAPI spec)
│   │
│   └── utils/
│       ├── timestamp-validator.js
│       ├── crisis-detector.js
│       └── pattern-matcher.js
│
├── infrastructure/
│   ├── terraform/
│   │   ├── vpc.tf
│   │   ├── ec2.tf
│   │   ├── rds.tf
│   │   ├── s3.tf
│   │   └── elasticache.tf
│   │
│   ├── docker-compose.yml (local development)
│   ├── docker-compose.prod.yml (production)
│   └── nginx/
│       └── nginx.conf (reverse proxy config)
│
├── docs/
│   ├── api/
│   │   └── API_DOCUMENTATION.md
│   ├── deployment/
│   │   ├── AWS_SETUP_GUIDE.md
│   │   └── SCALING_GUIDE.md
│   └── development/
│       └── LOCAL_SETUP.md
│
├── scripts/
│   ├── deploy.sh
│   ├── migrate.sh
│   └── seed-therapeutic-content.sh
│
├── .github/
│   └── workflows/
│       ├── ci.yml
│       └── deploy.yml
│
├── .env.example
├── .gitignore
├── README.md
└── LICENSE
```

---

## Service Dependencies Map

```
┌─────────────────────────────────────────────────────────────┐
│                         FRONTEND                            │
│                   (Web App + AI Chat UI)                    │
└──────────────┬──────────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────────┐
│                     API GATEWAY / NGINX                     │
│                   (Reverse Proxy + Load Balancer)           │
└──────────────┬──────────────────────────────────────────────┘
               │
     ┌─────────┴──────────┬───────────────────┬────────────────┐
     ▼                    ▼                   ▼                ▼
┌──────────┐      ┌──────────────┐    ┌─────────────┐  ┌──────────────┐
│   User   │      │  AI Context  │    │    Mood     │  │   Episode    │
│Management│◄─────┤   Injection  │◄───┤  Tracking   │  │  Tracking    │
└────┬─────┘      └──────┬───────┘    └─────┬───────┘  └──────┬───────┘
     │                   │                   │                 │
     └───────────────────┴───────────────────┴─────────────────┘
                              │
                 ┌────────────┴───────────────────┬──────────────┐
                 ▼                                ▼              ▼
         ┌──────────────┐              ┌────────────────┐  ┌──────────┐
         │   Pattern    │              │   Therapeutic  │  │   DBT    │
         │   Analysis   │              │    Content     │  │  Diary   │
         └──────┬───────┘              └────────┬───────┘  └────┬─────┘
                │                               │               │
     ┌──────────┴──────────┬───────────────────┴───────────────┘
     ▼                     ▼                   ▼
┌──────────┐      ┌────────────────┐   ┌─────────────────┐
│  Export  │      │  Notification  │   │    Session      │
│ Reports  │      │    & Alerts    │   │   Management    │
└──────────┘      └────────────────┘   └─────────────────┘
     │                     │                   │
     └──────────┬──────────┴───────────────────┘
                ▼
     ┌─────────────────────┐
     │    Medication       │
     │     Tracking        │
     └──────────┬──────────┘
                │
                ▼
     ┌─────────────────────┐
     │   Specialized       │
     │    Trackers         │
     └─────────────────────┘

SHARED RESOURCES:
┌─────────────┐    ┌──────────┐    ┌─────────┐
│ PostgreSQL  │    │  Redis   │    │   S3    │
│  (Primary   │    │ (Cache)  │    │ (Files) │
│  Database)  │    │          │    │         │
└─────────────┘    └──────────┘    └─────────┘
```

**Key Dependencies:**

1. **User Management** ← Core dependency for all services (authentication)
2. **AI Context Injection** ← Used by Mood Tracking, Episode Tracking, Pattern Analysis
3. **Mood Tracking** → Feeds Pattern Analysis, Export Reports
4. **Episode Tracking** → Feeds Pattern Analysis, Export Reports
5. **Pattern Analysis** → Consumes Mood + Episode data, produces insights
6. **Therapeutic Content** ← Read-only service, minimal dependencies
7. **Notification** ← Triggered by Pattern Analysis (crisis detection), Session Management (reminders)
8. **Export Reports** → Aggregates data from Mood, Episode, DBT, Medication, Specialized Trackers
9. **Session Management** ← Coordinates with all tracking services

---

## Database Schema Separation Strategy

### Option 1: Single Database, Schema Separation (Recommended for MVP)

**Approach:** Use PostgreSQL with separate schemas for each service

```
sanctumtools_db
├── schema: user_management
│   ├── users
│   ├── user_profiles
│   ├── emergency_contacts
│   └── healthcare_providers
│
├── schema: ai_context
│   ├── ai_configurations
│   ├── ai_knowledge_database
│   └── therapeutic_frameworks_enabled
│
├── schema: mood_tracking
│   ├── mood_shifts
│   ├── daily_baselines
│   └── rapid_cycling_days
│
├── schema: episode_tracking
│   ├── episodes
│   └── crisis_interventions
│
├── schema: dbt_diary
│   ├── dbt_daily_entries
│   └── dbt_skills_used
│
├── schema: pattern_analysis
│   ├── pattern_analyses
│   └── pattern_flags
│
├── schema: medications
│   ├── medications (FK to users)
│   ├── medication_logs
│   ├── side_effects_log
│   └── medication_changes
│
└── schema: specialized_trackers
    ├── bpd_abandonment_tracking
    ├── bpd_emotional_intensity
    ├── menstrual_tracking
    └── routine_tracking
```

**Pros:**
- Easier to manage initially
- Simpler backup/restore
- Cross-service queries possible
- Lower infrastructure cost

**Cons:**
- Harder to scale individual services
- Single point of failure
- Schema coupling

### Option 2: Database Per Service (Future Scaling)

**Approach:** Each service has its own PostgreSQL database

```
user_management_db
ai_context_db
mood_tracking_db
episode_tracking_db
dbt_diary_db
pattern_analysis_db
medications_db
specialized_trackers_db
```

**Pros:**
- True service independence
- Can scale databases individually
- Technology flexibility (use MongoDB for AI context, TimescaleDB for mood data)
- Better fault isolation

**Cons:**
- No cross-database joins (must use APIs)
- More complex infrastructure
- Higher cost
- Distributed transaction challenges

**Recommendation:** Start with Option 1 (single DB, schema separation) for MVP, migrate to Option 2 when scaling demands it.

---

## API Boundary Definitions

### Inter-Service Communication Strategy

**Protocol:** RESTful APIs with JSON for synchronous, Message Queue for asynchronous

### Service-to-Service APIs (Internal)

**Authentication:** Service-to-service JWT tokens (different from user tokens)

**Example: Pattern Analysis calling Mood Tracking**

```
GET /internal/mood/shifts/{user_id}?start_date=2025-10-01&end_date=2025-11-01
Authorization: Bearer <service_token>

Response:
{
  "user_id": "uuid",
  "shifts": [
    {
      "shift_id": "uuid",
      "timestamp": "2025-10-15T12:00:00Z",
      "previous_state": "functional",
      "current_state": "crisis",
      "trigger": "work stress",
      ...
    }
  ],
  "total_count": 142
}
```

### Public APIs (Frontend → Backend)

**Authentication:** User JWT tokens from User Management service

**Example: Frontend logging mood shift**

```
POST /api/v1/mood/shift
Authorization: Bearer <user_token>
Content-Type: application/json

{
  "timestamp": "2025-11-06T20:50:00Z",
  "previous_state": "functional",
  "current_state": "anxious",
  "trigger": "phone call",
  "physical_symptoms": ["racing heart", "shallow breathing"],
  "functionality_level": "limited",
  "activity": "working on computer"
}

Response:
{
  "shift_id": "uuid",
  "message": "Mood shift logged successfully",
  "quick_response_suggested": "Would you like to log this with the quick template?"
}
```

### Asynchronous Communication (Message Queue)

**Use Cases:**
- Pattern Analysis triggered after X mood shifts logged
- Notification sent when crisis detected
- PDF export job queued
- Weekly summary generation

**Technology:** Redis Pub/Sub or AWS SQS

**Example: Crisis Detected Event**

```
Topic: crisis.detected
Payload:
{
  "user_id": "uuid",
  "timestamp": "2025-11-06T20:50:00Z",
  "crisis_type": "suicidal_ideation",
  "severity": "high",
  "emergency_contacts": ["uuid1", "uuid2"]
}

Subscribers:
- Notification Service (sends alerts)
- Episode Tracking Service (auto-creates episode record)
- Session Management Service (flags session as crisis)
```

---

## Deployment Architecture for AWS EC2

### Multi-Container EC2 Setup

**Approach:** Run all microservices on single EC2 instance initially, scale to multiple instances as needed

### EC2 Instance Configuration

**Instance Type:** t3.medium (2 vCPU, 4 GB RAM) for MVP
**Scaling Target:** t3.large or multiple instances

**Docker Compose Stack:**

```yaml
version: '3.8'

services:
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf
    depends_on:
      - user-management
      - mood-tracking
      # ... other services

  user-management:
    build: ./services/user-management
    environment:
      - DATABASE_URL=postgresql://user:pass@postgres:5432/sanctumtools
      - JWT_SECRET=${JWT_SECRET}
    depends_on:
      - postgres
      - redis

  ai-context:
    build: ./services/ai-context
    environment:
      - DATABASE_URL=postgresql://user:pass@postgres:5432/sanctumtools
    depends_on:
      - postgres

  mood-tracking:
    build: ./services/mood-tracking
    environment:
      - DATABASE_URL=postgresql://user:pass@postgres:5432/sanctumtools
    depends_on:
      - postgres
      - redis

  pattern-analysis:
    build: ./services/pattern-analysis
    environment:
      - DATABASE_URL=postgresql://user:pass@postgres:5432/sanctumtools
      - OPENAI_API_KEY=${OPENAI_API_KEY}
    depends_on:
      - postgres

  export-reports:
    build: ./services/export-reports
    environment:
      - DATABASE_URL=postgresql://user:pass@postgres:5432/sanctumtools
      - S3_BUCKET=${S3_BUCKET}
      - AWS_ACCESS_KEY=${AWS_ACCESS_KEY}
    depends_on:
      - postgres

  notifications:
    build: ./services/notifications
    environment:
      - DATABASE_URL=postgresql://user:pass@postgres:5432/sanctumtools
      - SENDGRID_API_KEY=${SENDGRID_API_KEY}
    depends_on:
      - postgres
      - redis

  frontend:
    build: ./frontend/web-app
    environment:
      - API_BASE_URL=http://nginx
    depends_on:
      - nginx

  postgres:
    image: postgres:15-alpine
    environment:
      - POSTGRES_DB=sanctumtools
      - POSTGRES_USER=${DB_USER}
      - POSTGRES_PASSWORD=${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./shared/database/migrations:/docker-entrypoint-initdb.d

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
```

### Infrastructure Components

**1. EC2 Instance**
- Amazon Linux 2 or Ubuntu 22.04
- Docker + Docker Compose installed
- Security groups: 80, 443, 22 (SSH)
- Elastic IP attached

**2. RDS PostgreSQL (Alternative to containerized Postgres)**
- Better for production (backups, high availability)
- db.t3.micro for MVP
- Multi-AZ for production

**3. ElastiCache Redis (Alternative to containerized Redis)**
- Better performance for production
- cache.t3.micro for MVP

**4. S3 Bucket**
- PDF export storage
- User uploaded files
- Static assets for frontend

**5. Route 53 (DNS)**
- Domain: sanctumtools.com
- SSL via AWS Certificate Manager

**6. CloudWatch**
- Application logs
- Performance metrics
- Alerts for service failures

---

## Scaling Strategy

### Phase 1: MVP (Single EC2 Instance)

**Users:** 1-100
**Architecture:** All services on one EC2 instance via Docker Compose
**Database:** Single PostgreSQL database with schema separation
**Cost:** ~$50-100/month

### Phase 2: Horizontal Scaling (Multiple EC2 Instances)

**Users:** 100-1,000
**Architecture:**
- Load balancer (ALB) distributing traffic
- 2-3 EC2 instances running identical service stacks
- RDS PostgreSQL (not containerized)
- ElastiCache Redis (not containerized)

**Cost:** ~$200-400/month

### Phase 3: Service Separation (Dedicated Instances Per Service)

**Users:** 1,000-10,000
**Architecture:**
- Each microservice on dedicated EC2 instance (or ECS cluster)
- Auto-scaling groups per service
- Database per service (if needed)
- API Gateway for routing

**Cost:** ~$800-1,500/month

### Phase 4: Kubernetes/ECS (Enterprise Scale)

**Users:** 10,000+
**Architecture:**
- EKS (Kubernetes) or ECS Fargate
- Service mesh (Istio)
- Multi-region deployment
- Advanced caching (CloudFront)

**Cost:** $2,000+/month

---

## Development Workflow

### Local Development Setup

1. Clone repository
2. Copy `.env.example` to `.env` and configure
3. Run `docker-compose up` (local development compose file)
4. Services available at `localhost:<port>`
5. Hot-reload enabled for development

### CI/CD Pipeline (GitHub Actions)

**On Pull Request:**
- Run linters
- Run unit tests
- Run integration tests
- Build Docker images (no push)

**On Merge to Main:**
- Run full test suite
- Build and tag Docker images
- Push to Docker Hub or AWS ECR
- Deploy to staging environment

**On Release Tag:**
- Deploy to production EC2
- Run smoke tests
- Notify team

---

## Security Considerations

### Authentication & Authorization

**User Authentication:**
- JWT tokens with short expiration (15 minutes)
- Refresh tokens with longer expiration (7 days)
- Password hashing with bcrypt (cost factor 12)

**Service-to-Service:**
- Internal API keys or service tokens
- Rate limiting per service

### Data Encryption

**At Rest:**
- PostgreSQL encryption (RDS encryption if using AWS RDS)
- S3 bucket encryption

**In Transit:**
- HTTPS only (SSL certificates via Let's Encrypt or AWS ACM)
- TLS for database connections

### Privacy Compliance

**HIPAA Considerations:**
- User data isolation
- Audit logging (who accessed what, when)
- Data retention policies
- User data deletion capability (GDPR right to be forgotten)

**Sensitive Data:**
- Emergency contact info
- Healthcare provider info
- Crisis history
- Medication details
- Therapeutic tracking data

**Access Control:**
- Users can only access their own data
- Emergency contacts can access during crisis (with user permission)
- Healthcare providers can access with user permission

---

## Migration Plan from Current Structure

### Step 1: Content Migration

**Therapeutic Frameworks:**
- Move `/frameworks/*.md` to `services/therapeutic-content/content/`
- Convert markdown to structured JSON for API serving
- Seed database with skills library

**Templates:**
- Move `/templates/*.md` to respective service `templates/` directories
- Convert to frontend components or API response templates

### Step 2: Protocol Extraction

**AI Assistant Protocols:**
- Extract protocols from `AI_ASSISTANT_SETUP_GUIDE.md`
- Implement as service logic in `ai-context` service
- Create API endpoints for protocol activation/configuration

**Pattern Recognition:**
- Extract from `ai_dsm5_pattern_recognition.md`
- Implement in `pattern-analysis` service as ML models or rule-based system

### Step 3: Database Design

**Schema Creation:**
- Write migration scripts for all 12 services
- Seed therapeutic content
- Create test data

### Step 4: Service Implementation

**Priority Order:**
1. User Management (foundational)
2. Mood Tracking (core feature)
3. AI Context Injection (differentiator)
4. Session Management (user experience)
5. DBT Diary (key offering)
6. Therapeutic Content (read-only, easier)
7. Pattern Analysis (complex, but high value)
8. Notifications (safety critical)
9. Episode Tracking (important for crisis)
10. Export Reports (provider value)
11. Medication Tracking (health integration)
12. Specialized Trackers (nice-to-have)

### Step 5: Frontend Development

**UI Components:**
- Dashboard (mood timeline visualization)
- Quick mood shift logger
- Conversational AI chat interface
- DBT diary card (conversational form)
- Reports viewer (psychiatrist/SSDI exports)

### Step 6: Integration Testing

**End-to-End Scenarios:**
- User signs up → completes intake → logs first mood shift
- User experiences crisis → AI detects → emergency contact notified
- User logs mood for week → pattern analysis runs → generates insights
- User requests SSDI report → export service generates PDF

### Step 7: Deployment

**Staging:** Deploy to test EC2 instance
**Production:** Deploy to production EC2 with monitoring
**Beta Testing:** Melanie as first user (dogfooding SanctumTools with Jazmine)

---

## Cost Estimates

### AWS Monthly Costs (MVP - Phase 1)

| Service | Configuration | Monthly Cost |
|---------|--------------|--------------|
| EC2 | t3.medium (2 vCPU, 4GB RAM) | $30 |
| RDS PostgreSQL | db.t3.micro (optional) | $15 |
| ElastiCache Redis | cache.t3.micro (optional) | $12 |
| S3 | 10GB storage + requests | $5 |
| Data Transfer | 50GB/month | $5 |
| Route 53 | 1 hosted zone | $1 |
| CloudWatch | Logs + metrics | $10 |
| **Total (containerized DB)** | | **~$51/month** |
| **Total (managed DB)** | | **~$78/month** |

### Development Costs

| Resource | Estimated Hours | Rate | Total |
|----------|----------------|------|-------|
| Backend development | 400 hours | $75/hr | $30,000 |
| Frontend development | 200 hours | $75/hr | $15,000 |
| Database design | 40 hours | $75/hr | $3,000 |
| DevOps/Infrastructure | 60 hours | $75/hr | $4,500 |
| Testing & QA | 80 hours | $50/hr | $4,000 |
| **Total Development** | | | **$56,500** |

**Alternate Approach:** Melanie + JC build incrementally (sweat equity)

---

## Technology Stack Recommendations

### Backend Services

**Option 1: Node.js + Express (Recommended)**
- Pros: Fast development, large ecosystem, JavaScript everywhere
- Cons: Less mature ML libraries (use Python for pattern-analysis service)

**Option 2: Python + FastAPI**
- Pros: Excellent ML libraries, async support, automatic API docs
- Cons: Slower than Node for I/O-heavy operations

**Recommendation:** Node.js for most services, Python for pattern-analysis

### Frontend

**Option 1: React + Next.js (Recommended)**
- Pros: Large community, SSR support, great developer experience
- Cons: Complexity for simple apps

**Option 2: Vue.js + Nuxt**
- Pros: Easier learning curve, good documentation
- Cons: Smaller ecosystem

**Recommendation:** React + Next.js (Melanie/JC likely familiar)

### Database

**PostgreSQL 15** (required for all services)
- Schema separation for MVP
- Consider TimescaleDB extension for mood_tracking (time-series optimization)

### Caching

**Redis 7**
- Session state
- Job queues
- Real-time data caching

### Message Queue

**Redis Pub/Sub** (MVP)
**AWS SQS** (production scaling)

### Monitoring

**CloudWatch** (AWS native)
**Sentry** (error tracking)
**LogRocket** (frontend session replay)

---

## Risks & Mitigation Strategies

### Risk 1: Scope Creep

**Risk:** 17 systems is a LOT to build
**Mitigation:**
- Phase development (MVP = 6 core services)
- Use existing markdown content as templates
- Focus on Melanie's use case first (dogfooding)

### Risk 2: Database Performance

**Risk:** Single database becomes bottleneck
**Mitigation:**
- Start with schema separation (easier to migrate later)
- Use read replicas if needed
- Implement caching aggressively
- Monitor query performance from day 1

### Risk 3: AI Integration Complexity

**Risk:** AI context injection is novel, may be hard to implement
**Mitigation:**
- Start with simple prompt injection (concatenate context to messages)
- Use existing AI APIs (OpenAI, Anthropic) instead of hosting models
- Prototype AI flows before full implementation

### Risk 4: HIPAA Compliance

**Risk:** Handling sensitive health data requires compliance
**Mitigation:**
- Implement encryption early
- Audit logging from day 1
- User data deletion capability
- Consult with compliance expert before production launch

### Risk 5: User Adoption

**Risk:** Complex product may intimidate users
**Mitigation:**
- Onboarding flow (5 questions only)
- AI-guided setup (conversational, not forms)
- Beta testing with Melanie first
- Iteration based on real user feedback

---

## Success Metrics

### MVP Success Criteria

**Technical:**
- All 6 core services deployed and communicating
- User can sign up, complete intake, log mood shifts
- AI context injection working (protocols execute correctly)
- Data persists correctly in PostgreSQL
- PDF export generates valid reports

**User Experience:**
- Melanie successfully uses Jazmine (SanctumTools beta) for 1 week
- Conversational mood tracking works (no form anxiety)
- Mood-cycling patterns detected and reported
- Emergency contact notification fires correctly in crisis scenario

**Business:**
- Product can scale to 10 beta users without performance issues
- Infrastructure costs under $100/month
- Codebase documented enough for JC to contribute

---

## Next Steps

### Immediate Actions (Week 1)

1. **Decision:** Confirm microservices architecture approach
2. **Decision:** Confirm single-DB vs multi-DB for MVP
3. **Setup:** Create GitHub repository structure
4. **Setup:** Initialize first 3 services (User Management, Mood Tracking, AI Context)
5. **Database:** Design PostgreSQL schemas for core services
6. **DevOps:** Set up local Docker Compose development environment

### Sprint 1 (Weeks 2-3)

1. Implement User Management service (registration, login, profile)
2. Implement Mood Tracking service (shift logging, baselines)
3. Create basic frontend (signup, login, mood logger)
4. Database migrations for user + mood schemas
5. End-to-end test: User signs up → logs mood shift

### Sprint 2 (Weeks 4-5)

1. Implement AI Context Injection service
2. Implement Session Management service
3. Frontend: AI chat interface
4. Integration: Mood shift triggers AI response with context
5. End-to-end test: Conversational mood tracking works

### Sprint 3 (Weeks 6-7)

1. Implement Pattern Analysis service (basic rules-based)
2. Implement Notification service
3. Frontend: Pattern insights display
4. Crisis detection logic
5. End-to-end test: Crisis detected → alert sent

### Sprint 4 (Weeks 8-9)

1. Implement Export Reports service
2. PDF generation for mood data
3. Frontend: Reports page
4. Deploy to staging EC2
5. End-to-end test: User generates psychiatrist report

### Sprint 5 (Weeks 10-11)

1. Implement DBT Diary service
2. Frontend: Conversational DBT diary
3. Beta testing with Melanie (dogfooding Jazmine)
4. Bug fixes and refinements

### Sprint 6 (Week 12)

1. Production deployment to EC2
2. Monitoring and alerting setup
3. Documentation for beta users
4. Invite first external beta testers (if ready)

---

## Conclusion

SanctumTools has **exceptional modularization potential**. The product naturally separates into 12 independent microservices with clear boundaries and responsibilities.

**Recommended Approach:**

1. **Start small:** MVP with 6 core services (User, Mood, AI Context, Session, DBT, Notifications)
2. **Single database:** PostgreSQL with schema separation (easier to manage initially)
3. **Docker Compose:** All services on single EC2 instance for MVP
4. **Iterate:** Add remaining services based on user feedback and demand
5. **Scale strategically:** Move to multi-instance, then service-dedicated instances, then Kubernetes only when needed

**Key Advantages of This Architecture:**

- Each service can be developed, tested, and deployed independently
- Services can scale independently based on load
- Clear API boundaries make the system maintainable
- Microservices align with the 17 systems breakdown (8 automatic, 9 opt-in)
- AWS EC2 deployment is straightforward with Docker Compose
- Migration path from MVP to enterprise scale is clear

**Timeline:** 12-week MVP if full-time development, or incremental build with Melanie + JC as sweat equity over 6+ months.

---

**Ready to begin implementation when you are.**
