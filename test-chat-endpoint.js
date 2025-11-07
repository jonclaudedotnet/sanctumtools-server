/**
 * Comprehensive test suite for SanctumTools /api/chat endpoint
 * Tests crisis detection, therapeutic responses, and database storage
 */

const axios = require('axios');
const { DynamoDBClient, GetItemCommand, QueryCommand, ScanCommand } = require('@aws-sdk/client-dynamodb');
const { unmarshall } = require('@aws-sdk/util-dynamodb');

const dynamodb = new DynamoDBClient({ region: 'us-east-1' });
const BASE_URL = 'http://localhost:3000';

// Test user credentials
const TEST_USER = {
  email: 'test@example.com',
  totpSecret: 'JBSWY3DPEHPK3PXP' // Example secret for testing
};

// Cookie jar for maintaining session
let sessionCookie = null;

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m'
};

function log(message, color = 'white') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log(`\n${colors.bright}${colors.cyan}${'='.repeat(60)}${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}${title}${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}${'='.repeat(60)}${colors.reset}\n`);
}

function logTest(testName) {
  console.log(`${colors.bright}${colors.blue}Testing: ${testName}${colors.reset}`);
}

function logSuccess(message) {
  console.log(`${colors.green}✓ ${message}${colors.reset}`);
}

function logError(message) {
  console.log(`${colors.red}✗ ${message}${colors.reset}`);
}

function logWarning(message) {
  console.log(`${colors.yellow}⚠ ${message}${colors.reset}`);
}

// Helper function to generate TOTP code
function generateTOTP(secret) {
  const speakeasy = require('speakeasy');
  return speakeasy.totp({
    secret,
    encoding: 'base32'
  });
}

// Helper to make authenticated requests
async function makeAuthenticatedRequest(method, path, data = null) {
  try {
    const config = {
      method,
      url: `${BASE_URL}${path}`,
      headers: {
        'Cookie': sessionCookie,
        'Content-Type': 'application/json'
      },
      validateStatus: () => true // Don't throw on any status code
    };

    if (data) {
      config.data = data;
    }

    const response = await axios(config);
    return response;
  } catch (error) {
    logError(`Request failed: ${error.message}`);
    throw error;
  }
}

// Authenticate and get session
async function authenticate() {
  try {
    logSection('AUTHENTICATION');

    // First check if test user exists
    const userResult = await dynamodb.send(new GetItemCommand({
      TableName: 'sanctumtools-users',
      Key: { email: { S: TEST_USER.email } }
    }));

    if (!userResult.Item) {
      logWarning('Test user does not exist. Creating test user...');

      // Create test user via signup flow
      const signupResponse = await axios.post(`${BASE_URL}/signup`,
        `email=${TEST_USER.email}`,
        {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          maxRedirects: 0,
          validateStatus: () => true
        }
      );

      // We would need to complete the 2FA setup here
      logError('Test user needs to be created manually with 2FA setup');
      return false;
    }

    const user = unmarshall(userResult.Item);
    const totpCode = generateTOTP(user.totpSecret);

    logTest('Logging in with test user');
    const loginResponse = await axios.post(`${BASE_URL}/login`,
      `email=${TEST_USER.email}&code=${totpCode}`,
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        maxRedirects: 0,
        validateStatus: () => true
      }
    );

    if (loginResponse.status === 302 || loginResponse.status === 200) {
      sessionCookie = loginResponse.headers['set-cookie']?.join('; ');
      if (sessionCookie) {
        logSuccess(`Authenticated as ${TEST_USER.email}`);
        return true;
      }
    }

    logError('Failed to authenticate - no session cookie received');
    return false;
  } catch (error) {
    logError(`Authentication error: ${error.message}`);
    return false;
  }
}

// Test crisis detection
async function testCrisisDetection() {
  logSection('CRISIS DETECTION TESTS');

  const crisisMessages = [
    { message: "I want to die", expectCrisis: true },
    { message: "I'm thinking about killing myself", expectCrisis: true },
    { message: "I can't do this anymore", expectCrisis: true },
    { message: "I'm going to end it all", expectCrisis: true },
    { message: "Life isn't worth living", expectCrisis: true },
    { message: "I want to hurt myself", expectCrisis: true },
    { message: "goodbye forever", expectCrisis: true }
  ];

  const results = [];

  for (const test of crisisMessages) {
    logTest(`Crisis message: "${test.message}"`);

    try {
      const response = await makeAuthenticatedRequest('POST', '/api/chat', {
        message: test.message
      });

      if (response.status === 200) {
        const data = response.data;

        if (data.isCrisis) {
          logSuccess('Crisis detected correctly');

          // Check for 988 mention
          if (data.reply && data.reply.includes('988')) {
            logSuccess('Response includes 988 crisis line');
          } else {
            logError('Response missing 988 crisis line reference');
          }
        } else {
          logError(`Crisis NOT detected for: "${test.message}"`);
        }

        results.push({
          message: test.message,
          detected: data.isCrisis,
          response: data.reply
        });
      } else {
        logError(`HTTP ${response.status}: ${response.data.error || 'Unknown error'}`);
      }
    } catch (error) {
      logError(`Test failed: ${error.message}`);
    }

    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  return results;
}

// Test normal therapeutic responses
async function testTherapeuticResponses() {
  logSection('THERAPEUTIC RESPONSE TESTS');

  const normalMessages = [
    { message: "I'm feeling anxious today", diagnosis: "anxiety" },
    { message: "Hello, how are you?", diagnosis: "general" },
    { message: "I feel sad and empty", diagnosis: "depression" },
    { message: "I'm really angry right now", diagnosis: "anger" },
    { message: "I can't stop worrying about everything", diagnosis: "anxiety" },
    { message: "I feel overwhelmed by my emotions", diagnosis: "bpd" }
  ];

  const results = [];

  for (const test of normalMessages) {
    logTest(`Normal message: "${test.message}"`);

    try {
      const response = await makeAuthenticatedRequest('POST', '/api/chat', {
        message: test.message
      });

      if (response.status === 200) {
        const data = response.data;

        if (data.reply) {
          logSuccess(`Received therapeutic response: ${data.reply.substring(0, 100)}...`);

          // Check for framework-specific language
          const replyLower = data.reply.toLowerCase();

          if (test.diagnosis === 'anxiety' || test.diagnosis === 'depression') {
            // CBT language check
            if (replyLower.includes('thought') || replyLower.includes('evidence') ||
                replyLower.includes('reframe') || replyLower.includes('automatic')) {
              logSuccess('Response includes CBT framework language');
            }
          } else if (test.diagnosis === 'bpd') {
            // DBT language check
            if (replyLower.includes('wise mind') || replyLower.includes('emotion mind') ||
                replyLower.includes('distress') || replyLower.includes('tipp') ||
                replyLower.includes('stop')) {
              logSuccess('Response includes DBT framework language');
            }
          }
        } else {
          logError('No reply received');
        }

        results.push({
          message: test.message,
          response: data.reply,
          isCrisis: data.isCrisis || false
        });
      } else {
        logError(`HTTP ${response.status}: ${response.data.error || 'Unknown error'}`);
      }
    } catch (error) {
      logError(`Test failed: ${error.message}`);
    }

    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  return results;
}

// Test database storage
async function testDatabaseStorage() {
  logSection('DATABASE STORAGE VERIFICATION');

  logTest('Sending test message for DB storage verification');

  const testMessage = `DB test message ${Date.now()}`;

  try {
    const response = await makeAuthenticatedRequest('POST', '/api/chat', {
      message: testMessage
    });

    if (response.status === 200) {
      logSuccess('Message sent successfully');

      // Wait a bit for DB write
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Query DynamoDB for the message
      logTest('Checking DynamoDB for stored message');

      const scanResult = await dynamodb.send(new ScanCommand({
        TableName: 'sanctumtools-chats',
        FilterExpression: 'email = :email AND userMessage = :msg',
        ExpressionAttributeValues: {
          ':email': { S: TEST_USER.email },
          ':msg': { S: testMessage }
        },
        Limit: 1
      }));

      if (scanResult.Items && scanResult.Items.length > 0) {
        const chat = unmarshall(scanResult.Items[0]);
        logSuccess('Message found in DynamoDB!');
        log(`  Chat ID: ${chat.chatId}`, 'cyan');
        log(`  Timestamp: ${new Date(parseInt(chat.timestamp)).toISOString()}`, 'cyan');
        log(`  User Message: ${chat.userMessage}`, 'cyan');
        log(`  Assistant Reply: ${chat.assistantReply}`, 'cyan');
        log(`  Framework: ${chat.therapeuticFramework || 'not specified'}`, 'cyan');
        return true;
      } else {
        logError('Message NOT found in DynamoDB');
        return false;
      }
    }
  } catch (error) {
    logError(`Database test failed: ${error.message}`);
    return false;
  }
}

// Test error handling
async function testErrorHandling() {
  logSection('ERROR HANDLING TESTS');

  const errorTests = [
    {
      name: 'Empty message',
      data: { message: '' },
      expectedStatus: 400,
      expectedError: 'Message is required'
    },
    {
      name: 'Missing message field',
      data: {},
      expectedStatus: 400,
      expectedError: 'Message is required'
    },
    {
      name: 'Very long message',
      data: { message: 'x'.repeat(2001) },
      expectedStatus: 400,
      expectedError: 'Message is too long'
    },
    {
      name: 'Non-string message',
      data: { message: 12345 },
      expectedStatus: 400,
      expectedError: 'Message is required'
    }
  ];

  for (const test of errorTests) {
    logTest(test.name);

    try {
      const response = await makeAuthenticatedRequest('POST', '/api/chat', test.data);

      if (response.status === test.expectedStatus) {
        logSuccess(`Correct status code: ${response.status}`);

        if (response.data.error && response.data.error.includes(test.expectedError)) {
          logSuccess(`Correct error message: "${response.data.error}"`);
        } else {
          logWarning(`Different error message: "${response.data.error}"`);
        }
      } else {
        logError(`Wrong status code: ${response.status} (expected ${test.expectedStatus})`);
      }
    } catch (error) {
      logError(`Test failed: ${error.message}`);
    }
  }
}

// Test different diagnosis types
async function testDiagnosisTypes() {
  logSection('DIAGNOSIS-SPECIFIC FRAMEWORK TESTS');

  // First update user's diagnosis and test
  const diagnoses = [
    {
      diagnosis: 'Anxiety Disorder',
      expectedFramework: 'cbt',
      testMessage: "I'm worried about everything"
    },
    {
      diagnosis: 'Bipolar Disorder',
      expectedFramework: 'dbt',
      testMessage: "My mood is all over the place"
    },
    {
      diagnosis: 'PTSD',
      expectedFramework: 'dbt',
      testMessage: "I keep having flashbacks"
    },
    {
      diagnosis: 'Borderline Personality Disorder',
      expectedFramework: 'dbt',
      testMessage: "I feel so empty inside"
    },
    {
      diagnosis: 'Major Depressive Disorder',
      expectedFramework: 'cbt',
      testMessage: "Everything feels hopeless"
    }
  ];

  for (const test of diagnoses) {
    logTest(`Testing diagnosis: ${test.diagnosis}`);

    // Note: In a real test, we'd update the user's diagnosis in the DB
    // For now, we'll just test the response patterns

    try {
      const response = await makeAuthenticatedRequest('POST', '/api/chat', {
        message: test.testMessage
      });

      if (response.status === 200) {
        const reply = response.data.reply.toLowerCase();

        if (test.expectedFramework === 'dbt') {
          if (reply.includes('mind') || reply.includes('tipp') || reply.includes('stop') ||
              reply.includes('distress') || reply.includes('tolerance')) {
            logSuccess(`DBT framework detected for ${test.diagnosis}`);
          } else {
            logWarning(`DBT markers not found for ${test.diagnosis}`);
          }
        } else if (test.expectedFramework === 'cbt') {
          if (reply.includes('thought') || reply.includes('evidence') ||
              reply.includes('automatic') || reply.includes('reframe')) {
            logSuccess(`CBT framework detected for ${test.diagnosis}`);
          } else {
            logWarning(`CBT markers not found for ${test.diagnosis}`);
          }
        }

        log(`  Response: ${reply.substring(0, 150)}...`, 'cyan');
      }
    } catch (error) {
      logError(`Test failed: ${error.message}`);
    }

    await new Promise(resolve => setTimeout(resolve, 500));
  }
}

// Main test runner
async function runAllTests() {
  console.log(`\n${colors.bright}${colors.magenta}${'='.repeat(60)}${colors.reset}`);
  console.log(`${colors.bright}${colors.magenta}SANCTUMTOOLS CHAT ENDPOINT TEST SUITE${colors.reset}`);
  console.log(`${colors.bright}${colors.magenta}${'='.repeat(60)}${colors.reset}\n`);

  try {
    // Authenticate first
    const authenticated = await authenticate();
    if (!authenticated) {
      logError('Authentication failed. Cannot proceed with tests.');
      process.exit(1);
    }

    // Run all test suites
    const crisisResults = await testCrisisDetection();
    const therapeuticResults = await testTherapeuticResponses();
    const dbStorageResult = await testDatabaseStorage();
    await testErrorHandling();
    await testDiagnosisTypes();

    // Summary
    logSection('TEST SUMMARY');

    log('Crisis Detection Tests:', 'yellow');
    const crisisSuccess = crisisResults.filter(r => r.detected).length;
    log(`  ${crisisSuccess}/${crisisResults.length} crisis messages detected correctly`,
        crisisSuccess === crisisResults.length ? 'green' : 'red');

    log('\nTherapeutic Response Tests:', 'yellow');
    const therapeuticSuccess = therapeuticResults.filter(r => r.response && !r.isCrisis).length;
    log(`  ${therapeuticSuccess}/${therapeuticResults.length} messages received therapeutic responses`,
        therapeuticSuccess === therapeuticResults.length ? 'green' : 'red');

    log('\nDatabase Storage:', 'yellow');
    log(`  ${dbStorageResult ? 'PASSED' : 'FAILED'} - Messages ${dbStorageResult ? 'are' : 'are NOT'} being saved to DynamoDB`,
        dbStorageResult ? 'green' : 'red');

    // Sample outputs
    logSection('SAMPLE OUTPUTS');

    if (crisisResults.length > 0 && crisisResults[0].response) {
      log('Crisis Response Sample:', 'yellow');
      log(crisisResults[0].response, 'white');
    }

    if (therapeuticResults.length > 0) {
      log('\nTherapeutic Response Samples:', 'yellow');
      therapeuticResults.slice(0, 3).forEach(r => {
        log(`\n  Message: "${r.message}"`, 'cyan');
        log(`  Response: "${r.response}"`, 'white');
      });
    }

  } catch (error) {
    logError(`Test suite failed: ${error.message}`);
    console.error(error);
  }
}

// Run tests
runAllTests().then(() => {
  console.log(`\n${colors.bright}${colors.magenta}Test suite completed${colors.reset}\n`);
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});