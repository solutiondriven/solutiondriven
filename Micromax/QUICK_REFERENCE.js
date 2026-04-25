/**
 * QUICK REFERENCE - Common Operations
 * Copy-paste ready code for the most frequent tasks
 */

const ExecutionWrapper = require('./brokers/ExecutionWrapper');
const MetaApiClient = require('./brokers/MetaApiClient');
const CCXTExchangeManager = require('./brokers/CCXTExchangeManager');
const ExecutionMonitor = require('./core/ExecutionMonitor');

// ============================================
// OPERATION 1: Execute Single Trade
// ============================================
async function executeTrade_MT5() {
  const executor = new ExecutionWrapper(metaApi, ccxtManager.exchanges);
  
  const signal = {
    id: 'sig_' + Date.now(),
    symbol: 'EURUSD',
    action: 'BUY',
    volume: 1.0,
    stop_loss: 1.095,
    take_profit: 1.105
  };

  const follower = {
    id: 'trader_john',
    broker_type: 'mt5',
    credentials: { account: 12345678, password: 'pwd', server: 'ICMarketsSC-Demo' },
    volume_factor: 1.0
  };

  const result = await executor.executeTrade(signal, follower);
  
  if (result.success) {
    console.log(`✅ Order ${result.order_id} executed in ${result.latency}ms`);
  } else {
    console.error(`❌ Failed: ${result.error}`);
  }
  
  return result;
}

// ============================================
// OPERATION 2: Execute Crypto Trade
// ============================================
async function executeTrade_Crypto() {
  const executor = new ExecutionWrapper(metaApi, ccxtManager.exchanges);
  
  const signal = {
    id: 'sig_' + Date.now(),
    symbol: 'BTC/USDT',
    action: 'BUY',
    volume: 0.1,
    stop_loss: 40000,
    take_profit: 50000
  };

  const follower = {
    id: 'crypto_follower_1',
    broker_type: 'binance',
    credentials: { apiKey: 'key...', apiSecret: 'secret...' },
    volume_factor: 1.0
  };

  const result = await executor.executeTrade(signal, follower);
  console.log(`Execution: ${result.success ? '✅' : '❌'} ${result.latency}ms`);
  return result;
}

// ============================================
// OPERATION 3: Broadcast to All Followers
// ============================================
async function broadcastToAllFollowers(signal, followers) {
  const executor = new ExecutionWrapper(metaApi, ccxtManager.exchanges);
  
  console.log(`📡 Broadcasting to ${followers.length} followers...`);
  
  const results = await Promise.allSettled(
    followers.map(f => executor.executeTrade(signal, f))
  );

  const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
  const failed = results.length - successful;

  console.log(`Results: ${successful}✅ ${failed}❌`);
  return results;
}

// ============================================
// OPERATION 4: Modify Position (MT5 only)
// ============================================
async function modifyPositionSL_TP() {
  const metaApi = new MetaApiClient(process.env.META_API_KEY);
  
  const follower = {
    broker_type: 'mt5',
    credentials: { account: 12345678, password: 'pwd', server: 'ICMarketsSC-Demo' }
  };

  const result = await metaApi.modifyPosition(
    'account_id_123',
    'ticket_123',      // Position ticket
    1.098,             // New SL
    1.108              // New TP
  );

  console.log(result.success ? '✅ Modified' : '❌ Failed');
  return result;
}

// ============================================
// OPERATION 5: Close Position
// ============================================
async function closePosition_MT5() {
  const executor = new ExecutionWrapper(metaApi, ccxtManager.exchanges);
  
  const follower = {
    id: 'trader_1',
    broker_type: 'mt5',
    credentials: { account: 12345678, password: 'pwd', server: 'ICMarketsSC-Demo' }
  };

  const result = await executor.closePosition(follower, 'EURUSD', 'ticket_123');
  console.log(`Closed at ${result.closingPrice}, PnL: ${result.pnl}`);
  return result;
}

async function closePosition_Crypto() {
  const executor = new ExecutionWrapper(metaApi, ccxtManager.exchanges);
  
  const follower = {
    id: 'crypto_1',
    broker_type: 'binance',
    credentials: { apiKey: 'key...', apiSecret: 'secret...' }
  };

  const result = await executor.closePosition(follower, 'BTC/USDT');
  console.log(result.success ? '✅ Closed' : '❌ Failed');
  return result;
}

// ============================================
// OPERATION 6: Get Execution History
// ============================================
function getExecutionHistory(executor) {
  // Last 10 executions
  const allExecutions = executor.getExecutionHistory();
  const lastTen = Object.values(allExecutions).slice(-10);

  lastTen.forEach(exec => {
    console.log(`
      ${exec.status === 'SUCCESS' ? '✅' : '❌'} ${exec.signal_id}
      Broker: ${exec.broker} | Follower: ${exec.follower_id}
      Latency: ${exec.latency}ms | ${exec.timestamp}
    `);
  });

  return lastTen;
}

// ============================================
// OPERATION 7: View Real-Time Metrics
// ============================================
function viewMetrics(monitor) {
  const metrics = monitor.getMetrics();

  console.log(`
📊 ════════════════════════════════════════
   EXECUTION METRICS (Last 1 hour)
════════════════════════════════════════
⏱️  Uptime:           ${metrics.uptime}
📈 Total:            ${metrics.total_executions}
✅ Successful:       ${metrics.successful_executions}
❌ Failed:           ${metrics.failed_executions}
📊 Success Rate:     ${metrics.success_rate}

⏱️  LATENCY
  P50:  ${metrics.latency?.p50_ms}ms
  P95:  ${metrics.latency?.p95_ms}ms ← Check this!
  P99:  ${metrics.latency?.p99_ms}ms

🔨 BROKERS
  ${Object.entries(metrics.broker_breakdown || {})
    .map(([broker, stats]) => 
      `${broker.padEnd(10)}: ${stats.successful}/${stats.total} (${stats.success_rate})`
    )
    .join('\n  ')}

⚠️  ALERTS: ${metrics.active_alerts}
════════════════════════════════════════
  `);
}

// ============================================
// OPERATION 8: Analyze Latency (for tuning)
// ============================================
function analyzeLatency(monitor) {
  const analysis = monitor.getLatencyAnalysis();

  console.log(`
📊 LATENCY ANALYSIS
──────────────────────────────────────
Sample Size: ${analysis.sample_size}

Distribution:
  Min:      ${analysis.min}ms
  P50:      ${analysis.median}ms
  P75:      ${analysis.p75}ms
  P95:      ${analysis.p95}ms ${analysis.p95_alert}
  P99:      ${analysis.p99}ms
  P99.9:    ${analysis.p999}ms
  Max:      ${analysis.max}ms

Statistics:
  Mean:     ${analysis.mean}ms
  StdDev:   ${analysis.stddev}ms
──────────────────────────────────────

👉 ACTION:
${analysis.p95 > 500 ? '⚠️  P95 latency EXCEEDS 500ms - Investigate network/broker' : '✅ Latency is good'}
  `);
}

// ============================================
// OPERATION 9: Debug Failures
// ============================================
function debugFailures(monitor) {
  const failures = monitor.getFailureAnalysis(5);

  console.log(`
❌ RECENT FAILURES (Last 5)
──────────────────────────────────────
Total in window: ${failures.total_failures_in_window}
Failure rate: ${failures.failure_rate}
  `);

  failures.recent_failures.forEach((f, i) => {
    console.log(`
${i + 1}. ${f.executionId}
   Signal:   ${f.signal_id}
   Follower: ${f.follower_id}
   Broker:   ${f.broker}
   Error:    ${f.error}
   Time:     ${f.timestamp}
    `);
  });
}

// ============================================
// OPERATION 10: Get Per-Broker Performance
// ============================================
function viewBrokerPerformance(monitor, broker = null) {
  const performance = monitor.getBrokerPerformance(broker);

  console.log(`
🔨 BROKER PERFORMANCE
──────────────────────────────────────
  `);

  Object.entries(performance).forEach(([brokerName, stats]) => {
    console.log(`
${brokerName.toUpperCase()}
  Executions:  ${stats.executions}
  Success:     ${stats.successful} (${stats.success_rate})
  Failed:      ${stats.failed}
  Avg Latency: ${stats.avg_latency_ms}ms
  P95 Latency: ${stats.p95_latency_ms}ms
  Last exec:   ${stats.last_execution}
    `);
  });
}

// ============================================
// OPERATION 11: Setup Complete System (5 min)
// ============================================
async function setupCompleteSystem() {
  // Initialize components
  const metaApi = new MetaApiClient(process.env.META_API_KEY);
  const ccxtManager = new CCXTExchangeManager();
  const executor = new ExecutionWrapper(metaApi, {});
  const monitor = new ExecutionMonitor();

  // Connect MT5
  try {
    await metaApi.connectAccount({
      account: process.env.MT5_ACCOUNT,
      password: process.env.MT5_PASSWORD,
      server: process.env.MT5_SERVER
    });
    console.log('✅ MT5 connected');
  } catch (err) {
    console.warn('⚠️  MT5 failed:', err.message);
  }

  // Connect crypto exchanges
  try {
    await ccxtManager.initExchange('binance', {
      apiKey: process.env.BINANCE_API_KEY,
      apiSecret: process.env.BINANCE_API_SECRET
    });
    console.log('✅ Binance connected');
  } catch (err) {
    console.warn('⚠️  Binance failed:', err.message);
  }

  try {
    await ccxtManager.initExchange('bitget', {
      apiKey: process.env.BITGET_API_KEY,
      apiSecret: process.env.BITGET_API_SECRET,
      passphrase: process.env.BITGET_PASSPHRASE
    });
    console.log('✅ Bitget connected');
  } catch (err) {
    console.warn('⚠️  Bitget failed:', err.message);
  }

  // Wire exchanges
  executor.ccxt = ccxtManager.exchanges;

  // Wire monitoring
  executor.on('execution:success', exec => monitor.recordExecution(exec));
  executor.on('execution:failed', exec => monitor.recordExecution(exec));

  console.log('✅ System ready');

  return { metaApi, ccxtManager, executor, monitor };
}

// ============================================
// OPERATION 12: Export Data for Analysis
// ============================================
function exportMetricsReport(monitor) {
  const report = monitor.exportMetrics();
  
  // Save to file
  const fs = require('fs');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `metrics_${timestamp}.json`;
  
  fs.writeFileSync(filename, JSON.stringify(report, null, 2));
  console.log(`✅ Report saved to ${filename}`);
  
  // Print summary
  console.log(`
📊 METRICS REPORT EXPORTED
──────────────────────────────────────
Uptime:              ${report.uptime_minutes.toFixed(2)} minutes
Total Executions:    ${report.total_executions}
Success Rate:        ${(report.summary.success_rate)}
P95 Latency:         ${report.latency_analysis.p95}ms
Avg Slippage:        ${report.slippage_analysis.avg_bps} bps
Total Failures:      ${report.total_failures}

File: ${filename}
──────────────────────────────────────
  `);

  return report;
}

// ============================================
// EXPORTS
// ============================================
module.exports = {
  executeTrade_MT5,
  executeTrade_Crypto,
  broadcastToAllFollowers,
  modifyPositionSL_TP,
  closePosition_MT5,
  closePosition_Crypto,
  getExecutionHistory,
  viewMetrics,
  analyzeLatency,
  debugFailures,
  viewBrokerPerformance,
  setupCompleteSystem,
  exportMetricsReport
};

// Example: Run if called directly
if (require.main === module) {
  (async () => {
    const { executor, monitor } = await setupCompleteSystem();
    viewMetrics(monitor);
    analyzeLatency(monitor);
  })();
}
