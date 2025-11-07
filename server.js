const express = require('express');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const path = require('path');
const crypto = require('crypto');
const { DynamoDBClient, GetItemCommand, PutItemCommand, UpdateItemCommand } = require('@aws-sdk/client-dynamodb');
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

// Chat API endpoint
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

    // Get user data for context
    const userResult = await dynamodb.send(new GetItemCommand({
      TableName: 'sanctumtools-users',
      Key: { email: { S: email } }
    }));

    const user = unmarshall(userResult.Item);
    const companionName = user.aiCompanionName || 'Assistant';

    // Generate contextual response based on message content
    let reply = '';

    // Simple keyword-based responses for now (can be replaced with AI integration later)
    const messageLower = message.toLowerCase();

    if (messageLower.includes('hello') || messageLower.includes('hi') || messageLower.includes('hey')) {
      reply = `Hello ${user.userName || 'there'}! I'm ${companionName}, and I'm here to support you. How are you feeling today?`;
    } else if (messageLower.includes('anxious') || messageLower.includes('anxiety')) {
      reply = "I hear that you're feeling anxious. That can be really challenging. Would you like to try a quick breathing exercise together, or would you prefer to talk about what's on your mind?";
    } else if (messageLower.includes('sad') || messageLower.includes('depressed') || messageLower.includes('down')) {
      reply = "I'm sorry you're feeling this way. It's okay to have these feelings, and I'm here to listen. Would you like to share what's been weighing on you?";
    } else if (messageLower.includes('angry') || messageLower.includes('frustrated') || messageLower.includes('mad')) {
      reply = "I can sense your frustration. It's completely valid to feel angry sometimes. Would you like to talk about what's causing these feelings, or would you prefer some strategies to help manage them?";
    } else if (messageLower.includes('help')) {
      reply = `I'm here to help, ${user.userName || 'friend'}. I can listen to your concerns, guide you through breathing exercises, help you reflect on your feelings, or just be here as a supportive presence. What would be most helpful for you right now?`;
    } else if (messageLower.includes('mindfulness') || messageLower.includes('meditation')) {
      reply = "Mindfulness is a wonderful practice for managing stress and staying grounded. Would you like me to guide you through a brief mindfulness exercise? We could start with a simple 3-minute breathing meditation.";
    } else if (messageLower.includes('sleep') || messageLower.includes('insomnia') || messageLower.includes('tired')) {
      reply = "Sleep difficulties can really impact how we feel. Are you having trouble falling asleep, staying asleep, or both? I can share some sleep hygiene tips that might help.";
    } else if (messageLower.includes('crisis') || messageLower.includes('suicide') || messageLower.includes('hurt myself')) {
      reply = "I'm very concerned about what you're sharing. Your life has value, and help is available. Please reach out to the 988 Suicide & Crisis Lifeline right now by calling or texting 988. They have trained counselors available 24/7. You don't have to go through this alone.";
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

    // Store chat message in DynamoDB (optional - for chat history)
    const chatId = `${email}_${Date.now()}`;
    const chatEntry = {
      chatId: { S: chatId },
      email: { S: email },
      timestamp: { N: Date.now().toString() },
      userMessage: { S: message },
      assistantReply: { S: reply },
      companionName: { S: companionName }
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
