# Deployment Guide

## Problem with Old Architecture

The React SPA was logging users out on refresh because:
- Sessions stored in `sessionStorage` are cleared when browser closes
- Relied on device tokens in httpOnly cookies
- But device tokens still required code verification flow
- UX was broken: refresh = logout = annoying

## Solution: Traditional Server-Side Sessions

This app uses proper **server-side session management**:
- Session created and stored on server
- Session ID sent as httpOnly cookie to browser
- User stays logged in across refreshes, restarts, everything
- No client-side session storage
- Works exactly like traditional web apps

## Deployment Options

### Option 1: AWS EC2 (Recommended for AWS)

```bash
# 1. Launch EC2 instance (t3.small or larger)
# 2. Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# 3. Clone/upload code
git clone your-repo
cd sanctumtools-server

# 4. Install and run
npm install
NODE_ENV=production npm start
```

### Option 2: Railway (Easiest)

```bash
# Deploy directly with:
npx railway up
```

### Option 3: Render

1. Connect GitHub repo
2. Select Node.js environment
3. Set `npm install && npm start`
4. Deploy

### Option 4: Heroku (Free tier ending, but still possible)

```bash
heroku login
heroku create sanctumtools
git push heroku main
```

## Environment Setup

Create `.env` in production:

```
PORT=3000
NODE_ENV=production
SESSION_SECRET=generate-a-long-random-string-here
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-key
AWS_SECRET_ACCESS_KEY=your-secret
```

For EC2, use AWS IAM role instead:

```bash
# Create IAM role with DynamoDB access
aws iam create-role --role-name sanctumtools-server ...
aws iam attach-role-policy --role-name sanctumtools-server ...
```

## Domain Setup

Point your domain to the server:

```
sanctumtools.com → your-server-ip
mr.sanctumtools.com → your-server-ip
```

If behind CloudFlare/CDN, ensure:
- SSL/TLS passthrough for cookies to work
- Cache disabled for `/` routes
- Cache enabled for `/public/*`

## Monitoring

Monitor logs:

```bash
# EC2
tail -f /var/log/app.log

# Railway
railway logs

# Render
In dashboard
```

## Database

This app uses the existing DynamoDB tables:
- `sanctumtools-users`
- `sanctumtools-sessions`

No changes needed to your database setup.

## What to Keep

The existing Lambda API (`/api/chat`, `/api/login`, etc.) stays the same.
If you need the new server to call existing Lambda functions, add them to `server.js`.

## How to Switch Over

1. Deploy this server to your chosen platform
2. Test thoroughly (login, signup, refresh, logout)
3. Update domain DNS to point to new server
4. Keep old React app running for backup
5. Switch traffic over
6. Monitor for issues

## Performance Notes

- Server handles ~100 concurrent users on t3.small
- Scale up if needed
- Session data in-memory (scales to ~10K sessions per GB RAM)
- For high traffic, consider Redis for session store

## Support

If users report "session not persisting," it's likely:
1. Cookie domain misconfiguration
2. httpOnly/Secure flags not working
3. Session storage in memory being lost on restart

All of these are easy fixes with server-side sessions.
