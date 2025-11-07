# SanctumTools - Server-Side Rendered Application

A traditional HTML5 web application with server-side session management, replacing the React SPA architecture.

## What's New

- **Server-side session management**: Users stay logged in across page refreshes and browser restarts
- **Traditional HTML pages**: No more React SPAs, just simple HTML with server-side rendering
- **httpOnly cookies**: Secure session cookies that can't be accessed by JavaScript
- **DynamoDB integration**: Persists user data and sessions
- **No more logout on refresh**: Sessions are managed on the server

## Architecture

```
sanctumtools-server/
├── server.js                 # Main Express.js application
├── views/                    # EJS HTML templates
│   ├── index.ejs            # Home/login page
│   ├── login.ejs            # Login form
│   ├── signup.ejs           # Signup form
│   ├── setup-2fa.ejs        # 2FA setup page
│   ├── onboarding.ejs       # Onboarding questionnaire
│   ├── dashboard.ejs        # User dashboard
│   └── chat.ejs             # Chat interface
├── public/                   # Static files (CSS, JS, images)
└── package.json
```

## Setup

```bash
npm install
```

## Environment Variables

Create a `.env` file:

```
PORT=3000
NODE_ENV=development
SESSION_SECRET=your-secret-key-change-in-production
AWS_REGION=us-east-1
```

## Running Locally

```bash
npm start
```

Then visit http://localhost:3000

## How Sessions Work

1. User logs in with email + 2FA code
2. Server creates a session and stores it in memory/database
3. Session ID is sent as an httpOnly cookie
4. On each request, cookie is validated
5. User stays logged in across refreshes and browser restarts
6. Sessions expire after 7 days of inactivity

## Deployment

This app is designed to run on Node.js hosting (Heroku, AWS EC2, Railway, Render, etc.).

It does NOT use Lambda because we need persistent application state for server-side sessions.

## Key Differences from React SPA

| Feature | React SPA | This Server |
|---------|-----------|------------|
| Session storage | localStorage/sessionStorage | httpOnly cookies (server-side) |
| Refresh behavior | Logs out user | Stays logged in |
| Architecture | Single Page App | Traditional web app |
| Page refreshes | Single HTML file | Multiple HTML pages |
| State persistence | Frontend-dependent | Server-managed |

