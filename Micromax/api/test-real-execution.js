#!/usr/bin/env node

/**
 * Real execution validation script.
 *
 * It does not declare success unless the server returns broker-level receipts.
 * It also surfaces blocked or simulated brokers instead of hiding them.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

function makeRequest(method, requestPath, data) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: 'localhost',
        port: 3000,
        path: requestPath,
        method,
        headers: { 'Content-Type': 'application/json' },
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
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

function loadCredentials() {
  const envPath = path.join(__dirname, '..', '.env.json');

  if (!fs.existsSync(envPath)) {
    throw new Error(`Missing ${envPath}. Create it before running this validation.`);
  }

  return JSON.parse(fs.readFileSync(envPath, 'utf8'));
}

function pickTestSignal(credentials) {
  if (credentials.test_signal) {
    return credentials.test_signal;
  }

  return {
    strategy: 'RealExecutionValidation',
    symbol: 'EURUSD',
    action: 'BUY',
    volume: 0.01,
    stop_loss: 1.09,
    take_profit: 1.11,
  };
}

async function main() {
  const credentials = loadCredentials();
  const signalInput = pickTestSignal(credentials);

  console.log(`Validation date: ${new Date().toISOString()}`);
  console.log('Step 1: checking server health and broker readiness');

  const health = await makeRequest('GET', '/api/health');
  if (health.status !== 200) {
    throw new Error('Server is not responding. Start it with: node api/server-real.js');
  }

  const statusResult = await makeRequest('GET', '/api/bridges/status');
  const brokers = statusResult.data.brokers || {};

  Object.values(brokers).forEach((broker) => {
    console.log(
      ` - ${broker.broker_type}: status=${broker.status}, mode=${broker.execution_mode}, ready=${broker.ready}`
    );
    if (broker.error) {
      console.log(`   error=${broker.error}`);
    }
  });

  console.log('\nStep 2: creating validation signal');
  const signalResponse = await makeRequest('POST', '/api/signals/create', signalInput);
  if (!signalResponse.data?.signal?.id) {
    throw new Error(`Signal creation failed: ${JSON.stringify(signalResponse.data)}`);
  }

  const signalId = signalResponse.data.signal.id;
  console.log(`Created signal ${signalId} for ${signalInput.symbol} ${signalInput.action}`);

  console.log('\nStep 3: registering followers that can be tested honestly');
  const followerSpecs = [];

  if (brokers.mt5?.configured) {
    followerSpecs.push({
      follower_id: 'mt5_validation',
      broker_type: 'mt5',
      volume_factor: 1.0,
      symbol_map: credentials.mt5?.symbol_map || {},
    });
  }

  if (brokers.binance?.configured) {
    followerSpecs.push({
      follower_id: 'binance_validation',
      broker_type: 'binance',
      volume_factor: 1.0,
      symbol_map: credentials.binance?.symbol_map || {},
    });
  }

  if (brokers.bitget?.configured) {
    followerSpecs.push({
      follower_id: 'bitget_validation',
      broker_type: 'bitget',
      volume_factor: 1.0,
      symbol_map: credentials.bitget?.symbol_map || {},
    });
  }

  for (const follower of followerSpecs) {
    const result = await makeRequest('POST', '/api/followers/add', follower);
    console.log(
      ` - ${follower.broker_type}: register status=${result.status}, bridge=${result.data.bridge?.status}`
    );
  }

  console.log('\nStep 4: broadcasting signal and collecting execution receipts');
  const broadcast = await makeRequest('POST', `/api/signals/${signalId}/broadcast`);
  if (broadcast.status >= 400) {
    throw new Error(`Broadcast failed: ${JSON.stringify(broadcast.data)}`);
  }

  const executions = broadcast.data.executions || [];
  if (executions.length === 0) {
    throw new Error('No followers were registered, so nothing was validated.');
  }

  let realSuccesses = 0;
  let honestFailures = 0;

  executions.forEach((execution) => {
    const summary = [
      execution.success ? 'SUCCESS' : 'FAIL',
      execution.broker_type,
      `status=${execution.status}`,
      `latency_ms=${execution.latency_ms}`,
      `order_id=${execution.order_id || 'n/a'}`,
      `price=${execution.filled_price || execution.price || 'n/a'}`,
    ].join(' | ');

    console.log(` - ${summary}`);
    if (execution.error) {
      console.log(`   error=${execution.error}`);
    }

    if (execution.success && execution.live_execution) {
      realSuccesses += 1;
    } else {
      honestFailures += 1;
    }
  });

  console.log('\nStep 5: verification checklist');
  console.log(' - Confirm each successful MT5 execution in the MT5 terminal or broker UI.');
  console.log(' - Confirm each successful Binance execution in Binance order history.');
  console.log(' - Treat Bitget as NOT DONE until a real API integration replaces the blocked placeholder.');
  console.log(' - Record signal_created -> completed_at and compare with filled price for slippage.');

  console.log('\nValidation summary');
  console.log(` - real broker executions: ${realSuccesses}`);
  console.log(` - blocked or failed executions: ${honestFailures}`);
  console.log(` - signal id: ${signalId}`);
}

main().catch((error) => {
  console.error(`Validation failed: ${error.message}`);
  process.exit(1);
});
