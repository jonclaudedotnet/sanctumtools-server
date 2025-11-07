const express = require('express');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const DynamoDBStore = require('connect-dynamodb')(session);
const path = require('path');
const crypto = require('crypto');
const { DynamoDBClient, GetItemCommand, PutItemCommand, UpdateItemCommand, CreateTableCommand, DescribeTableCommand } = require('@aws-sdk/client-dynamodb');
const { marshall, unmarshall } = require('@aws-sdk/util-dynamodb');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');

const app = express();
const dynamodb = new DynamoDBClient({ region: 'us-east-1' });

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
    ttl: 7 * 24 * 60 * 60 * 1000 // 7 days in milliseconds
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
        }
      });
    }
    return next();
  }

  // For API routes, return 401 instead of redirecting
  if (req.path.startsWith('/api/')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  // Store the original URL to redirect back after login
  req.session.returnTo = req.originalUrl;
  res.redirect('/');
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

// Initialize crisis events table on startup
createCrisisEventsTable().catch(error => {
  console.error('[Startup] Failed to ensure crisis events table exists:', error);
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

// Sign up - handle form submission
app.post('/signup', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.render('signup', { error: 'Email is required' });
    }

    // Check if user exists
    const userResult = await dynamodb.send(new GetItemCommand({
      TableName: 'sanctumtools-users',
      Key: { email: { S: email } }
    }));

    if (userResult.Item) {
      return res.render('signup', { error: 'Account already exists. Please log in.' });
    }

    // Generate TOTP secret
    const secret = speakeasy.generateSecret({
      name: `SanctumTools (${email})`,
      issuer: 'SanctumTools'
    });

    // Generate QR code
    const qrCode = await QRCode.toDataURL(secret.otpauth_url);

    // Store setup token in session
    req.session.setupEmail = email;
    req.session.setupSecret = secret.base32;

    res.render('setup-2fa', { qrCode, secret: secret.base32 });
  } catch (error) {
    console.error('Signup error:', error);
    res.render('signup', { error: 'Signup failed. Please try again.' });
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

// Login - show form
app.get('/login', (req, res) => {
  if (req.session.email) {
    return res.redirect('/dashboard');
  }
  res.render('login', { error: null });
});

// Login - handle form submission
app.post('/login', async (req, res) => {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      return res.render('login', { error: 'Email and code are required' });
    }

    // Get user from DynamoDB
    const userResult = await dynamodb.send(new GetItemCommand({
      TableName: 'sanctumtools-users',
      Key: { email: { S: email } }
    }));

    if (!userResult.Item) {
      return res.render('login', { error: 'User not found. Please sign up.' });
    }

    const user = unmarshall(userResult.Item);

    // Verify TOTP code
    if (!verifyTOTP(user.totpSecret, code)) {
      return res.render('login', { error: 'Invalid code. Please try again.' });
    }

    // Set session
    req.session.email = email;
    req.session.onboardingComplete = user.onboardingComplete || false;
    req.session.loginTime = Date.now();

    // Save session explicitly before redirecting
    req.session.save((err) => {
      if (err) {
        console.error('Session save error:', err);
        return res.render('login', { error: 'Session creation failed. Please try again.' });
      }

      // Check if there's a returnTo URL
      const returnTo = req.session.returnTo;
      delete req.session.returnTo;

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

    req.session.onboardingComplete = true;
    res.json({ success: true, redirectUrl: '/dashboard' });
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

// Helper function to generate therapeutic responses based on framework
function generateTherapeuticResponse(message, framework, user, companionName) {
  const messageLower = message.toLowerCase();
  let reply = '';

  if (framework === 'dbt') {
    // DBT Framework - Conversational teaching approach
    if (messageLower.includes('hello') || messageLower.includes('hi') || messageLower.includes('hey')) {
      reply = `Hello ${user.userName}! I'm ${companionName}. On a scale of 0-10, how intense are your emotions right now? This helps me know whether to focus on distress tolerance or emotion regulation.`;
    } else if (messageLower.includes('empty') || messageLower.includes('numb') || messageLower.includes('void')) {
      reply = "That feeling of emptiness is really difficult. Can you describe one physical sensation you're noticing? Even numbness has a physical quality - let's start there.";
    } else if (messageLower.includes('overwhelm') || messageLower.includes('too much') || messageLower.includes("can't handle")) {
      reply = "You're overwhelmed. Use STOP: Stop, Take a step back, Observe, Proceed mindfully. Can you freeze for 60 seconds before acting on any urges?";
    } else if (messageLower.includes('angry') || messageLower.includes('rage') || messageLower.includes('furious')) {
      reply = "I hear intense anger. Rate it 0-10? If above 7, try TIPP - splash cold water on your face. If below 7, let's Check the Facts - what actually happened?";
    } else if (messageLower.includes('anxious') || messageLower.includes('anxiety') || messageLower.includes('panic')) {
      reply = "Anxiety is overwhelming. Let's use TIPP - can you get ice on your face? This triggers your dive reflex and brings arousal down quickly.";
    } else if (messageLower.includes('urge') || messageLower.includes('impulse')) {
      reply = "You're having an urge. Let's use Opposite Action - if the urge says attack, practice kindness. What's opposite to your current urge?";
    } else if (messageLower.includes('sad') || messageLower.includes('depressed')) {
      reply = "I hear sadness. Are you in Emotion Mind? Let's find Wise Mind - take three breaths and ask what someone wise would say about this.";
    } else {
      reply = "I hear you. Are you in Emotion Mind, Reasonable Mind, or Wise Mind? This helps me know which DBT skill would help most.";
    }
  } else if (framework === 'cbt') {
    // CBT Framework - Conversational thought challenging
    if (messageLower.includes('hello') || messageLower.includes('hi') || messageLower.includes('hey')) {
      reply = `Hello ${user.userName}! I'm ${companionName}. What thoughts have been on your mind? I can help you examine them for patterns.`;
    } else if (messageLower.includes('anxious') || messageLower.includes('anxiety') || messageLower.includes('worried')) {
      reply = "Anxiety often comes from 'what if' thoughts. What specific thought is making you anxious? Let's check if it's realistic or catastrophizing.";
    } else if (messageLower.includes('failure') || messageLower.includes('worthless') || messageLower.includes('stupid')) {
      reply = "That's harsh self-labeling. What evidence supports that thought? What evidence contradicts it? Let's look at both sides.";
    } else if (messageLower.includes('always') || messageLower.includes('never') || messageLower.includes('everyone')) {
      reply = "I notice absolute thinking. Can you think of one exception? One time this wasn't true? That proves it's not absolute.";
    } else if (messageLower.includes('should') || messageLower.includes('must')) {
      reply = "Those 'should' statements add pressure. What if we changed 'I should' to 'I'd prefer to'? Notice how that feels different?";
    } else if (messageLower.includes('sad') || messageLower.includes('depressed')) {
      reply = "What automatic thought came up? Is it a fact or interpretation? Let's examine if there's a more balanced view.";
    } else {
      reply = "What thought popped into your head about this? Once we identify it, we can check if it's helpful or needs reframing.";
    }
  } else {
    // Integrative approach
    if (messageLower.includes('hello') || messageLower.includes('hi') || messageLower.includes('hey')) {
      reply = `Hello ${user.userName}! I'm ${companionName}. How are you feeling right now?`;
    } else if (messageLower.includes('anxious') || messageLower.includes('anxiety')) {
      reply = "Let's ground you. Name 5 things you see, 4 you touch, 3 you hear, 2 you smell, 1 you taste. This brings you to the present.";
    } else if (messageLower.includes('sad') || messageLower.includes('depressed')) {
      reply = "That heaviness is real. What's one tiny thing you could do - not because you should, but to see if it shifts even 1%?";
    } else if (messageLower.includes('angry')) {
      reply = "Anger signals a boundary crossed or need unmet. What boundary or need is involved? Understanding helps us respond wisely.";
    } else {
      reply = "I hear you. What would help most - exploring these feelings, learning a coping skill, or just having someone listen?";
    }
  }

  // Keep responses conversational and under 2-3 sentences
  return reply || `I hear what you're sharing. Tell me more about what you're experiencing right now.`;
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

    // Generate therapeutic response based on framework
    const reply = generateTherapeuticResponse(message, framework, user, companionName);

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
