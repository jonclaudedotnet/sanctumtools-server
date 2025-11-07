const express = require('express');
const cookieParser = require('cookie-parser');
const session = require('express-session');
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

// Session configuration - stored in DynamoDB
app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  }
}));

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Helper function to check if user is logged in
function isAuthenticated(req, res, next) {
  if (req.session.email) {
    return next();
  }
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
    'goodbye forever', 'final goodbye', 'this is goodbye'
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
      email: { S: email },
      timestamp: { N: timestamp.toString() },
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
    delete req.session.setupEmail;
    delete req.session.setupSecret;

    res.redirect('/onboarding');
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

    if (user.onboardingComplete) {
      res.redirect('/dashboard');
    } else {
      res.redirect('/onboarding');
    }
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
                email: { S: email },
                timestamp: { N: req.session.lastCrisisTime.toString() }
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

    // Generate contextual response based on message content
    let reply = '';

    // Simple keyword-based responses for now (can be replaced with AI integration later)
    const messageLower = message.toLowerCase();

    if (messageLower.includes('hello') || messageLower.includes('hi') || messageLower.includes('hey')) {
      reply = `Hello ${user.userName || 'there'}! I'm ${companionName}, and I'm here to support you. How are you feeling today?`;
    } else if (messageLower.includes('anxious') || messageLower.includes('anxiety')) {
      if (framework === 'dbt') {
        reply = "I hear that you're feeling anxious. Let's try the TIPP skill - Temperature, Intense exercise, Paced breathing, or Paired muscle relaxation. Would you like me to guide you through one of these?";
      } else {
        reply = "I hear that you're feeling anxious. That can be really challenging. Would you like to try a quick breathing exercise together, or would you prefer to talk about what's on your mind?";
      }
    } else if (messageLower.includes('sad') || messageLower.includes('depressed') || messageLower.includes('down')) {
      // Be careful not to trigger crisis response for normal sadness
      if (framework === 'cbt') {
        reply = "I'm sorry you're feeling down. Sometimes our thoughts can intensify these feelings. Would you like to explore what thoughts are contributing to this sadness?";
      } else {
        reply = "I'm sorry you're feeling this way. It's okay to have these feelings, and I'm here to listen. Would you like to share what's been weighing on you?";
      }
    } else if (messageLower.includes('angry') || messageLower.includes('frustrated') || messageLower.includes('mad')) {
      if (framework === 'dbt') {
        reply = "I can sense your frustration. The Opposite Action skill might help here - when anger isn't justified, we can choose to act opposite to the urge. Would you like to work through this together?";
      } else {
        reply = "I can sense your frustration. It's completely valid to feel angry sometimes. Would you like to talk about what's causing these feelings, or would you prefer some strategies to help manage them?";
      }
    } else if (messageLower.includes('help')) {
      reply = `I'm here to help, ${user.userName || 'friend'}. Based on your ${user.primaryDiagnosis || 'needs'}, I can offer ${framework.toUpperCase()} skills, listen to your concerns, or just be here as a supportive presence. What would be most helpful right now?`;
    } else if (messageLower.includes('mindfulness') || messageLower.includes('meditation')) {
      reply = "Mindfulness is a wonderful practice for managing stress and staying grounded. Would you like me to guide you through a brief mindfulness exercise? We could start with a simple 3-minute breathing meditation.";
    } else if (messageLower.includes('sleep') || messageLower.includes('insomnia') || messageLower.includes('tired')) {
      reply = "Sleep difficulties can really impact how we feel. Are you having trouble falling asleep, staying asleep, or both? I can share some sleep hygiene tips that might help.";
    } else if (messageLower.includes('thank') || messageLower.includes('thanks')) {
      reply = `You're very welcome, ${user.userName || 'friend'}. I'm always here when you need someone to talk to. Remember, taking care of your mental health is a sign of strength.`;
    } else if (messageLower.includes('bye') || messageLower.includes('goodbye')) {
      reply = `Take care, ${user.userName || 'friend'}. Remember, I'm here whenever you need to talk. Be kind to yourself.`;
    } else {
      // Default empathetic responses for general messages
      const responses = [
        "I hear you. Tell me more about what you're experiencing.",
        "Thank you for sharing that with me. How does that make you feel?",
        "That sounds like it's been weighing on you. I'm here to listen.",
        "I appreciate you opening up. What would be most helpful for you right now?",
        "Your feelings are valid. Would you like to explore this further together?",
        `I understand, ${user.userName || 'friend'}. Sometimes just talking through things can help provide clarity.`,
        "That's an important insight. How do you think you'd like to move forward with this?",
        "I'm here with you. Take your time to express whatever you need to."
      ];
      reply = responses[Math.floor(Math.random() * responses.length)];
    }

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

// Logout
app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`SanctumTools server running on port ${PORT}`);
});
