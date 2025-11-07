/**
 * Create DynamoDB tables for SanctumTools
 */

const { DynamoDBClient, CreateTableCommand, DescribeTableCommand } = require('@aws-sdk/client-dynamodb');

const dynamodb = new DynamoDBClient({ region: 'us-east-1' });

async function createTableIfNotExists(params) {
  const tableName = params.TableName;

  try {
    // Check if table exists
    await dynamodb.send(new DescribeTableCommand({
      TableName: tableName
    }));
    console.log(`✓ Table ${tableName} already exists`);
    return true;
  } catch (error) {
    if (error.name === 'ResourceNotFoundException') {
      // Create the table
      try {
        await dynamodb.send(new CreateTableCommand(params));
        console.log(`✓ Created table ${tableName}`);

        // Wait for table to be active
        let tableActive = false;
        while (!tableActive) {
          await new Promise(resolve => setTimeout(resolve, 2000));
          try {
            const result = await dynamodb.send(new DescribeTableCommand({
              TableName: tableName
            }));
            if (result.Table.TableStatus === 'ACTIVE') {
              tableActive = true;
              console.log(`✓ Table ${tableName} is now active`);
            }
          } catch (e) {
            // Keep waiting
          }
        }
        return true;
      } catch (createError) {
        console.error(`✗ Failed to create table ${tableName}:`, createError.message);
        return false;
      }
    } else {
      console.error(`✗ Error checking table ${tableName}:`, error.message);
      return false;
    }
  }
}

async function createAllTables() {
  console.log('\n════════════════════════════════════════════');
  console.log('    Creating DynamoDB Tables for SanctumTools');
  console.log('════════════════════════════════════════════\n');

  // 1. Users table
  await createTableIfNotExists({
    TableName: 'sanctumtools-users',
    KeySchema: [
      { AttributeName: 'email', KeyType: 'HASH' }
    ],
    AttributeDefinitions: [
      { AttributeName: 'email', AttributeType: 'S' }
    ],
    BillingMode: 'PAY_PER_REQUEST'
  });

  // 2. Sessions table
  await createTableIfNotExists({
    TableName: 'sanctumtools-sessions',
    KeySchema: [
      { AttributeName: 'id', KeyType: 'HASH' }
    ],
    AttributeDefinitions: [
      { AttributeName: 'id', AttributeType: 'S' }
    ],
    BillingMode: 'PAY_PER_REQUEST',
    TimeToLiveSpecification: {
      Enabled: true,
      AttributeName: 'expires'
    }
  });

  // 3. Chats table - THIS IS THE MISSING ONE
  await createTableIfNotExists({
    TableName: 'sanctumtools-chats',
    KeySchema: [
      { AttributeName: 'chatId', KeyType: 'HASH' }
    ],
    AttributeDefinitions: [
      { AttributeName: 'chatId', AttributeType: 'S' },
      { AttributeName: 'email', AttributeType: 'S' },
      { AttributeName: 'timestamp', AttributeType: 'N' }
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: 'email-timestamp-index',
        KeySchema: [
          { AttributeName: 'email', KeyType: 'HASH' },
          { AttributeName: 'timestamp', KeyType: 'RANGE' }
        ],
        Projection: {
          ProjectionType: 'ALL'
        }
      }
    ],
    BillingMode: 'PAY_PER_REQUEST'
  });

  // 4. Crisis events table
  await createTableIfNotExists({
    TableName: 'sanctumtools-crisis-events',
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
  });

  console.log('\n✓ All tables created/verified successfully!\n');
}

// Run the table creation
createAllTables().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});