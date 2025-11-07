#!/usr/bin/env node

/**
 * Test Session Persistence Across Server Restarts
 *
 * This test:
 * 1. Creates a login session
 * 2. Saves the session cookie
 * 3. Simulates server restart (kills and restarts)
 * 4. Verifies session still works with saved cookie
 */

const axios = require('axios');
const speakeasy = require('speakeasy');
const { DynamoDBClient, GetItemCommand, ScanCommand } = require('@aws-sdk/client-dynamodb');
const { unmarshall } = require('@aws-sdk/util-dynamodb');
const { exec, spawn } = require('child_process');
const { promisify } = require('util');

const execPromise = promisify(exec);

const BASE_URL = 'http://localhost:3000';
const TEST_EMAIL = 'contact@jonclaude.net';

// Create axios instance
const axiosInstance = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
  validateStatus: () => true,
  maxRedirects: 0,
  headers: {
    'User-Agent': 'SanctumTools-Persistence-Test'
  }
});

// DynamoDB client
const dynamodb = new DynamoDBClient({ region: 'us-east-1' });

async function getUserSecret(email) {
  const result = await dynamodb.send(new GetItemCommand({
    TableName: 'sanctumtools-users',
    Key: { email: { S: email } }
  }));

  if (!result.Item) {
    throw new Error(`User ${email} not found`);
  }

  const user = unmarshall(result.Item);
  return user.totpSecret;
}

async function generateTOTP(secret) {
  return speakeasy.totp({
    secret: secret,
    encoding: 'base32',
    window: 2
  });
}

async function killServer() {
  console.log('\n🔴 Killing server...');
  try {
    await execPromise('pkill -f "node.*server.js"');
    console.log('  Server killed');
  } catch (error) {
    console.log('  No server process found');
  }
  await new Promise(resolve => setTimeout(resolve, 2000));
}

async function startServer() {
  console.log('\n🟢 Starting server...');
  const serverProcess = spawn('node', ['server.js'], {
    cwd: '/home/jonclaude/Agents/Virgo/sanctumtools-server',
    detached: true,
    stdio: 'ignore'
  });
  serverProcess.unref();

  // Wait for server to be ready
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Verify server is running
  try {
    await axios.get(`${BASE_URL}/`);
    console.log('  Server started successfully');
    return serverProcess.pid;
  } catch (error) {
    console.error('  Failed to start server');
    throw error;
  }
}

async function getSessionsInDynamoDB() {
  const result = await dynamodb.send(new ScanCommand({
    TableName: 'sanctumtools-sessions-new'
  }));
  return result.Count;
}

async function testSessionPersistence() {
  console.log('=== Testing Session Persistence Across Server Restart ===\n');

  let sessionCookie = null;
  let sessionId = null;

  try {
    // Step 1: Login and create session
    console.log('📝 Step 1: Creating login session...');

    // Get TOTP secret
    const secret = await getUserSecret(TEST_EMAIL);
    const code = await generateTOTP(secret);

    // Create cookie jar for first request
    let cookies = {};

    // Configure axios to capture cookies
    const loginInstance = axios.create({
      baseURL: BASE_URL,
      withCredentials: true,
      validateStatus: () => true,
      maxRedirects: 0
    });

    // Capture cookies from response
    loginInstance.interceptors.response.use(response => {
      const setCookies = response.headers['set-cookie'];
      if (setCookies) {
        setCookies.forEach(cookie => {
          const [nameValue] = cookie.split(';');
          const [name, value] = nameValue.split('=');
          if (name && value && name.trim() === 'sanctum.sid') {
            sessionCookie = value.trim();
            console.log('  Session cookie captured:', sessionCookie.substring(0, 20) + '...');
          }
        });
      }
      return response;
    });

    // Login
    const loginResponse = await loginInstance.post('/login',
      `email=${encodeURIComponent(TEST_EMAIL)}&code=${code}`,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    if (loginResponse.status !== 302) {
      throw new Error('Login failed');
    }

    console.log('  ✅ Login successful');

    // Check session status with the cookie
    const sessionCheckResponse = await axiosInstance.get('/api/session-status', {
      headers: {
        'Cookie': `sanctum.sid=${sessionCookie}`
      }
    });

    sessionId = sessionCheckResponse.data.sessionId;
    console.log('  Session ID:', sessionId);
    console.log('  Authenticated:', sessionCheckResponse.data.authenticated);
    console.log('  User:', sessionCheckResponse.data.user);

    // Check sessions in DynamoDB before restart
    const sessionsBeforeRestart = await getSessionsInDynamoDB();
    console.log('  Sessions in DynamoDB before restart:', sessionsBeforeRestart);

    // Step 2: Kill server
    await killServer();

    // Step 3: Start server again
    const serverPid = await startServer();
    console.log('  Server PID:', serverPid);

    // Step 4: Test session with saved cookie
    console.log('\n📝 Step 4: Testing session after restart...');

    const afterRestartResponse = await axiosInstance.get('/api/session-status', {
      headers: {
        'Cookie': `sanctum.sid=${sessionCookie}`
      }
    });

    console.log('  Session ID after restart:', afterRestartResponse.data.sessionId);
    console.log('  Authenticated after restart:', afterRestartResponse.data.authenticated);
    console.log('  User after restart:', afterRestartResponse.data.user);
    console.log('  Session persisted:', afterRestartResponse.data.authenticated ? '✅ YES' : '❌ NO');

    // Check sessions in DynamoDB after restart
    const sessionsAfterRestart = await getSessionsInDynamoDB();
    console.log('  Sessions in DynamoDB after restart:', sessionsAfterRestart);

    // Test accessing protected route with persisted session
    console.log('\n📝 Step 5: Testing protected route access...');
    const dashboardResponse = await axiosInstance.get('/dashboard', {
      headers: {
        'Cookie': `sanctum.sid=${sessionCookie}`
      }
    });

    console.log('  Dashboard access:', dashboardResponse.status === 200 ? '✅ Allowed' : '❌ Blocked');

    // Step 6: Test 7-day persistence
    console.log('\n📝 Step 6: Checking session TTL...');
    console.log('  Cookie Max Age:', afterRestartResponse.data.cookieMaxAge, 'ms');
    console.log('  Days until expiry:', Math.floor(afterRestartResponse.data.cookieMaxAge / (1000 * 60 * 60 * 24)));
    console.log('  Cookie Expires:', afterRestartResponse.data.cookieExpires);

    // Summary
    console.log('\n=== Persistence Test Summary ===');
    console.log('✅ Session created:', sessionCookie ? 'PASSED' : 'FAILED');
    console.log('✅ Server restart:', serverPid ? 'PASSED' : 'FAILED');
    console.log('✅ Session persisted:', afterRestartResponse.data.authenticated ? 'PASSED' : 'FAILED');
    console.log('✅ Same session ID:', sessionId === afterRestartResponse.data.sessionId ? 'PASSED' : 'FAILED');
    console.log('✅ Protected route access:', dashboardResponse.status === 200 ? 'PASSED' : 'FAILED');
    console.log('✅ 7-day TTL configured:', afterRestartResponse.data.cookieMaxAge >= 604800000 ? 'PASSED' : 'FAILED');
    console.log('✅ Sessions in DynamoDB:', sessionsAfterRestart > 0 ? 'PASSED' : 'FAILED');

    console.log('\n🎉 All session persistence tests completed!');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

// Run the test
testSessionPersistence().catch(console.error);