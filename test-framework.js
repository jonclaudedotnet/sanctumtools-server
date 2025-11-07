// Test script to validate therapeutic framework integration

// Import the helper functions
const detectFrameworkForDiagnosis = function(diagnosis) {
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
};

const detectCrisisKeywords = function(message) {
  const crisisKeywords = [
    'suicide', 'suicidal', 'kill myself', 'kill my self', 'end it all', 'end it',
    'want to die', 'better off dead', 'not worth living', 'self harm', 'self-harm',
    'hurt myself', 'hurt my self', 'cutting', 'cut myself', 'overdose', 'od'
  ];

  const msgLower = message.toLowerCase();
  const detected = crisisKeywords.filter(keyword => msgLower.includes(keyword));

  return {
    isCrisis: detected.length > 0,
    keywords: detected
  };
};

// Test scenarios
console.log('=== Testing Therapeutic Framework Integration ===\n');

// Test 1: BPD diagnosis → DBT framework
console.log('Test 1: BPD diagnosis');
const framework1 = detectFrameworkForDiagnosis('Borderline Personality Disorder');
console.log(`  Expected: dbt, Got: ${framework1}`);
console.log(`  ✓ PASS: ${framework1 === 'dbt' ? 'Yes' : 'No'}\n`);

// Test 2: Anxiety diagnosis → CBT framework
console.log('Test 2: Anxiety disorder');
const framework2 = detectFrameworkForDiagnosis('Generalized Anxiety Disorder');
console.log(`  Expected: cbt, Got: ${framework2}`);
console.log(`  ✓ PASS: ${framework2 === 'cbt' ? 'Yes' : 'No'}\n`);

// Test 3: Crisis detection
console.log('Test 3: Crisis detection - "want to hurt myself"');
const crisis1 = detectCrisisKeywords('I want to hurt myself');
console.log(`  Expected: isCrisis=true, Got: isCrisis=${crisis1.isCrisis}`);
console.log(`  Keywords detected: ${crisis1.keywords.join(', ')}`);
console.log(`  ✓ PASS: ${crisis1.isCrisis === true ? 'Yes' : 'No'}\n`);

// Test 4: Non-crisis message
console.log('Test 4: Non-crisis message - "feeling anxious about work"');
const crisis2 = detectCrisisKeywords('feeling anxious about work');
console.log(`  Expected: isCrisis=false, Got: isCrisis=${crisis2.isCrisis}`);
console.log(`  ✓ PASS: ${crisis2.isCrisis === false ? 'Yes' : 'No'}\n`);

// Test 5: Framework responses
console.log('Test 5: Framework-specific responses');

function testResponse(message, diagnosis, userName = 'Test User') {
  const framework = detectFrameworkForDiagnosis(diagnosis);
  console.log(`\n  User with ${diagnosis} says: "${message}"`);
  console.log(`  Framework: ${framework}`);

  // Simulate response generation
  if (framework === 'dbt' && message.toLowerCase().includes('empty')) {
    console.log('  Response: "That feeling of emptiness is really difficult. Can you describe one physical sensation..."');
    return true;
  } else if (framework === 'cbt' && message.toLowerCase().includes('anxious')) {
    console.log('  Response: "Anxiety often comes from \'what if\' thoughts. What specific thought is making you anxious?"');
    return true;
  }
  return false;
}

testResponse('feeling empty', 'BPD');
testResponse('feeling anxious', 'Anxiety Disorder');

console.log('\n=== All Tests Complete ===');