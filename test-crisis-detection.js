#!/usr/bin/env node

/**
 * Test script for crisis detection functionality
 * Run with: node test-crisis-detection.js
 */

// Import the crisis detection function (we'll need to export it from server.js for this to work in production)
// For now, let's copy the function here for testing

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

// Test cases
const testCases = [
  // Should trigger crisis mode
  { message: "I want to kill myself", expectCrisis: true },
  { message: "I'm going to hurt myself", expectCrisis: true },
  { message: "There's no point living anymore", expectCrisis: true },
  { message: "I wish I was dead", expectCrisis: true },
  { message: "I can't do this anymore", expectCrisis: true },
  { message: "I have a plan to die", expectCrisis: true },
  { message: "thinking about ending it all", expectCrisis: true },
  { message: "I'm feeling extremely depressed, maybe a 10", expectCrisis: true },
  { message: "Feeling hopeless at level 9", expectCrisis: true },
  { message: "I want to OD on pills", expectCrisis: true },

  // Should NOT trigger crisis mode
  { message: "I feel really sad", expectCrisis: false },
  { message: "I'm anxious about my presentation", expectCrisis: false },
  { message: "I'm feeling down today", expectCrisis: false },
  { message: "I'm frustrated with my job", expectCrisis: false },
  { message: "I need help with anxiety", expectCrisis: false },
  { message: "My mood is a 3 today", expectCrisis: false },
  { message: "I'm tired", expectCrisis: false },
  { message: "Hello, how are you?", expectCrisis: false }
];

console.log('Crisis Detection Test Suite');
console.log('===========================\n');

let passed = 0;
let failed = 0;

testCases.forEach((test, index) => {
  const result = detectCrisisKeywords(test.message);
  const success = result.isCrisis === test.expectCrisis;

  if (success) {
    passed++;
    console.log(`✅ Test ${index + 1} PASSED`);
  } else {
    failed++;
    console.log(`❌ Test ${index + 1} FAILED`);
  }

  console.log(`   Message: "${test.message}"`);
  console.log(`   Expected crisis: ${test.expectCrisis}`);
  console.log(`   Detected crisis: ${result.isCrisis}`);
  if (result.keywords.length > 0) {
    console.log(`   Keywords found: ${result.keywords.join(', ')}`);
  }
  console.log('');
});

console.log('===========================');
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log(`Total: ${testCases.length} tests`);

if (failed === 0) {
  console.log('\n✅ All tests passed! Crisis detection is working correctly.');
  process.exit(0);
} else {
  console.log(`\n❌ ${failed} test(s) failed. Please review the crisis detection logic.`);
  process.exit(1);
}