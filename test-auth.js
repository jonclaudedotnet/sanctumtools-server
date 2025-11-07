#!/usr/bin/env node

/**
 * Test Authentication and Session Persistence
 *
 * This script tests:
 * 1. Login flow with 2FA
 * 2. Session creation in DynamoDB
 * 3. Session persistence across requests
 * 4. Logout functionality
 * 5. Route protection
 */

const axios = require('axios');
const speakeasy = require('speakeasy');
const { DynamoDBClient, GetItemCommand } = require('@aws-sdk/client-dynamodb');
const { unmarshall } = require('@aws-sdk/util-dynamodb');

const BASE_URL = 'http://localhost:3000';
const TEST_EMAIL = 'contact@jonclaude.net';

// Create axios instance with cookie jar
const axiosInstance = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
  validateStatus: () => true, // Don't throw on non-2xx
  maxRedirects: 0, // Don't follow redirects automatically
  headers: {
    'User-Agent': 'SanctumTools-Test'
  }
});

// Cookie storage
let cookies = {};

// Intercept requests to add cookies
axiosInstance.interceptors.request.use(config => {
  const cookieString = Object.entries(cookies)
    .map(([key, value]) => `${key}=${value}`)
    .join('; ');
  if (cookieString) {
    config.headers.Cookie = cookieString;
  }
  return config;
});

// Intercept responses to save cookies
axiosInstance.interceptors.response.use(response => {
  const setCookies = response.headers['set-cookie'];
  if (setCookies) {
    setCookies.forEach(cookie => {
      const [nameValue] = cookie.split(';');
      const [name, value] = nameValue.split('=');
      if (name && value) {
        cookies[name.trim()] = value.trim();
      }
    });
  }
  return response;
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

async function testSessionStatus(description) {
  console.log(`\n📊 ${description}`);
  const response = await axiosInstance.get('/api/session-status');
  console.log('  Status:', response.status);
  console.log('  Authenticated:', response.data.authenticated);
  console.log('  User:', response.data.user);
  console.log('  Session ID:', response.data.sessionId);
  console.log('  Cookie MaxAge:', response.data.cookieMaxAge);
  return response.data;
}

async function testProtectedRoute(route, description) {
  console.log(`\n🔒 Testing protected route: ${route} - ${description}`);
  const response = await axiosInstance.get(route);
  console.log('  Status:', response.status);
  console.log('  Redirected:', response.status === 302 ? 'Yes' : 'No');
  if (response.status === 302) {
    console.log('  Location:', response.headers.location);
  }
  return response.status !== 302; // Return true if accessed successfully
}

async function testLogin() {
  console.log('\n=== Testing Login Flow ===\n');

  try {
    // Get TOTP secret for test user
    console.log('🔑 Getting TOTP secret for', TEST_EMAIL);
    const secret = await getUserSecret(TEST_EMAIL);
    console.log('  Secret retrieved:', secret.substring(0, 4) + '****');

    // Generate TOTP code
    const code = await generateTOTP(secret);
    console.log('  Generated TOTP code:', code);

    // Check session before login
    await testSessionStatus('Before login');

    // Attempt login
    console.log('\n🚀 Attempting login...');
    const loginResponse = await axiosInstance.post('/login',
      `email=${encodeURIComponent(TEST_EMAIL)}&code=${code}`,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    console.log('  Login response status:', loginResponse.status);
    if (loginResponse.status === 302) {
      console.log('  Redirect location:', loginResponse.headers.location);
      console.log('  ✅ Login successful!');
    } else {
      console.log('  ❌ Login failed');
      if (loginResponse.data) {
        console.log('  Response:', loginResponse.data.substring(0, 200));
      }
    }

    // Check session after login
    const sessionAfterLogin = await testSessionStatus('After login');

    // Test protected routes
    console.log('\n=== Testing Route Protection ===');
    const dashboardAccess = await testProtectedRoute('/dashboard', 'Dashboard');
    const chatAccess = await testProtectedRoute('/chat', 'Chat');
    const onboardingAccess = await testProtectedRoute('/onboarding', 'Onboarding');

    // Test API endpoint protection
    console.log('\n🔒 Testing API protection: /api/chat');
    const apiResponse = await axiosInstance.post('/api/chat', {
      message: 'Test message'
    });
    console.log('  API Status:', apiResponse.status);
    console.log('  API Access:', apiResponse.status !== 401 ? '✅ Allowed' : '❌ Blocked');

    // Test logout
    console.log('\n=== Testing Logout ===');
    console.log('🚪 Logging out...');
    const logoutResponse = await axiosInstance.get('/logout');
    console.log('  Logout response status:', logoutResponse.status);
    if (logoutResponse.status === 302) {
      console.log('  Redirect location:', logoutResponse.headers.location);
    }

    // Check session after logout
    const sessionAfterLogout = await testSessionStatus('After logout');

    // Test protected route after logout
    const dashboardAfterLogout = await testProtectedRoute('/dashboard', 'Dashboard after logout');

    // Summary
    console.log('\n=== Test Summary ===');
    console.log('✅ Login:', loginResponse.status === 302 ? 'PASSED' : 'FAILED');
    console.log('✅ Session created:', sessionAfterLogin.authenticated ? 'PASSED' : 'FAILED');
    console.log('✅ Protected routes (logged in):', dashboardAccess ? 'PASSED' : 'FAILED');
    console.log('✅ API protection (logged in):', apiResponse.status !== 401 ? 'PASSED' : 'FAILED');
    console.log('✅ Logout:', logoutResponse.status === 302 ? 'PASSED' : 'FAILED');
    console.log('✅ Session cleared:', !sessionAfterLogout.authenticated ? 'PASSED' : 'FAILED');
    console.log('✅ Protected routes (logged out):', !dashboardAfterLogout ? 'PASSED' : 'FAILED');

    // Check DynamoDB for session persistence
    console.log('\n=== Checking DynamoDB Session Storage ===');
    const scanCommand = {
      TableName: 'sanctumtools-sessions-new'
    };
    const { exec } = require('child_process');
    exec(`aws dynamodb scan --table-name sanctumtools-sessions-new --region us-east-1 --output json | jq '.Count'`, (err, stdout) => {
      if (!err) {
        console.log('📊 Total sessions in DynamoDB:', stdout.trim());
      }
    });

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

// Run the test
testLogin().catch(console.error);