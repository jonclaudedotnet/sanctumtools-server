# Lifeline Email System

**Purpose:** Emergency notification system for when you are in crisis and need immediate human contact.

---

## Email Template

**Subject:** Could you check in on [USER]?

**Body:**

Hey,

[USER] might have reached out already, but just in case—could you give them a call or text when you get a chance? They're having a rough time and could really use someone to talk to.

Sent: {DATE} at {TIME}

Thanks

---

## Emergency Contact List

**Configure your priority order:**
1. [Emergency Contact 1]: [phone/email]
2. [Emergency Contact 2]: [phone/email]
3. [Emergency Contact 3]: [phone/email]
4. [Emergency Contact 4]: [phone/email]
5. [Emergency Contact 5]: [phone/email]

---

## When to Use

Send lifeline email when:
- Suicidal ideation is active
- Can't reach primary support person
- Need multiple people notified quickly
- Having trouble communicating clearly due to crisis state
- Know you need help but can't articulate it

---

## How to Trigger

**Command:** (To be implemented)
```
[AI], send lifeline email
```

This will:
1. Send the template email to all emergency contacts
2. Log the time it was sent
3. Confirm who was notified

---

## Setup Required

- Gmail SMTP or API access
- Stored emergency contact emails
- Secure credential storage
- Command-line email capability

**Status:** Template created, implementation pending
