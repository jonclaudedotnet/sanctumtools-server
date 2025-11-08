const express = require('express');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const DynamoDBStore = require('connect-dynamodb')(session);
const path = require('path');
const crypto = require('crypto');
const { DynamoDBClient, GetItemCommand, PutItemCommand, UpdateItemCommand, CreateTableCommand, DescribeTableCommand, DeleteItemCommand } = require('@aws-sdk/client-dynamodb');
const { marshall, unmarshall } = require('@aws-sdk/util-dynamodb');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const bcrypt = require('bcrypt');
const Anthropic = require('@anthropic-ai/sdk');
const { sendVerificationEmail, sendWelcomeEmail } = require('./lib/emailService');

const app = express();
const dynamodb = new DynamoDBClient({ region: 'us-east-1' });
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

const PORT = process.env.PORT || 3000;
const SESSION_SECRET = process.env.SESSION_SECRET || 'dev-secret-change-in-production';

// Middleware
app.use(express.static('public'));
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(cookieParser());

// Session configuration - persisted to DynamoDB
app.use(session({
  store: new DynamoDBStore({
    client: dynamodb,
    table: 'sanctumtools-sessions-new',
    prefix: 'sess:',
    touchAfter: 24 * 60 * 60, // Update TTL every 24 hours
    ttl: 7 * 24 * 60 * 60 // 7 days in SECONDS (not milliseconds)
  }),
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  },
  name: 'sanctum.sid' // Custom cookie name for better security
}));

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Session debugging middleware (only in development)
if (process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    console.log(`[Session Debug] ${req.method} ${req.path}`);
    console.log(`  Session ID: ${req.sessionID}`);
    console.log(`  Session exists: ${!!req.session}`);
    if (req.session) {
      console.log(`  User: ${req.session.email || 'not logged in'}`);
      console.log(`  Cookie maxAge: ${req.session.cookie.maxAge}`);
    }
    next();
  });
}

// Helper function to check if user is logged in
function isAuthenticated(req, res, next) {
  // Check if session exists and has email
  if (req.session && req.session.email) {
    // Regenerate session ID periodically for security (once per day)
    const lastRegenerated = req.session.lastRegenerated || Date.now();
    if (Date.now() - lastRegenerated > 24 * 60 * 60 * 1000) {
      req.session.lastRegenerated = Date.now();
      req.session.regenerate((err) => {
        if (err) {
          console.error('Session regeneration error:', err);
          return next(err);
        }
        next();
      });
    } else {
      return next();
    }
  } else {
    // For API routes, return 401 instead of redirecting
    if (req.path.startsWith('/api/')) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Store the original URL to redirect back after login
    req.session.returnTo = req.originalUrl;
    req.session.save((err) => {
      if (err) {
        console.error('Failed to save returnTo:', err);
        return res.redirect('/');
      }
      res.redirect('/');
    });
  }
}

// Helper function to verify TOTP
function verifyTOTP(secret, token) {
  return speakeasy.totp.verify({
    secret,
    encoding: 'base32',
    token,
    window: 2
  });
}

// Crisis Detection and Safety Functions
// =====================================

/**
 * Detect crisis keywords in user message
 * Returns object with crisis detection status and matched keywords
 */
function detectCrisisKeywords(message) {
  if (!message || typeof message !== 'string') {
    return { isCrisis: false, keywords: [] };
  }

  const messageLower = message.toLowerCase();
  const detectedKeywords = [];

  // Direct suicide/self-harm indicators
  const directCrisisKeywords = [
    'suicide', 'suicidal', 'kill myself', 'kill my self', 'end my life',
    'want to die', 'better off dead', 'no longer exist', 'not be here',
    'self-harm', 'self harm', 'hurt myself', 'hurt my self',
    'cut myself', 'cutting', 'overdose', 'end it all',
    'no point living', 'no reason to live', 'might as well be dead',
    'don\'t want to be alive', 'wish i was dead', 'wish i were dead',
    'take my life', 'taking my life', 'end everything',
    'can\'t go on', 'cannot go on', 'done with life',
    'plan to die', 'method to die', 'way to die',
    'goodbye forever', 'final goodbye', 'this is goodbye',
    'life isn\'t worth living', 'life is not worth living',
    'not worth living', 'worthless to live', 'why live',
    'why go on', 'why continue', 'what\'s the point of living',
    'no point in living', 'tired of living', 'tired of life'
  ];

  // Check for direct crisis keywords
  for (const keyword of directCrisisKeywords) {
    if (messageLower.includes(keyword)) {
      detectedKeywords.push(keyword);
    }
  }

  // Check for word-boundary sensitive keywords (to avoid false positives)
  const boundaryKeywords = [
    { pattern: /\bod\b/i, keyword: 'od' },  // overdose abbreviation, but only as a whole word
    { pattern: /\bods\b/i, keyword: 'ods' },
    { pattern: /\bo\.?d\.?\b/i, keyword: 'o.d.' }
  ];

  for (const { pattern, keyword } of boundaryKeywords) {
    if (pattern.test(message)) {
      detectedKeywords.push(keyword);
    }
  }

  // Check for high-intensity mood ratings combined with concerning words
  const highIntensityPattern = /\b(8|9|10)\b.*?(sad|depressed|anxious|hopeless|worthless|empty|numb)/i;
  const reversePattern = /(sad|depressed|anxious|hopeless|worthless|empty|numb).*?\b(8|9|10)\b/i;

  if (highIntensityPattern.test(message) || reversePattern.test(message)) {
    detectedKeywords.push('high intensity mood with crisis indicators');
  }

  // Check for crisis phrases with variations
  const crisisPatterns = [
    /i\s+want\s+to\s+die/i,
    /i\s+wanna\s+die/i,
    /i\s+don'?t\s+want\s+to\s+live/i,
    /i\s+can'?t\s+do\s+this\s+anymore/i,
    /i'?m\s+going\s+to\s+(hurt|kill|end)/i,
    /i'?m\s+gonna\s+(hurt|kill|end)/i,
    /no\s+point\s+(in\s+)?(living|going\s+on)/i,
    /what'?s\s+the\s+point\s+of\s+living/i,
    /thinking\s+about\s+(ending|killing|hurting)/i,
    /planning\s+to\s+(die|hurt|kill)/i,
    /have\s+a\s+plan\s+to/i
  ];

  for (const pattern of crisisPatterns) {
    if (pattern.test(message)) {
      const match = message.match(pattern);
      if (match && !detectedKeywords.includes(match[0])) {
        detectedKeywords.push(match[0].toLowerCase().trim());
      }
    }
  }

  return {
    isCrisis: detectedKeywords.length > 0,
    keywords: detectedKeywords
  };
}

/**
 * Create the crisis events DynamoDB table if it doesn't exist
 */
async function createCrisisEventsTable() {
  const tableName = 'sanctumtools-crisis-events';

  try {
    // Check if table already exists
    await dynamodb.send(new DescribeTableCommand({
      TableName: tableName
    }));
    console.log(`[Crisis Table] Table ${tableName} already exists`);
    return true;
  } catch (error) {
    if (error.name === 'ResourceNotFoundException') {
      // Table doesn't exist, create it
      try {
        await dynamodb.send(new CreateTableCommand({
          TableName: tableName,
          KeySchema: [
            { AttributeName: 'email', KeyType: 'HASH' },
            { AttributeName: 'timestamp', KeyType: 'RANGE' }
          ],
          AttributeDefinitions: [
            { AttributeName: 'email', AttributeType: 'S' },
            { AttributeName: 'timestamp', AttributeType: 'N' }
          ],
          BillingMode: 'PAY_PER_REQUEST',
          TimeToLiveSpecification: {
            Enabled: true,
            AttributeName: 'ttl'
          }
        }));
        console.log(`[Crisis Table] Created table ${tableName} successfully`);
        return true;
      } catch (createError) {
        console.error(`[Crisis Table] Failed to create table:`, createError);
        return false;
      }
    } else {
      console.error(`[Crisis Table] Error checking table:`, error);
      return false;
    }
  }
}

/**
 * Log a crisis event to DynamoDB
 */
async function logCrisisEvent(email, message, keywords, response) {
  try {
    const timestamp = Date.now();
    const ttl = Math.floor(Date.now() / 1000) + (90 * 24 * 60 * 60); // 90 days from now

    const item = {
      userEmail: { S: email },  // Changed from 'email' to 'userEmail' to match table schema
      timestamp: { S: timestamp.toString() },  // Changed to String type to match table schema
      message: { S: message.substring(0, 500) }, // Truncate for privacy
      detected_keywords: { SS: keywords.length > 0 ? keywords : ['no_keywords'] },
      response_given: { S: response },
      user_confirmed_safe: { BOOL: false },
      created_at: { S: new Date().toISOString() },
      ttl: { N: ttl.toString() }
    };

    await dynamodb.send(new PutItemCommand({
      TableName: 'sanctumtools-crisis-events',
      Item: item
    }));

    console.log(`[Crisis Event] Logged crisis event for ${email} at ${new Date().toISOString()}`);
    return true;
  } catch (error) {
    console.error('[Crisis Event] Failed to log crisis event:', error);
    // Don't fail the crisis response if logging fails
    return false;
  }
}

/**
 * Generate the standard crisis response
 */
function getCrisisResponse(userInfo = {}) {
  let response = "I'm very concerned about your safety. Please call or text 988 right now. The 988 Suicide & Crisis Lifeline is available 24/7.";

  // Add emergency contacts if available
  if (userInfo.emergencyContacts && userInfo.emergencyContacts.length > 0) {
    response += "\n\nYour emergency contacts:";
    for (const contact of userInfo.emergencyContacts) {
      response += `\n- ${contact.name}: ${contact.phone}`;
    }
  }

  // Add local crisis resources if available
  if (userInfo.localCrisisResources) {
    response += `\n\nLocal crisis resources:\n${userInfo.localCrisisResources}`;
  }

  return response;
}

/**
 * Handle safety assessment follow-up
 */
function getSafetyAssessmentQuestions() {
  return [
    "Are you safe right now?",
    "Have you called 988 or reached out for help?",
    "Do you have someone with you?",
    "Can you tell me where you are?"
  ];
}

/**
 * Check if message is a safety assessment response
 */
function isSafetyAssessmentResponse(message, previousWasCrisis) {
  if (!previousWasCrisis) return false;

  const messageLower = message.toLowerCase();
  const safetyIndicators = [
    'yes', 'i am safe', 'i\'m safe', 'called 988', 'got help',
    'someone is here', 'with me', 'i\'m okay', 'i am okay',
    'feeling better', 'crisis passed', 'not in danger'
  ];

  return safetyIndicators.some(indicator => messageLower.includes(indicator));
}

/**
 * Create the pending-users DynamoDB table if it doesn't exist
 */
async function createPendingUsersTable() {
  const tableName = 'sanctumtools-pending-users';

  try {
    // Check if table already exists
    await dynamodb.send(new DescribeTableCommand({
      TableName: tableName
    }));
    console.log(`[Pending Users Table] Table ${tableName} already exists`);
    return true;
  } catch (error) {
    if (error.name === 'ResourceNotFoundException') {
      // Table doesn't exist, create it
      try {
        await dynamodb.send(new CreateTableCommand({
          TableName: tableName,
          KeySchema: [
            { AttributeName: 'email', KeyType: 'HASH' }
          ],
          AttributeDefinitions: [
            { AttributeName: 'email', AttributeType: 'S' }
          ],
          BillingMode: 'PAY_PER_REQUEST',
          TimeToLiveSpecification: {
            Enabled: true,
            AttributeName: 'ttl'
          }
        }));
        console.log(`[Pending Users Table] Created table ${tableName} successfully`);
        return true;
      } catch (createError) {
        console.error(`[Pending Users Table] Failed to create table:`, createError);
        return false;
      }
    } else {
      console.error(`[Pending Users Table] Error checking table:`, error);
      return false;
    }
  }
}

// Initialize tables on startup
createCrisisEventsTable().catch(error => {
  console.error('[Startup] Failed to ensure crisis events table exists:', error);
});

createPendingUsersTable().catch(error => {
  console.error('[Startup] Failed to ensure pending users table exists:', error);
});

// Home page (login/signup)
app.get('/', (req, res) => {
  if (req.session.email) {
    return res.redirect('/dashboard');
  }
  res.render('index', { error: null });
});

// Sign up - show form
app.get('/signup', (req, res) => {
  if (req.session.email) {
    return res.redirect('/dashboard');
  }
  res.render('signup', { error: null });
});

// Sign up - handle form submission with email verification
app.post('/signup', async (req, res) => {
  try {
    const { email, password, confirmPassword } = req.body;
    const baseUrl = process.env.BASE_URL || `http://${req.headers.host}`;

    // Validate inputs
    if (!email || !password || !confirmPassword) {
      return res.render('signup', { error: 'Email, password, and confirmation are required' });
    }

    if (password !== confirmPassword) {
      return res.render('signup', { error: 'Passwords do not match' });
    }

    if (password.length < 8) {
      return res.render('signup', { error: 'Password must be at least 8 characters' });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.render('signup', { error: 'Invalid email format' });
    }

    // Check if user already exists
    const existingUser = await dynamodb.send(new GetItemCommand({
      TableName: 'sanctumtools-users',
      Key: { email: { S: email } }
    }));

    if (existingUser.Item) {
      return res.render('signup', { error: 'Account already exists. Please log in.' });
    }

    // Check if there's already a pending signup
    const pendingUser = await dynamodb.send(new GetItemCommand({
      TableName: 'sanctumtools-pending-users',
      Key: { email: { S: email } }
    }));

    if (pendingUser.Item) {
      const pendingData = unmarshall(pendingUser.Item);
      // If pending signup is still valid (within 24 hours), show error
      if (pendingData.createdAt && Date.now() - new Date(pendingData.createdAt).getTime() < 24 * 60 * 60 * 1000) {
        return res.render('signup', { error: 'Verification email already sent. Please check your inbox.' });
      }
    }

    // Generate verification token (32 bytes = 64 hex characters)
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = Date.now() + (24 * 60 * 60 * 1000); // 24 hours from now
    const ttl = Math.floor(expiresAt / 1000); // TTL in seconds

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Store pending user in DynamoDB with TTL
    await dynamodb.send(new PutItemCommand({
      TableName: 'sanctumtools-pending-users',
      Item: marshall({
        email: email,
        hashedPassword: hashedPassword,
        verificationToken: verificationToken,
        expiresAt: expiresAt,
        ttl: ttl,
        createdAt: new Date().toISOString()
      })
    }));

    // Send verification email
    const emailResult = await sendVerificationEmail(email, verificationToken, baseUrl);

    if (!emailResult.success) {
      return res.render('signup', { error: 'Failed to send verification email. Please try again.' });
    }

    // Show confirmation page with email display
    res.render('signup-confirmation', { email });
  } catch (error) {
    console.error('Signup error:', error);
    res.render('signup', { error: 'Signup failed. Please try again.' });
  }
});

// Verify email and complete signup
app.get('/verify-email', async (req, res) => {
  try {
    const { token, email } = req.query;

    if (!token || !email) {
      return res.render('error', {
        error: 'Invalid Verification Link',
        message: 'The verification link is missing required parameters.',
        code: '400'
      });
    }

    // Look up pending user
    const pendingUserResult = await dynamodb.send(new GetItemCommand({
      TableName: 'sanctumtools-pending-users',
      Key: { email: { S: email } }
    }));

    if (!pendingUserResult.Item) {
      return res.render('error', {
        error: 'Verification Failed',
        message: 'No pending signup found for this email. Please sign up again.',
        code: '404'
      });
    }

    const pendingUser = unmarshall(pendingUserResult.Item);

    // Verify token matches
    if (pendingUser.verificationToken !== token) {
      return res.render('error', {
        error: 'Invalid Token',
        message: 'The verification token is invalid. Please try signing up again.',
        code: '403'
      });
    }

    // Check if token has expired
    if (Date.now() > pendingUser.expiresAt) {
      return res.render('error', {
        error: 'Link Expired',
        message: 'This verification link has expired. Please sign up again.',
        code: '410'
      });
    }

    // Check if user already exists (double-check)
    const existingUser = await dynamodb.send(new GetItemCommand({
      TableName: 'sanctumtools-users',
      Key: { email: { S: email } }
    }));

    if (existingUser.Item) {
      return res.render('error', {
        error: 'Account Already Exists',
        message: 'An account with this email already exists. Please log in.',
        code: '409'
      });
    }

    // Create user account
    await dynamodb.send(new PutItemCommand({
      TableName: 'sanctumtools-users',
      Item: marshall({
        email: email,
        hashedPassword: pendingUser.hashedPassword,
        createdAt: new Date().toISOString(),
        onboardingComplete: false,
        deviceTokens: []
      })
    }));

    // Delete pending user entry
    await dynamodb.send(new DeleteItemCommand({
      TableName: 'sanctumtools-pending-users',
      Key: { email: { S: email } }
    }));

    // Create authenticated session
    req.session.email = email;
    req.session.onboardingComplete = false;
    req.session.loginTime = Date.now();

    // Send welcome email
    await sendWelcomeEmail(email, email.split('@')[0]);

    // Save session and redirect
    req.session.save((err) => {
      if (err) {
        console.error('Session save error:', err);
        return res.render('error', {
          error: 'Session Error',
          message: 'Failed to create session. Please try logging in.',
          code: '500'
        });
      }
      res.redirect('/onboarding');
    });
  } catch (error) {
    console.error('Email verification error:', error);
    res.render('error', {
      error: 'Verification Error',
      message: 'An error occurred during email verification. Please try again.',
      code: '500'
    });
  }
});

// Verify TOTP setup
app.post('/verify-setup', async (req, res) => {
  try {
    const { code } = req.body;
    const { setupEmail, setupSecret } = req.session;

    if (!setupEmail || !setupSecret) {
      return res.render('setup-2fa', { error: 'Session expired. Please sign up again.' });
    }

    if (!verifyTOTP(setupSecret, code)) {
      const qrCode = await QRCode.toDataURL(`otpauth://totp/SanctumTools%20(${setupEmail})?secret=${setupSecret}&issuer=SanctumTools`);
      return res.render('setup-2fa', { qrCode, secret: setupSecret, error: 'Invalid code. Please try again.' });
    }

    // Create user in DynamoDB
    await dynamodb.send(new PutItemCommand({
      TableName: 'sanctumtools-users',
      Item: marshall({
        email: setupEmail,
        totpSecret: setupSecret,
        createdAt: new Date().toISOString(),
        onboardingComplete: false,
        deviceTokens: []
      })
    }));

    // Clear setup session and create authenticated session
    req.session.email = setupEmail;
    req.session.onboardingComplete = false;
    req.session.loginTime = Date.now();
    delete req.session.setupEmail;
    delete req.session.setupSecret;

    // Save session explicitly before redirecting
    req.session.save((err) => {
      if (err) {
        console.error('Session save error:', err);
        return res.render('setup-2fa', { error: 'Session creation failed. Please try again.' });
      }
      res.redirect('/onboarding');
    });
  } catch (error) {
    console.error('Setup verification error:', error);
    res.render('setup-2fa', { error: 'Verification failed. Please try again.' });
  }
});

// Test endpoint - generate fresh TOTP code for testing
// Usage: GET /test-code?email=test@test.com
app.get('/test-code', async (req, res) => {
  try {
    const { email } = req.query;

    if (!email) {
      return res.status(400).json({ error: 'Email parameter required' });
    }

    // Get user from DynamoDB
    const userResult = await dynamodb.send(new GetItemCommand({
      TableName: 'sanctumtools-users',
      Key: { email: { S: email } }
    }));

    if (!userResult.Item) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = unmarshall(userResult.Item);

    // Generate fresh TOTP code
    const code = speakeasy.totp({
      secret: user.totpSecret,
      encoding: 'base32'
    });

    res.json({
      email,
      code,
      expiresIn: '30 seconds',
      instructions: `Use code ${code} to log in. Code expires in ~30 seconds.`
    });
  } catch (error) {
    console.error('Test code generation error:', error);
    res.status(500).json({ error: 'Failed to generate code' });
  }
});

// Login - show form
app.get('/login', (req, res) => {
  if (req.session.email) {
    return res.redirect('/dashboard');
  }
  res.render('login', { error: null });
});

// Login - handle form submission (username/password)
app.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.render('login', { error: 'Username and password are required' });
    }

    // Get user from DynamoDB by username (using email as key, but checking username field)
    // For now, we'll scan or use username as the key depending on your schema
    const userResult = await dynamodb.send(new GetItemCommand({
      TableName: 'sanctumtools-users',
      Key: { email: { S: username } }  // Using username as the email field for now
    }));

    if (!userResult.Item) {
      return res.render('login', { error: 'Invalid username or password' });
    }

    const user = unmarshall(userResult.Item);

    // Verify password with bcrypt
    const passwordMatch = await bcrypt.compare(password, user.passwordHash || '');
    if (!passwordMatch) {
      return res.render('login', { error: 'Invalid username or password' });
    }

    // Set session
    req.session.email = username;
    req.session.username = user.username || username;
    req.session.onboardingComplete = user.onboardingComplete || false;
    req.session.loginTime = Date.now();

    // Get returnTo URL before saving
    const returnTo = req.session.returnTo;
    delete req.session.returnTo;

    // Save session - only do this ONCE
    req.session.save((err) => {
      if (err) {
        console.error('Session save error:', err);
        return res.render('login', { error: 'Session creation failed. Please try again.' });
      }

      // Session successfully saved to DynamoDB
      console.log(`[Login] User logged in: ${username}`);

      // Redirect based on onboarding status or returnTo
      if (returnTo && returnTo !== '/' && returnTo !== '/login') {
        res.redirect(returnTo);
      } else if (user.onboardingComplete) {
        res.redirect('/dashboard');
      } else {
        res.redirect('/onboarding');
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.render('login', { error: 'Login failed. Please try again.' });
  }
});

// Onboarding page
app.get('/onboarding', isAuthenticated, async (req, res) => {
  try {
    const userResult = await dynamodb.send(new GetItemCommand({
      TableName: 'sanctumtools-users',
      Key: { email: { S: req.session.email } }
    }));

    const user = unmarshall(userResult.Item);

    if (user.onboardingComplete) {
      return res.redirect('/dashboard');
    }

    res.render('onboarding', { error: null });
  } catch (error) {
    console.error('Onboarding page error:', error);
    res.render('onboarding', { error: 'Failed to load onboarding' });
  }
});

// Complete onboarding
app.post('/complete-onboarding', isAuthenticated, async (req, res) => {
  try {
    const { name, companionName, diagnosis, medications, sleepSchedule } = req.body;
    const email = req.session.email;

    if (!name || !companionName || !diagnosis || !sleepSchedule) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Update user in DynamoDB
    await dynamodb.send(new UpdateItemCommand({
      TableName: 'sanctumtools-users',
      Key: { email: { S: email } },
      UpdateExpression: `SET userName = :name, aiCompanionName = :companionName,
        primaryDiagnosis = :diagnosis, currentMedications = :medications,
        sleepSchedule = :sleepSchedule, onboardingComplete = :true`,
      ExpressionAttributeValues: marshall({
        ':name': name,
        ':companionName': companionName,
        ':diagnosis': diagnosis,
        ':medications': medications ? medications.split(/[,\n;]+/).map(m => m.trim()).filter(m => m) : [],
        ':sleepSchedule': sleepSchedule,
        ':true': true
      })
    }));

    // Update session and save to DynamoDB
    req.session.onboardingComplete = true;
    req.session.save((err) => {
      if (err) {
        console.error('Failed to save onboarding session:', err);
        return res.status(500).json({ error: 'Failed to save onboarding status' });
      }
      console.log(`[Onboarding] Completed for ${email}`);
      res.json({ success: true, redirectUrl: '/dashboard' });
    });
  } catch (error) {
    console.error('Onboarding completion error:', error);
    res.status(500).json({ error: 'Failed to complete onboarding' });
  }
});

// Dashboard
app.get('/dashboard', isAuthenticated, async (req, res) => {
  try {
    const userResult = await dynamodb.send(new GetItemCommand({
      TableName: 'sanctumtools-users',
      Key: { email: { S: req.session.email } }
    }));

    const user = unmarshall(userResult.Item);

    if (!user.onboardingComplete) {
      return res.redirect('/onboarding');
    }

    res.render('dashboard', { user, email: req.session.email });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.render('dashboard', { user: {}, email: req.session.email, error: 'Failed to load dashboard' });
  }
});

// Chat page
app.get('/chat', isAuthenticated, async (req, res) => {
  try {
    const userResult = await dynamodb.send(new GetItemCommand({
      TableName: 'sanctumtools-users',
      Key: { email: { S: req.session.email } }
    }));

    const user = unmarshall(userResult.Item);

    if (!user.onboardingComplete) {
      return res.redirect('/onboarding');
    }

    res.render('chat', { user, email: req.session.email, companionName: user.aiCompanionName || 'Assistant' });
  } catch (error) {
    console.error('Chat page error:', error);
    res.render('chat', { user: {}, email: req.session.email, companionName: 'Assistant', error: 'Failed to load chat' });
  }
});

// Helper function to detect which therapeutic framework to use based on diagnosis
function detectFrameworkForDiagnosis(diagnosis) {
  if (!diagnosis) return 'integrative';

  const diagLower = diagnosis.toLowerCase();

  // BPD → DBT (primary framework)
  if (diagLower.includes('bpd') || diagLower.includes('borderline')) {
    return 'dbt';
  }

  // Bipolar → DBT for crisis management + mood tracking
  if (diagLower.includes('bipolar')) {
    return 'dbt';
  }

  // Anxiety disorders → CBT (cognitive restructuring)
  if (diagLower.includes('anxiety') || diagLower.includes('panic') ||
      diagLower.includes('gad') || diagLower.includes('phobia')) {
    return 'cbt';
  }

  // Depression → CBT (thought challenging) + behavioral activation
  if (diagLower.includes('depression') || diagLower.includes('depressive') ||
      diagLower.includes('mdd')) {
    return 'cbt';
  }

  // PTSD/Trauma → DBT for distress tolerance + grounding
  if (diagLower.includes('ptsd') || diagLower.includes('trauma')) {
    return 'dbt';
  }

  // OCD → CBT (exposure response prevention)
  if (diagLower.includes('ocd') || diagLower.includes('obsessive')) {
    return 'cbt';
  }

  // Default to integrative approach
  return 'integrative';
}

// Helper function to generate therapeutic responses using Claude API
async function generateTherapeuticResponseWithClaude(message, framework, user, companionName) {
  try {
    // Build system prompt based on therapeutic framework
    let systemPrompt = '';

    if (framework === 'dbt') {
      systemPrompt = `You are ${companionName}, an AI companion trained in Dialectical Behavior Therapy (DBT). You're supporting ${user.userName}, who has been diagnosed with ${user.primaryDiagnosis || 'mental health challenges'}.

Your approach:
- Use DBT skills: mindfulness, distress tolerance, emotion regulation, interpersonal effectiveness
- Teach skills conversationally (STOP, TIPP, Wise Mind, Opposite Action, Check the Facts)
- Ask about emotion intensity (0-10 scale) to guide skill selection
- Be warm, validating, and direct
- Keep responses brief (2-3 sentences max)
- Never diagnose, prescribe medication, or replace professional care

Respond to the user's message with a therapeutic DBT approach.`;
    } else if (framework === 'cbt') {
      systemPrompt = `You are ${companionName}, an AI companion trained in Cognitive Behavioral Therapy (CBT). You're supporting ${user.userName}, who has been diagnosed with ${user.primaryDiagnosis || 'mental health challenges'}.

Your approach:
- Identify and challenge cognitive distortions (catastrophizing, black-and-white thinking, should statements)
- Use Socratic questioning to examine thoughts
- Help reframe unhelpful thoughts into balanced perspectives
- Focus on the connection between thoughts, feelings, and behaviors
- Be warm, collaborative, and curious
- Keep responses brief (2-3 sentences max)
- Never diagnose, prescribe medication, or replace professional care

Respond to the user's message with a therapeutic CBT approach.`;
    } else {
      systemPrompt = `You are ${companionName}, an AI companion using an integrative therapeutic approach. You're supporting ${user.userName}, who has been diagnosed with ${user.primaryDiagnosis || 'mental health challenges'}.

Your approach:
- Blend techniques from CBT, DBT, and mindfulness-based approaches
- Validate emotions while offering coping strategies
- Use grounding techniques when appropriate
- Ask clarifying questions to understand needs
- Be warm, empathetic, and supportive
- Keep responses brief (2-3 sentences max)
- Never diagnose, prescribe medication, or replace professional care

Respond to the user's message with a therapeutic integrative approach.`;
    }

    // Call Claude API
    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 300,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: message
        }
      ]
    });

    // Extract the text response
    const reply = response.content[0].text;
    return reply;

  } catch (error) {
    console.error('[Claude API] Error generating therapeutic response:', error);

    // Fallback response if Claude API fails
    return `I'm here to support you, ${user.userName}. I'm having a brief technical issue, but I want you to know I'm listening. Can you tell me more about what you're experiencing right now?`;
  }
}

// Note: Comprehensive crisis detection functions are defined earlier in the file
// They include detectCrisisKeywords(), logCrisisEvent(), getCrisisResponse() etc.

// Chat API endpoint with Comprehensive Crisis Detection
app.post('/api/chat', isAuthenticated, async (req, res) => {
  try {
    const { message } = req.body;
    const email = req.session.email;

    // Validate input
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Limit message length
    if (message.length > 2000) {
      return res.status(400).json({ error: 'Message is too long (max 2000 characters)' });
    }

    // Log the incoming message for debugging
    console.log(`[Chat API] User ${email} sent: ${message.substring(0, 100)}...`);

    // ============================================
    // CRISIS DETECTION - HIGHEST PRIORITY
    // This MUST happen BEFORE any other processing
    // Crisis protocol OVERRIDES all other settings
    // ============================================
    const crisisDetection = detectCrisisKeywords(message);

    if (crisisDetection.isCrisis) {
      console.log(`[CRISIS DETECTED] User ${email} - Keywords: ${crisisDetection.keywords.join(', ')}`);

      // Get user data for emergency contacts
      const userResult = await dynamodb.send(new GetItemCommand({
        TableName: 'sanctumtools-users',
        Key: { email: { S: email } }
      }));

      const user = unmarshall(userResult.Item);

      // Generate standard crisis response with user's emergency info if available
      const crisisResponse = getCrisisResponse({
        emergencyContacts: user.emergencyContacts,
        localCrisisResources: user.localCrisisResources
      });

      // Log the crisis event to DynamoDB
      await logCrisisEvent(email, message, crisisDetection.keywords, crisisResponse);

      // Store the crisis chat entry
      const chatId = `${email}_${Date.now()}`;
      const timestamp = Date.now();
      const crisisChatEntry = {
        chatId: { S: chatId },
        email: { S: email },
        timestamp: { N: timestamp.toString() },
        userMessage: { S: message },
        assistantReply: { S: crisisResponse },
        companionName: { S: user.aiCompanionName || 'Assistant' },
        hadCrisisDetection: { BOOL: true },
        crisisKeywordsDetected: { SS: crisisDetection.keywords }
      };

      // Store crisis chat (don't wait)
      dynamodb.send(new PutItemCommand({
        TableName: 'sanctumtools-chats',
        Item: crisisChatEntry
      })).catch(error => {
        console.error('[Crisis Chat] Failed to store crisis chat:', error);
      });

      // Set session flag for follow-up
      req.session.lastMessageWasCrisis = true;
      req.session.lastCrisisTime = timestamp;

      // IMMEDIATELY return crisis response - no other processing
      return res.json({
        reply: crisisResponse,
        isCrisis: true
      });
    }

    // ============================================
    // SAFETY ASSESSMENT FOLLOW-UP
    // Check if this is a response after crisis
    // ============================================
    if (req.session.lastMessageWasCrisis) {
      const isSafetyResponse = isSafetyAssessmentResponse(message, true);

      if (isSafetyResponse) {
        // User confirmed safety
        console.log(`[Crisis Resolution] User ${email} confirmed safety`);

        // Update the last crisis event to mark user as safe
        if (req.session.lastCrisisTime) {
          try {
            // Find and update the crisis event
            await dynamodb.send(new UpdateItemCommand({
              TableName: 'sanctumtools-crisis-events',
              Key: {
                userEmail: { S: email },  // Changed from 'email' to 'userEmail' to match table schema
                timestamp: { S: req.session.lastCrisisTime.toString() }  // Changed to String type to match table schema
              },
              UpdateExpression: 'SET user_confirmed_safe = :true, safety_confirmed_at = :now',
              ExpressionAttributeValues: marshall({
                ':true': true,
                ':now': new Date().toISOString()
              })
            }));
          } catch (updateError) {
            console.error('[Crisis Update] Could not update safety confirmation:', updateError);
          }
        }

        // Clear crisis flags
        req.session.lastMessageWasCrisis = false;
        delete req.session.lastCrisisTime;

        // Get user info for personalized response
        const userResult = await dynamodb.send(new GetItemCommand({
          TableName: 'sanctumtools-users',
          Key: { email: { S: email } }
        }));

        const user = unmarshall(userResult.Item);

        const safetyConfirmedReply = `I'm relieved to hear you're safe, ${user.userName || 'friend'}. Thank you for letting me know. Remember, I'm here to support you, and help is always available if you need it. Would you like to talk about what you're experiencing?`;

        // Store the safety confirmation chat
        const chatId = `${email}_${Date.now()}`;
        dynamodb.send(new PutItemCommand({
          TableName: 'sanctumtools-chats',
          Item: {
            chatId: { S: chatId },
            email: { S: email },
            timestamp: { N: Date.now().toString() },
            userMessage: { S: message },
            assistantReply: { S: safetyConfirmedReply },
            companionName: { S: user.aiCompanionName || 'Assistant' },
            wasSafetyConfirmation: { BOOL: true }
          }
        })).catch(error => {
          console.error('[Chat] Failed to store safety confirmation:', error);
        });

        return res.json({
          reply: safetyConfirmedReply,
          crisisResolved: true
        });
      } else if (!message.toLowerCase().includes('no') && !message.toLowerCase().includes('not safe')) {
        // Still in crisis follow-up mode, ask safety questions
        const safetyQuestions = getSafetyAssessmentQuestions();
        const assessmentReply = safetyQuestions.join('\n') + '\n\nRemember: Call or text 988 for immediate support.';

        return res.json({
          reply: assessmentReply,
          stillInCrisisMode: true
        });
      }
    }

    // ============================================
    // NORMAL CHAT PROCESSING
    // Only happens if no crisis detected
    // ============================================

    // Get user data for context
    const userResult = await dynamodb.send(new GetItemCommand({
      TableName: 'sanctumtools-users',
      Key: { email: { S: email } }
    }));

    const user = unmarshall(userResult.Item);
    const companionName = user.aiCompanionName || 'Assistant';

    // Detect therapeutic framework based on diagnosis
    const framework = detectFrameworkForDiagnosis(user.primaryDiagnosis);

    // Generate therapeutic response based on framework using Claude API
    const reply = await generateTherapeuticResponseWithClaude(message, framework, user, companionName);

    // Store chat message in DynamoDB
    const chatId = `${email}_${Date.now()}`;
    const timestamp = Date.now();
    const chatEntry = {
      chatId: { S: chatId },
      email: { S: email },
      timestamp: { N: timestamp.toString() },
      userMessage: { S: message },
      assistantReply: { S: reply },
      companionName: { S: companionName },
      therapeuticFramework: { S: framework },
      hadCrisisDetection: { BOOL: false }
    };

    // Store chat history (fire and forget - don't wait for response)
    dynamodb.send(new PutItemCommand({
      TableName: 'sanctumtools-chats',
      Item: chatEntry
    })).catch(error => {
      console.error('[Chat API] Failed to store chat history:', error);
      // Don't fail the request if history storage fails
    });

    // Log the response for debugging
    console.log(`[Chat API] Responding to ${email}: ${reply.substring(0, 100)}...`);

    // Clear any lingering crisis flags if we're in normal conversation
    if (req.session.lastMessageWasCrisis) {
      req.session.lastMessageWasCrisis = false;
      delete req.session.lastCrisisTime;
    }

    // Send response
    res.json({ reply });

  } catch (error) {
    console.error('[Chat API] Error:', error);
    res.status(500).json({
      error: 'I apologize, but I encountered an issue processing your message. Please try again.'
    });
  }
});

// Session status endpoint (for debugging)
app.get('/api/session-status', (req, res) => {
  const status = {
    authenticated: !!req.session?.email,
    sessionId: req.sessionID,
    user: req.session?.email || null,
    onboardingComplete: req.session?.onboardingComplete || false,
    loginTime: req.session?.loginTime || null,
    cookieMaxAge: req.session?.cookie?.maxAge || null,
    cookieExpires: req.session?.cookie?.expires || null
  };

  res.json(status);
});

// Logout
app.get('/logout', (req, res) => {
  // Store session ID for logging
  const sessionId = req.sessionID;
  const userEmail = req.session ? req.session.email : 'unknown';

  req.session.destroy((err) => {
    if (err) {
      console.error(`Logout error for ${userEmail}:`, err);
      return res.status(500).send('Failed to logout');
    }

    // Clear the session cookie
    res.clearCookie('sanctum.sid', {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production'
    });

    console.log(`User ${userEmail} logged out successfully (session: ${sessionId})`);
    res.redirect('/');
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`SanctumTools server running on port ${PORT}`);
});
