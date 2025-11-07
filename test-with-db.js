/**
 * SanctumTools Chat API Test with Database Verification
 * This test creates a special test endpoint that mimics the authenticated chat API
 * and verifies database storage
 */

const express = require('express');
const session = require('express-session');
const { DynamoDBClient, PutItemCommand, ScanCommand, CreateTableCommand, DescribeTableCommand } = require('@aws-sdk/client-dynamodb');
const { marshall, unmarshall } = require('@aws-sdk/util-dynamodb');

const app = express();
const dynamodb = new DynamoDBClient({ region: 'us-east-1' });
const PORT = 3002;

// Import crisis detection and therapeutic functions from server.js
const fs = require('fs');
const serverCode = fs.readFileSync('./server.js', 'utf8');

// Extract required functions using regex
const detectCrisisKeywordsMatch = serverCode.match(/function detectCrisisKeywords[\s\S]*?^}/m);
const generateTherapeuticResponseMatch = serverCode.match(/function generateTherapeuticResponse[\s\S]*?^}/m);
const detectFrameworkForDiagnosisMatch = serverCode.match(/function detectFrameworkForDiagnosis[\s\S]*?^}/m);
const getCrisisResponseMatch = serverCode.match(/function getCrisisResponse[\s\S]*?^}/m);
const logCrisisEventMatch = serverCode.match(/async function logCrisisEvent[\s\S]*?^}/m);

// Evaluate the extracted functions
eval(detectCrisisKeywordsMatch[0]);
eval(generateTherapeuticResponseMatch[0]);
eval(detectFrameworkForDiagnosisMatch[0]);
eval(getCrisisResponseMatch[0]);
// We'll create our own logCrisisEvent for testing

// Middleware
app.use(express.json());
app.use(session({
  secret: 'test-secret',
  resave: false,
  saveUninitialized: false
}));

// Color codes for output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// Simplified logCrisisEvent for testing
async function logCrisisEvent(email, message, keywords, response) {
  try {
    const timestamp = Date.now();
    const ttl = Math.floor(Date.now() / 1000) + (90 * 24 * 60 * 60);

    const item = {
      userEmail: { S: email },  // Fixed to match table schema
      timestamp: { S: timestamp.toString() },  // Changed to String type to match table schema
      message: { S: message.substring(0, 500) },
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

    log(`  ✓ Crisis event logged to DynamoDB`, 'green');
    return true;
  } catch (error) {
    log(`  ✗ Failed to log crisis event: ${error.message}`, 'red');
    return false;
  }
}

// Test endpoint that mimics /api/chat
app.post('/test/chat', async (req, res) => {
  try {
    const { message, userEmail = 'test@example.com', diagnosis = 'anxiety' } = req.body;

    // Validate input
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({ error: 'Message is required' });
    }

    if (message.length > 2000) {
      return res.status(400).json({ error: 'Message is too long (max 2000 characters)' });
    }

    log(`\nProcessing: "${message.substring(0, 50)}..."`, 'cyan');

    // CRISIS DETECTION
    const crisisDetection = detectCrisisKeywords(message);

    if (crisisDetection.isCrisis) {
      log(`  ⚠ Crisis detected! Keywords: ${crisisDetection.keywords.join(', ')}`, 'yellow');

      const crisisResponse = getCrisisResponse({});

      // Log crisis event
      await logCrisisEvent(userEmail, message, crisisDetection.keywords, crisisResponse);

      // Store crisis chat
      const chatId = `${userEmail}_${Date.now()}`;
      const timestamp = Date.now();
      const crisisChatEntry = {
        chatId: { S: chatId },
        email: { S: userEmail },
        timestamp: { N: timestamp.toString() },
        userMessage: { S: message },
        assistantReply: { S: crisisResponse },
        companionName: { S: 'TestCompanion' },
        hadCrisisDetection: { BOOL: true },
        crisisKeywordsDetected: { SS: crisisDetection.keywords }
      };

      try {
        await dynamodb.send(new PutItemCommand({
          TableName: 'sanctumtools-chats',
          Item: crisisChatEntry
        }));
        log(`  ✓ Crisis chat saved to sanctumtools-chats`, 'green');
      } catch (error) {
        log(`  ✗ Failed to save crisis chat: ${error.message}`, 'red');
      }

      return res.json({
        reply: crisisResponse,
        isCrisis: true
      });
    }

    // NORMAL CHAT PROCESSING
    const user = { userName: 'TestUser', primaryDiagnosis: diagnosis };
    const companionName = 'TestCompanion';
    const framework = detectFrameworkForDiagnosis(diagnosis);
    const reply = generateTherapeuticResponse(message, framework, user, companionName);

    log(`  Framework: ${framework}`, 'blue');

    // Store normal chat
    const chatId = `${userEmail}_${Date.now()}`;
    const timestamp = Date.now();
    const chatEntry = {
      chatId: { S: chatId },
      email: { S: userEmail },
      timestamp: { N: timestamp.toString() },
      userMessage: { S: message },
      assistantReply: { S: reply },
      companionName: { S: companionName },
      therapeuticFramework: { S: framework },
      hadCrisisDetection: { BOOL: false }
    };

    try {
      await dynamodb.send(new PutItemCommand({
        TableName: 'sanctumtools-chats',
        Item: chatEntry
      }));
      log(`  ✓ Chat saved to sanctumtools-chats`, 'green');
    } catch (error) {
      log(`  ✗ Failed to save chat: ${error.message}`, 'red');
    }

    res.json({ reply, framework });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      error: 'I apologize, but I encountered an issue processing your message.'
    });
  }
});

// Test runner
async function runTests() {
  log('\n════════════════════════════════════════════════════════════', 'bright');
  log('      SANCTUMTOOLS CHAT API TEST WITH DATABASE VERIFICATION', 'cyan');
  log('════════════════════════════════════════════════════════════\n', 'bright');

  // Ensure tables exist
  log('Checking DynamoDB tables...', 'yellow');
  try {
    await dynamodb.send(new DescribeTableCommand({
      TableName: 'sanctumtools-chats'
    }));
    log('  ✓ sanctumtools-chats table exists', 'green');
  } catch (error) {
    log('  ✗ sanctumtools-chats table not found', 'red');
  }

  try {
    await dynamodb.send(new DescribeTableCommand({
      TableName: 'sanctumtools-crisis-events'
    }));
    log('  ✓ sanctumtools-crisis-events table exists', 'green');
  } catch (error) {
    log('  ✗ sanctumtools-crisis-events table not found', 'red');
  }

  const axios = require('axios');
  const baseURL = `http://localhost:${PORT}`;

  // Test cases
  const testCases = [
    {
      category: '\n1. CRISIS DETECTION TESTS',
      tests: [
        { message: 'I want to die', expectCrisis: true },
        { message: "Life isn't worth living", expectCrisis: true },
        { message: "I'm going to hurt myself", expectCrisis: true },
        { message: "I can't do this anymore", expectCrisis: true }
      ]
    },
    {
      category: '\n2. THERAPEUTIC RESPONSE TESTS',
      tests: [
        { message: "I'm feeling anxious today", diagnosis: 'anxiety', expectFramework: 'cbt' },
        { message: "I feel empty and numb", diagnosis: 'borderline personality disorder', expectFramework: 'dbt' },
        { message: "I keep having flashbacks", diagnosis: 'PTSD', expectFramework: 'dbt' },
        { message: "I'm feeling depressed", diagnosis: 'depression', expectFramework: 'cbt' },
        { message: "My mood swings are intense", diagnosis: 'bipolar disorder', expectFramework: 'dbt' }
      ]
    },
    {
      category: '\n3. ERROR HANDLING TESTS',
      tests: [
        { message: '', expectError: true, expectedStatus: 400 },
        { message: 'x'.repeat(2001), expectError: true, expectedStatus: 400 }
      ]
    }
  ];

  for (const category of testCases) {
    log(category.category, 'magenta');
    log('─'.repeat(50), 'bright');

    for (const test of category.tests) {
      try {
        const response = await axios.post(`${baseURL}/test/chat`, {
          message: test.message,
          diagnosis: test.diagnosis
        }, {
          validateStatus: () => true
        });

        if (test.expectError) {
          if (response.status === test.expectedStatus) {
            log(`  ✓ Error handling correct (${response.status}): ${response.data.error}`, 'green');
          } else {
            log(`  ✗ Wrong status: ${response.status} (expected ${test.expectedStatus})`, 'red');
          }
        } else if (test.expectCrisis) {
          if (response.data.isCrisis) {
            log(`  ✓ Crisis detected correctly`, 'green');
            if (response.data.reply.includes('988')) {
              log(`    ✓ 988 hotline included`, 'green');
            }
          } else {
            log(`  ✗ Crisis not detected for: "${test.message}"`, 'red');
          }
        } else {
          if (response.data.framework === test.expectFramework) {
            log(`  ✓ Correct framework (${response.data.framework})`, 'green');
          }
          log(`    Response: "${response.data.reply.substring(0, 100)}..."`, 'cyan');
        }
      } catch (error) {
        log(`  ✗ Test failed: ${error.message}`, 'red');
      }

      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  // Verify database storage
  log('\n4. DATABASE STORAGE VERIFICATION', 'magenta');
  log('─'.repeat(50), 'bright');

  try {
    // Check for recent chats
    const scanResult = await dynamodb.send(new ScanCommand({
      TableName: 'sanctumtools-chats',
      FilterExpression: 'email = :email',
      ExpressionAttributeValues: {
        ':email': { S: 'test@example.com' }
      },
      Limit: 5
    }));

    if (scanResult.Items && scanResult.Items.length > 0) {
      log(`  ✓ Found ${scanResult.Items.length} chat entries in DynamoDB`, 'green');
      const latestChat = unmarshall(scanResult.Items[0]);
      log(`    Latest: ${latestChat.userMessage.substring(0, 50)}...`, 'cyan');
      log(`    Framework: ${latestChat.therapeuticFramework || 'N/A'}`, 'cyan');
    } else {
      log('  ✗ No chat entries found in DynamoDB', 'red');
    }

    // Check for crisis events
    const crisisResult = await dynamodb.send(new ScanCommand({
      TableName: 'sanctumtools-crisis-events',
      FilterExpression: 'userEmail = :email',
      ExpressionAttributeValues: {
        ':email': { S: 'test@example.com' }
      },
      Limit: 5
    }));

    if (crisisResult.Items && crisisResult.Items.length > 0) {
      log(`  ✓ Found ${crisisResult.Items.length} crisis events in DynamoDB`, 'green');
    }
  } catch (error) {
    log(`  ✗ Database verification failed: ${error.message}`, 'red');
  }

  log('\n════════════════════════════════════════════════════════════', 'bright');
  log('                    TEST SUITE COMPLETE', 'cyan');
  log('════════════════════════════════════════════════════════════\n', 'bright');

  process.exit(0);
}

// Start test server
app.listen(PORT, () => {
  log(`Test server running on port ${PORT}`, 'green');
  setTimeout(runTests, 1000);
});