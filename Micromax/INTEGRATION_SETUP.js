/**
 * INTEGRATION GUIDE - New Broker Architecture
 * Demonstrates how to wire MetaApi + CCXT + ExecutionWrapper + Monitor
 * 
 * Architecture Flow:
 * Signal Hub → ExecutionWrapper → MetaApi/CCXT → Brokers
 *                                ↓
 *                         ExecutionMonitor (tracking)
 */

// ============================================
// 1. INITIALIZATION (Done once at startup)
// ============================================

const ExecutionWrapper = require('./brokers/ExecutionWrapper');
const MetaApiClient = require('./brokers/MetaApiClient');
const CCXTExchangeManager = require('./brokers/CCXTExchangeManager');
const ExecutionMonitor = require('./core/ExecutionMonitor');

// Initialize MetaApi for MT5
const metaApiKey = process.env.META_API_KEY || 'your_metaapi_key_here';
const metaApi = new MetaApiClient(metaApiKey);

// Initialize CCXT for crypto
const ccxtManager = new CCXTExchangeManager();

// Create unified execution layer
const executor = new ExecutionWrapper(metaApi, {
  binance: null,  // Will be initialized on demand
  bitget: null,   // Will be initialized on demand
  bybit: null,
  kucoin: null
});

// Create monitoring system
const monitor = new ExecutionMonitor({
  metricsWindow: 3600000, // 1 hour
  alertThresholds: {
    latencyP95: 500,    // 500ms
    latencyP99: 1000,   // 1000ms
    failureRate: 0.05,  // 5%
    slippageBps: 50     // 50 basis points
  }
});

// Wire up events for monitoring
executor.on('execution:success', (execution) => {
  monitor.recordExecution(execution);
});

executor.on('execution:failed', (execution) => {
  monitor.recordExecution(execution);
  console.warn('❌ Execution failed:', execution);
});

executor.on('execution:error', (execution) => {
  monitor.recordExecution(execution);
  console.error('💥 Execution error:', execution);
});

// ============================================
// 2. SETUP - MT5 Account (Once)
// ============================================

async function setupMT5Account() {
  try {
    const result = await metaApi.connectAccount({
      account: process.env.MT5_ACCOUNT || '12345678',
      password: process.env.MT5_PASSWORD || 'password',
      server: process.env.MT5_SERVER || 'ICMarketsSC-Demo'
    });

    console.log('✅ MT5 Connected:', result);
    return result.accountId;
  } catch (error) {
    console.error('❌ Failed to connect MT5:', error.message);
    throw error;
  }
}

// ============================================
// 3. SETUP - Crypto Exchanges (Once per exchange)
// ============================================

async function setupCryptoExchanges() {
  // Setup Binance
  try {
    await ccxtManager.initExchange('binance', {
      apiKey: process.env.BINANCE_API_KEY,
      apiSecret: process.env.BINANCE_API_SECRET
    });
    console.log('✅ Binance connected');
  } catch (error) {
    console.warn('⚠️ Binance setup failed:', error.message);
  }

  // Setup Bitget
  try {
    await ccxtManager.initExchange('bitget', {
      apiKey: process.env.BITGET_API_KEY,
      apiSecret: process.env.BITGET_API_SECRET,
      passphrase: process.env.BITGET_PASSPHRASE
    });
    console.log('✅ Bitget connected');
  } catch (error) {
    console.warn('⚠️ Bitget setup failed:', error.message);
  }

  // Update executor's CCXT references
  executor.ccxt = ccxtManager.exchanges;
}

// ============================================
// 4. EXECUTE A TRADE (The Main Flow)
// ============================================

async function executeSignalToFollower(signal, follower) {
  /**
   * signal = {
   *   id: 'signal_123',
   *   symbol: 'EURUSD' or 'BTC/USDT',
   *   action: 'BUY' or 'SELL',
   *   volume: 1.0,
   *   stop_loss: 1.095,
   *   take_profit: 1.105,
   *   broker: 'mt5' // Broker hint (optional)
   * }
   * 
   * follower = {
   *   id: 'user_123',
   *   broker_type: 'mt5', // 'mt5', 'binance', 'bitget', etc
   *   credentials: { account, password, server } or { apiKey, apiSecret },
   *   volume_factor: 1.0
   * }
   */

  console.log(`📊 Executing signal for ${follower.id} on ${follower.broker_type}`);

  // Execute (handles routing to MetaApi or CCXT)
  const result = await executor.executeTrade(signal, follower);

  console.log(`⏱️  Execution latency: ${result.latency}ms`);
  console.log(`✅ Order ID: ${result.order_id}`);
  console.log(`📈 Status: ${result.success ? 'SUCCESS' : 'FAILED'}`);

  return result;
}

// ============================================
// 5. BROADCAST SIGNAL TO ALL FOLLOWERS
// ============================================

async function broadcastSignal(signal, followers) {
  /**
   * Execute signal to multiple followers in parallel
   * Different brokers handled automatically
   */

  console.log(`📡 Broadcasting signal ${signal.id} to ${followers.length} followers`);

  const results = await Promise.allSettled(
    followers.map(follower => executeSignalToFollower(signal, follower))
  );

  const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
  const failed = results.filter(r => r.status === 'rejected' || !r.value.success).length;

  console.log(`\n✅ Successful: ${successful}`);
  console.log(`❌ Failed: ${failed}`);

  return { successful, failed, results };
}

// ============================================
// 6. MONITORING & METRICS
// ============================================

function printMetrics() {
  const metrics = monitor.getMetrics();
  
  console.log('\n=== EXECUTION METRICS ===');
  console.log(`⏰ Uptime: ${metrics.uptime}`);
  console.log(`📊 Total Executions: ${metrics.total_executions}`);
  console.log(`✅ Successful: ${metrics.successful_executions}`);
  console.log(`❌ Failed: ${metrics.failed_executions}`);
  console.log(`📈 Success Rate: ${metrics.success_rate}`);
  
  if (metrics.latency && metrics.latency.p95_ms) {
    console.log(`\n⏱️  Latency (p95): ${metrics.latency.p95_ms}ms`);
    console.log(`⏱️  Latency (p99): ${metrics.latency.p99_ms}ms`);
  }

  console.log(`\n🔨 Broker Breakdown:`);
  Object.entries(metrics.broker_breakdown).forEach(([broker, stats]) => {
    console.log(`  ${broker}: ${stats.successful}/${stats.total} (${stats.success_rate})`);
  });

  if (metrics.active_alerts > 0) {
    console.log(`\n⚠️  ${metrics.active_alerts} Active Alerts`);
    metrics.recent_alerts.forEach(alert => {
      console.log(`  - ${alert.severity}: ${alert.message}`);
    });
  }
}

function printDetailedLatency() {
  const analysis = monitor.getLatencyAnalysis();
  
  console.log('\n=== LATENCY ANALYSIS ===');
  console.log(`Sample Size: ${analysis.sample_size}`);
  console.log(`Mean: ${analysis.mean}ms`);
  console.log(`P95: ${analysis.p95}ms ${analysis.p95_alert}`);
  console.log(`P99: ${analysis.p99}ms`);
  console.log(`Std Dev: ${analysis.stddev}ms`);
}

// ============================================
// 7. EXAMPLE USAGE
// ============================================

async function main() {
  try {
    // Setup
    console.log('🚀 Initializing broker infrastructure...\n');
    await setupMT5Account();
    await setupCryptoExchanges();

    // Define test signal
    const testSignal = {
      id: 'signal_001',
      strategy: 'TemiStrategy',
      symbol: 'EURUSD', // Will be routed to MetaApi
      action: 'BUY',
      volume: 1.5,
      stop_loss: 1.095,
      take_profit: 1.105
    };

    // Define test followers
    const followers = [
      {
        id: 'user_mt5_demo',
        broker_type: 'mt5',
        credentials: {
          account: process.env.MT5_ACCOUNT,
          password: process.env.MT5_PASSWORD,
          server: process.env.MT5_SERVER
        },
        volume_factor: 1.0
      },
      {
        id: 'user_binance_spot',
        broker_type: 'binance',
        credentials: {
          apiKey: process.env.BINANCE_API_KEY,
          apiSecret: process.env.BINANCE_API_SECRET
        },
        volume_factor: 0.8
      }
    ];

    // Execute
    console.log('\n🚀 Broadcasting signal to all followers...\n');
    const broadcastResult = await broadcastSignal(testSignal, followers);

    // Monitor
    console.log('\n\n📊 REAL-TIME METRICS:');
    printMetrics();
    printDetailedLatency();

    // Get failure analysis
    const failures = monitor.getFailureAnalysis();
    if (failures.total_failures_in_window > 0) {
      console.log('\n❌ FAILURES:');
      failures.recent_failures.forEach(f => {
        console.log(`  - ${f.executionId}: ${f.error}`);
      });
    }

    // Export full report
    const report = monitor.exportMetrics();
    console.log('\n✅ Full metrics exported. Ready for analysis.');

  } catch (error) {
    console.error('💥 Fatal error:', error.message);
    process.exit(1);
  }
}

// ============================================
// 8. REAL-TIME MONITORING SERVER
// ============================================

async function startMonitoringServer(port = 3001) {
  const express = require('express');
  const app = express();

  // Metrics endpoint
  app.get('/metrics', (req, res) => {
    res.json(monitor.getMetrics());
  });

  // Latency analysis endpoint
  app.get('/metrics/latency', (req, res) => {
    res.json(monitor.getLatencyAnalysis());
  });

  // Broker performance endpoint
  app.get('/metrics/broker/:brokerName', (req, res) => {
    res.json(monitor.getBrokerPerformance(req.params.brokerName));
  });

  // Failure analysis endpoint
  app.get('/metrics/failures', (req, res) => {
    res.json(monitor.getFailureAnalysis(req.query.limit || 10));
  });

  // Alerts endpoint
  app.get('/metrics/alerts', (req, res) => {
    res.json(monitor.getAlerts());
  });

  // Full export endpoint
  app.get('/metrics/export', (req, res) => {
    res.json(monitor.exportMetrics());
  });

  app.listen(port, () => {
    console.log(`📊 Monitoring server running on http://localhost:${port}`);
    console.log(`   - GET /metrics           (summary)`);
    console.log(`   - GET /metrics/latency   (detailed latency)`);
    console.log(`   - GET /metrics/broker/:name`);
    console.log(`   - GET /metrics/failures`);
    console.log(`   - GET /metrics/alerts`);
    console.log(`   - GET /metrics/export    (full report)`);
  });
}

// ============================================
// EXPORTS for use in other modules
// ============================================

module.exports = {
  executor,
  metaApi,
  ccxtManager,
  monitor,
  setupMT5Account,
  setupCryptoExchanges,
  executeSignalToFollower,
  broadcastSignal,
  printMetrics,
  printDetailedLatency,
  startMonitoringServer,
  main
};

// Run if executed directly
if (require.main === module) {
  main().catch(console.error);
}
