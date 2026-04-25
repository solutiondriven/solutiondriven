GET    /api/revenue/stats          (platform totals)
GET    /api/revenue/user?userId=X  (user breakdown)
GET    /api/revenue/by-broker      (broker breakdown)
GET    /api/revenue/top-users      (leaderboard)
GET    /api/revenue/export         (CSV/JSON export)        #!/usr/bin/env node

/**
 * API smoke test for the copy-trading routes.
 * This validates request/response flow only.
 * Use test-real-execution.js plus broker UI checks for live execution proof.
 */

const http = require('http');

function makeRequest(method, requestPath, data) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: 'localhost',
        port: 3000,
        path: requestPath,
        method,
        headers: {
          'Content-Type': 'application/json',
        },
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => {
          body += chunk;
        });
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(body) });
          } catch {
            resolve({ status: res.statusCode, data: body });
          }
        });
      }
    );

    req.on('error', reject);

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

async function runTests() {
  console.log('\nAPI smoke test starting');
  console.log('This validates route behavior only, not broker-side fills.\n');

  try {
    console.log('TEST 1: Health Check');
    let result = await makeRequest('GET', '/api/health');
    console.log(`  Status: ${result.status}`);
    console.log(`  Response: ${JSON.stringify(result.data)}\n`);

    console.log('TEST 2: Create Signal');
    result = await makeRequest('POST', '/api/signals/create', {
      strategy: 'TemiStrategy',
      symbol: 'EURUSD',
      action: 'BUY',
      volume: 1.5,
      stop_loss: 1.095,
      take_profit: 1.105,
    });
    console.log(`  Status: ${result.status}`);
    const signalId = result.data.signal?.id;
    console.log(`  Signal ID: ${signalId}`);
    console.log(`  Signal: ${JSON.stringify(result.data.signal, null, 2)}\n`);

    if (!signalId) {
      throw new Error('No signal ID returned');
    }

    console.log('TEST 3: Add Followers');

    result = await makeRequest('POST', '/api/followers/add', {
      follower_id: 'user_mt5_account',
      broker_type: 'mt5',
      volume_factor: 1.0,
    });
    console.log(`  MT5 follower: ${result.status}`);
    console.log(`  ${JSON.stringify(result.data)}\n`);

    result = await makeRequest('POST', '/api/followers/add', {
      follower_id: 'user_binance_account',
      broker_type: 'binance',
      volume_factor: 0.8,
    });
    console.log(`  Binance follower: ${result.status}`);
    console.log(`  ${JSON.stringify(result.data)}\n`);

    result = await makeRequest('POST', '/api/followers/add', {
      follower_id: 'user_bitget_account',
      broker_type: 'bitget',
      volume_factor: 0.5,
    });
    console.log(`  Bitget follower: ${result.status}`);
    console.log(`  ${JSON.stringify(result.data)}\n`);

    console.log('TEST 4: List Followers');
    result = await makeRequest('GET', '/api/followers');
    console.log(`  Status: ${result.status}`);
    console.log(`  Count: ${result.data.count}`);
    console.log(`  Followers: ${JSON.stringify(result.data.followers, null, 2)}\n`);

    console.log('TEST 5: Broadcast Signal');
    result = await makeRequest('POST', `/api/signals/${signalId}/broadcast`);
    console.log(`  Status: ${result.status}`);
    console.log(`  Executions: ${result.data.executions?.length || 0}`);
    console.log(`  Response: ${JSON.stringify(result.data, null, 2)}\n`);

    console.log('TEST 6: Sync Stop Loss & Take Profit');
    result = await makeRequest('PUT', `/api/signals/${signalId}/sync`, {
      stop_loss: 1.09,
      take_profit: 1.11,
    });
    console.log(`  Status: ${result.status}`);
    console.log(`  Response: ${JSON.stringify(result.data, null, 2)}\n`);

    console.log('TEST 7: Copy-Trading Status');
    result = await makeRequest('GET', '/api/copy-trading/status');
    console.log(`  Status: ${result.status}`);
    console.log(`  Response: ${JSON.stringify(result.data, null, 2)}\n`);

    console.log('TEST 8: Close Signal');
    result = await makeRequest('POST', `/api/signals/${signalId}/close`);
    console.log(`  Status: ${result.status}`);
    console.log(`  Response: ${JSON.stringify(result.data, null, 2)}\n`);

    console.log('Smoke test complete');
    console.log('Use api/test-real-execution.js plus broker UI verification for real execution proof.\n');
    process.exit(0);
  } catch (error) {
    console.error(`Smoke test failed: ${error.message}`);
    process.exit(1);
  }
}

setTimeout(runTests, 1000);
