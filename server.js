const express = require('express');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const path = require('path');
const crypto = require('crypto');
const { DynamoDBClient, GetItemCommand, PutItemCommand, UpdateItemCommand } = require('@aws-sdk/client-dynamodb');
const { marshall, unmarshall } = require('@aws-sdk/util-dynamodb');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const Anthropic = require('@anthropic-ai/sdk');

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

    if (!email) {
      return res.render('login', { error: 'Email is required' });
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
    const deviceToken = req.cookies.device_token;

    // Check if device is trusted (has valid device token)
    let isDeviceTrusted = false;
    if (deviceToken && user.trustedDevices) {
      const trusted = user.trustedDevices.find(d => d.token === deviceToken);
      if (trusted && new Date(trusted.lastUsed) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)) {
        isDeviceTrusted = true;
        // Update last used timestamp
        await dynamodb.send(new UpdateItemCommand({
          TableName: 'sanctumtools-users',
          Key: { email: { S: email } },
          UpdateExpression: 'SET trustedDevices = list_append(trustedDevices, :empty)',
          ExpressionAttributeValues: marshall({ ':empty': [] })
        })).catch(err => console.log('Could not update device timestamp'));
      }
    }

    // If device is not trusted, code is required
    if (!isDeviceTrusted) {
      if (!code) {
        return res.render('login', { error: 'Please enter your authentication code. You can find it in your authenticator app.' });
      }

      // Verify TOTP code
      if (!verifyTOTP(user.totpSecret, code)) {
        return res.render('login', { error: 'Invalid code. Please try again.' });
      }

      // Generate new device token for this device
      const newToken = crypto.randomBytes(32).toString('hex');
      const newTrustedDevice = {
        token: newToken,
        createdAt: new Date().toISOString(),
        lastUsed: new Date().toISOString(),
        userAgent: req.get('user-agent')
      };

      // Add to trusted devices list
      const trustedDevices = user.trustedDevices || [];
      trustedDevices.push(newTrustedDevice);

      // Keep only last 10 devices
      if (trustedDevices.length > 10) {
        trustedDevices.shift();
      }

      await dynamodb.send(new UpdateItemCommand({
        TableName: 'sanctumtools-users',
        Key: { email: { S: email } },
        UpdateExpression: 'SET trustedDevices = :devices',
        ExpressionAttributeValues: marshall({ ':devices': trustedDevices })
      }));

      // Set device token cookie (30 day expiry)
      res.cookie('device_token', newToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 30 * 24 * 60 * 60 * 1000,
        sameSite: 'strict'
      });
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

// Chat API endpoint with Claude Sonnet 4.5
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
    const userName = user.userName || 'friend';
    const diagnosis = user.primaryDiagnosis || 'unspecified mental health concerns';
    const medications = user.currentMedications || [];

    // Build system prompt with user context
    const systemPrompt = `You are ${companionName}, a compassionate mental health support companion. You are speaking with ${userName} who has shared the following information with you:
- Primary Diagnosis: ${diagnosis}
- Current Medications: ${medications.length > 0 ? medications.join(', ') : 'None specified'}

Your role is to:
1. Listen with empathy and validate their feelings
2. Provide supportive, non-judgmental responses
3. Help them reflect on their emotions and experiences
4. Offer gentle coping strategies when appropriate
5. IMPORTANT: If they mention crisis, suicidal thoughts, or self-harm, respond with care and direct them to 988 Suicide & Crisis Lifeline
6. Keep responses conversational and warm (not clinical)
7. Ask follow-up questions to understand them better
8. Never provide medical advice - encourage professional help when needed

Be genuine, caring, and present. You are here to support ${userName} through their mental health journey.`;

    // Call Claude Sonnet 4.5
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: message
        }
      ]
    });

    const reply = response.content[0].type === 'text' ? response.content[0].text : 'I apologize, but I was unable to generate a response.';

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
