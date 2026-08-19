// Quick Snowflake connection test — loads .env manually
const fs = require('fs');
const path = require('path');

// Simple .env loader
const envFile = fs.readFileSync(path.join(__dirname, '.env'), 'utf8');
envFile.split('\n').forEach(line => {
  line = line.trim();
  if (!line || line.startsWith('#')) return;
  const idx = line.indexOf('=');
  if (idx < 0) return;
  const key = line.substring(0, idx).trim();
  const val = line.substring(idx + 1).trim();
  if (!process.env[key]) process.env[key] = val;
});

const snowflake = require('snowflake-sdk');

const account = process.env.SNOWFLAKE_ACCOUNT || '';
const username = process.env.SNOWFLAKE_USERNAME || process.env.SNOWFLAKE_USER || '';
const password = process.env.SNOWFLAKE_PASSWORD || '';
const role = process.env.SNOWFLAKE_ROLE || 'ACCOUNTADMIN';
const warehouse = process.env.SNOWFLAKE_WAREHOUSE || 'COMPUTE_WH';

console.log('=== Snowflake Connection Test ===');
console.log('Account:', account);
console.log('Username:', username);
console.log('Role:', role);
console.log('Warehouse:', warehouse);

// Test what hostname the SDK constructs
const Util = require('snowflake-sdk/lib/util');
const constructedHost = Util.constructHostname(null, account);
console.log('\nConstructed hostname:', constructedHost);

// Try connecting
const connection = snowflake.createConnection({
  account,
  username,
  password,
  role,
  warehouse,
});

console.log('\nAttempting connection...');
connection.connect((err, conn) => {
  if (err) {
    console.error('\n❌ Connection FAILED:');
    console.error('Error code:', err.code);
    console.error('Message:', err.message);
    if (err.cause) {
      console.error('Cause host:', err.cause.host);
      console.error('Cause:', err.cause.message);
    }
    process.exit(1);
  } else {
    console.log('\n✅ Connected successfully!');
    console.log('Connection ID:', conn.getId());

    // Run a test query
    conn.execute({
      sqlText: 'SELECT CURRENT_USER(), CURRENT_ROLE(), CURRENT_WAREHOUSE(), CURRENT_VERSION()',
      complete: (err, stmt, rows) => {
        if (err) {
          console.error('Query error:', err.message);
        } else {
          console.log('Query result:', JSON.stringify(rows, null, 2));
        }
        conn.destroy((err) => {
          if (err) console.error('Disconnect error:', err.message);
          else console.log('Disconnected.');
          process.exit(0);
        });
      },
    });
  }
});
