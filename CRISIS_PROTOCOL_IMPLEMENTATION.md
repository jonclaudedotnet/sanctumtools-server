# Crisis Protocol Implementation

## Overview
This document describes the comprehensive crisis detection and safety protocol system implemented for SanctumTools, compliant with the specifications in `AI_ASSISTANT_SETUP_GUIDE.md`.

## Key Principle
**Crisis detection OVERRIDES ALL other settings, preferences, and processing.**

## Implementation Components

### 1. Crisis Detection Function (`detectCrisisKeywords`)
- Comprehensive keyword detection including:
  - Direct suicide/self-harm indicators
  - High-intensity mood ratings (8-10) combined with crisis words
  - Pattern-based detection for phrases with variations
  - Word-boundary checking for abbreviations like "OD"

### 2. DynamoDB Crisis Events Table
- **Table Name:** `sanctumtools-crisis-events`
- **Primary Key:** email (partition) + timestamp (sort)
- **TTL:** 90 days auto-deletion for privacy
- **Fields:**
  - email
  - timestamp
  - message (truncated for privacy)
  - detected_keywords
  - response_given
  - user_confirmed_safe
  - safety_confirmed_at

### 3. Crisis Response Flow

#### When Crisis Detected:
1. **STOP** all other processing immediately
2. **LOG** crisis event to DynamoDB
3. **SEND** fixed 988 response:
   ```
   I'm very concerned about your safety. Please call or text 988 right now.
   The 988 Suicide & Crisis Lifeline is available 24/7.
   ```
4. **INCLUDE** emergency contacts if available in user profile
5. **SET** session flag for follow-up questions
6. **RETURN** immediately - no other processing

#### Safety Assessment Follow-up:
After crisis response, the system asks:
- "Are you safe right now?"
- "Have you called 988 or reached out for help?"
- "Do you have someone with you?"
- "Can you tell me where you are?"

#### When User Confirms Safety:
- Update crisis event record with confirmation
- Clear session crisis flags
- Return to normal conversation with supportive message

## Testing

### Test Suite Results
- **18 test cases** covering crisis and non-crisis scenarios
- **100% pass rate** after refinements
- Tests include edge cases and false positive prevention

### Crisis-Triggering Messages (Examples):
- "I want to kill myself" ✅
- "I'm going to hurt myself" ✅
- "There's no point living anymore" ✅
- "I'm feeling extremely depressed, maybe a 10" ✅

### Non-Crisis Messages (Examples):
- "I feel really sad" ❌
- "I'm anxious about my presentation" ❌
- "My mood is a 3 today" ❌
- "I'm feeling down today" ❌

## Integration Points

### Chat Endpoint (`/api/chat`)
1. Crisis detection happens **FIRST** before any other processing
2. Crisis response bypasses all normal chat logic
3. Session tracking enables multi-message crisis handling
4. All crisis events are logged for safety tracking

### Session Management
- `req.session.lastMessageWasCrisis` - tracks crisis state
- `req.session.lastCrisisTime` - timestamps for updating records

## Compliance

### AI_ASSISTANT_SETUP_GUIDE.md Requirements Met:
- ✅ Crisis detection overrides ALL other settings
- ✅ Immediate 988 referral for self-harm/suicide
- ✅ No therapy attempts during crisis
- ✅ Direct, firm safety-focused communication
- ✅ Safety assessment follow-up questions
- ✅ Crisis event logging and tracking
- ✅ Emergency contact integration capability

## Important Notes

### What This System Does:
- Detects crisis keywords reliably
- Provides immediate 988 referral
- Logs events for safety tracking
- Follows up to ensure user safety
- Returns to normal chat only after safety confirmed

### What This System Does NOT Do:
- Attempt therapy during crisis
- Make assumptions about user's state
- Provide creative or varied crisis responses
- Continue normal processing during crisis
- Ignore safety concerns for user preferences

## Files Modified
- `server.js` - Main implementation
- `test-crisis-detection.js` - Test suite

## Database Requirements
- DynamoDB table: `sanctumtools-crisis-events`
- Auto-created on server startup if doesn't exist

## Monitoring & Alerts
Crisis events are logged with:
- `[CRISIS DETECTED]` prefix in console
- Full keyword detection details
- Timestamp and user identification

## Future Enhancements
- Integration with emergency contact notifications
- Analytics dashboard for crisis patterns
- Integration with local crisis resources by location
- Multi-language crisis detection

---

**Remember:** This is a life-safety critical system. The crisis protocol is NON-NEGOTIABLE and must ALWAYS take priority over all other system functions.