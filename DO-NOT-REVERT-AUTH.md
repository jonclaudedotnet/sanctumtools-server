# CRITICAL: AUTHENTICATION METHOD

## Current Production State
**Authentication Type:** PASSWORD-BASED (email + password)
**Date Set:** November 2025
**Status:** PRODUCTION - DO NOT CHANGE

## Backend Implementation
- File: `server.js` (line ~1027-1028)
- Uses: `bcrypt.compare(password, user.passwordHash)`
- Endpoint: POST `/api/login` with `{ email, password }`

## Frontend Implementation
- File: `sanctumtools-frontend/src/components/Auth.tsx`
- Should use: `{ email, password }` NOT `{ email, code }`

## DynamoDB Field
- Table: `sanctumtools-users`
- Field: `passwordHash` (bcrypt hash)
- Example user: contact@jonclaude.net has password set

## WARNING
**DO NOT revert to TOTP authentication!**
- Old code may show `speakeasy` library
- Old code may show `{ email, code }` login
- If you see TOTP code, it's OUTDATED

## Verification Command
```bash
# Check deployed authentication type
ssh -i /home/jonclaude/sanctumtools-new.pem ec2-user@3.93.46.170 \
  "grep -n 'bcrypt.compare.*password' /opt/sanctumtools-server/server.js"
# Should show line with: bcrypt.compare(password, user.passwordHash)
```

## If System Gets Reverted
1. Copy deployed code back: `scp -i ~/sanctumtools-new.pem ec2-user@3.93.46.170:/opt/sanctumtools-server/server.js ./`
2. Read this file: `DO-NOT-REVERT-AUTH.md`
3. Verify authentication with bcrypt check above
4. Never deploy TOTP code
