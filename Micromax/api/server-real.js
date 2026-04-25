#!/usr/bin/env node

/**
 * Micromax real execution server.
 *
 * This server is intentionally strict:
 * - It only reports broker readiness after a bridge subprocess verifies it.
 * - It records broker responses and latency for every execution attempt.
 * - It blocks simulated Bitget execution instead of pretending trades were placed.
 */

const http = require('http');
const url = require('url');
const path = require('path');
const fs = require('fs');

const { PythonBridgeRunner } = require('./services/python_bridge_runner');
const { saveStrategy, loadUserStrategies, loadStrategy, deleteStrategy, updateStrategy } = require('./strategies');
const RevenueTracker = require('./revenue-tracker');

const PORT = process.env.PORT || 3000;
const runner = new PythonBridgeRunner();

let config = {};

function loadConfig() {
  const envPath = path.join(__dirname, '..', '.env.json');

  try {
    if (fs.existsSync(envPath)) {
      config = JSON.parse(fs.readFileSync(envPath, 'utf8'));
      console.log(`Loaded credentials from ${envPath}`);
      return;
    }
  } catch (error) {
    console.warn(`Could not parse ${envPath}: ${error.message}`);
  }

  config = {
    mt5: {
      account: process.env.MT5_ACCOUNT,
      password: process.env.MT5_PASSWORD,
      server: process.env.MT5_SERVER,
    },
    binance: {
      api_key: process.env.BINANCE_KEY,
      api_secret: process.env.BINANCE_SECRET,
    },
    bitget: {
      api_key: process.env.BITGET_KEY,
      api_secret: process.env.BITGET_SECRET,
      passphrase: process.env.BITGET_PASSPHRASE,
    },
  };
}

function nowIso() {
  return new Date().toISOString();
}

function safeJsonParse(body) {
  try {
    return body ? JSON.parse(body) : {};
  } catch {
    return {};
  }
}

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data, null, 2));
}

function readBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString();
    });
    req.on('end', () => resolve(safeJsonParse(body)));
  });
}

function hasCredentials(credentials = {}) {
  return Object.values(credentials).some(Boolean);
}

class BridgeManager {
  constructor(bridgeConfig, bridgeRunner) {
    this.config = bridgeConfig;
    this.runner = bridgeRunner;
    this.initialized = false;
    this.brokers = {
      mt5: this.createInitialStatus('mt5'),
      binance: this.createInitialStatus('binance'),
      bitget: this.createInitialStatus('bitget'),
    };
  }

  createInitialStatus(brokerType) {
    const credentials = this.config[brokerType] || {};

    return {
      broker_type: brokerType,
      configured: hasCredentials(credentials),
      ready: false,
      live_execution: false,
      live_position_management: false,
      execution_mode: 'unconfigured',
      status: 'UNCONFIGURED',
      last_checked_at: null,
      error: hasCredentials(credentials) ? null : 'Credentials not configured',
    };
  }

  async probeBroker(brokerType) {
    const credentials = this.config[brokerType] || {};

    if (!hasCredentials(credentials)) {
      this.brokers[brokerType] = this.createInitialStatus(brokerType);
      return this.brokers[brokerType];
    }

    const result = await this.runner.invoke({
      broker_type: brokerType,
      operation: 'health',
      credentials,
    });

    const nextStatus = {
      broker_type: brokerType,
      configured: true,
      ready: Boolean(result.success && result.live_execution),
      live_execution: Boolean(result.live_execution),
      live_position_management: Boolean(result.live_position_management),
      execution_mode: result.execution_mode || 'unknown',
      status: result.status || (result.success ? 'READY' : 'ERROR'),
      last_checked_at: nowIso(),
      error: result.success ? null : result.error || 'Broker probe failed',
    };

    if (result.account_info) {
      nextStatus.account_info = result.account_info;
    }

    if (result.balance_info) {
      nextStatus.balance_info = result.balance_info;
    }

    if (result.stderr) {
      nextStatus.stderr = result.stderr;
    }

    this.brokers[brokerType] = nextStatus;
    return nextStatus;
  }

  async initialize() {
    await Promise.all([
      this.probeBroker('mt5'),
      this.probeBroker('binance'),
      this.probeBroker('bitget'),
    ]);

    this.initialized = true;
    return this.brokers;
  }

  getBrokerStatus(brokerType) {
    return this.brokers[brokerType] || null;
  }

  getAllStatuses() {
    return this.brokers;
  }

  mergeCredentials(brokerType, overrideCredentials = {}) {
    return {
      ...(this.config[brokerType] || {}),
      ...(overrideCredentials || {}),
    };
  }

  resolveSymbol(signalSymbol, symbolMap = {}) {
    return symbolMap?.[signalSymbol] || signalSymbol;
  }

  async executeSignal(signal, follower) {
    const brokerType = follower.broker_type;
    const startedAt = Date.now();
    const credentials = this.mergeCredentials(brokerType, follower.credentials);
    const executableSymbol = this.resolveSymbol(signal.symbol, follower.symbol_map);

    const result = await this.runner.invoke({
      broker_type: brokerType,
      operation: 'execute_order',
      credentials,
      params: {
        symbol: executableSymbol,
        action: signal.action,
        volume: signal.volume * follower.volume_factor,
        stop_loss: signal.stop_loss,
        take_profit: signal.take_profit,
        order_type: 'MARKET',
      },
    });

    const latencyMs = Date.now() - startedAt;
    const status = result.status || (result.success ? 'FILLED' : 'REJECTED');

    return {
      success: Boolean(result.success),
      status,
      broker_type: brokerType,
      symbol: executableSymbol,
      order_id: result.order_id || null,
      filled_price: result.filled_price || result.price || null,
      price: result.price || result.filled_price || null,
      latency_ms: latencyMs,
      execution_mode: result.execution_mode || 'unknown',
      live_execution: Boolean(result.live_execution),
      error: result.success ? null : result.error || 'Execution failed',
      broker_response: result,
      requested_at: new Date(startedAt).toISOString(),
      completed_at: nowIso(),
    };
  }

  async closePosition(trade, follower) {
    const brokerType = trade.broker_type;
    const credentials = this.mergeCredentials(brokerType, follower?.credentials);
    const result = await this.runner.invoke({
      broker_type: brokerType,
      operation: 'close_position',
      credentials,
      params: {
        symbol: trade.symbol,
      },
    });

    return {
      success: Boolean(result.success),
      status: result.status || (result.success ? 'CLOSED' : 'REJECTED'),
      broker_type: brokerType,
      error: result.success ? null : result.error || 'Close failed',
      broker_response: result,
    };
  }

  async modifyPosition(trade, follower, stopLoss, takeProfit) {
    const brokerType = trade.broker_type;
    const credentials = this.mergeCredentials(brokerType, follower?.credentials);
    const result = await this.runner.invoke({
      broker_type: brokerType,
      operation: 'modify_position',
      credentials,
      params: {
        symbol: trade.symbol,
        stop_loss: stopLoss,
        take_profit: takeProfit,
      },
    });

    return {
      success: Boolean(result.success),
      status: result.status || (result.success ? 'UPDATED' : 'REJECTED'),
      broker_type: brokerType,
      error: result.success ? null : result.error || 'Modify failed',
      broker_response: result,
    };
  }
}

class ExecutionEngine {
  constructor(bridges) {
    this.bridges = bridges;
    this.signals = {};
    this.followers = {};
    this.trades = {};
  }

  createSignal(strategy, symbol, action, volume, stopLoss, takeProfit) {
    const signal = {
      id: Math.random().toString(36).slice(2, 10),
      strategy,
      symbol: String(symbol).toUpperCase(),
      action: String(action).toUpperCase(),
      volume: Number(volume),
      stop_loss: stopLoss ?? null,
      take_profit: takeProfit ?? null,
      status: 'ACTIVE',
      created_at: nowIso(),
      executed_at: null,
      executions: [],
    };

    this.signals[signal.id] = signal;
    return signal;
  }

  registerFollower(followerId, brokerType, credentials = {}, volumeFactor = 1.0, symbolMap = {}) {
    const bridgeStatus = this.bridges.getBrokerStatus(brokerType);

    this.followers[followerId] = {
      id: followerId,
      broker_type: brokerType,
      credentials,
      volume_factor: Number(volumeFactor),
      symbol_map: symbolMap || {},
      active: true,
      registered_at: nowIso(),
      total_trades: 0,
      last_error: null,
      bridge_ready: Boolean(bridgeStatus?.ready),
      bridge_mode: bridgeStatus?.execution_mode || 'unknown',
    };

    return {
      success: true,
      follower_id: followerId,
      broker_type: brokerType,
      bridge: bridgeStatus,
    };
  }

  listFollowers() {
    return Object.values(this.followers);
  }

  getSignal(signalId) {
    return this.signals[signalId] || null;
  }

  getStatistics() {
    return {
      total_signals: Object.keys(this.signals).length,
      active_signals: Object.values(this.signals).filter((signal) => signal.status === 'ACTIVE').length,
      total_followers: Object.keys(this.followers).length,
      active_followers: Object.values(this.followers).filter((follower) => follower.active).length,
      total_trades: Object.keys(this.trades).length,
      open_trades: Object.values(this.trades).filter((trade) => trade.status === 'OPEN').length,
    };
  }

  async broadcastSignal(signalId) {
    const signal = this.signals[signalId];
    if (!signal) {
      return { success: false, error: 'Signal not found' };
    }

    signal.executed_at = nowIso();

    const results = {
      success: true,
      signal_id: signalId,
      symbol: signal.symbol,
      action: signal.action,
      timestamp: signal.executed_at,
      executions: [],
      successful: 0,
      failed: 0,
    };

    for (const follower of Object.values(this.followers)) {
      if (!follower.active) continue;

      const execution = await this.bridges.executeSignal(signal, follower);

      const executionRecord = {
        follower_id: follower.id,
        broker_type: follower.broker_type,
        volume_factor: follower.volume_factor,
        ...execution,
      };

      results.executions.push(executionRecord);

      if (execution.success) {
        results.successful += 1;
        follower.total_trades += 1;

        const tradeId = Math.random().toString(36).slice(2, 10);
        this.trades[tradeId] = {
          id: tradeId,
          signal_id: signalId,
          follower_id: follower.id,
          broker_type: follower.broker_type,
          symbol: execution.symbol,
          action: signal.action,
          volume: signal.volume * follower.volume_factor,
          entry_price: execution.filled_price,
          order_id: execution.order_id,
          status: 'OPEN',
          execution_status: execution.status,
          execution_mode: execution.execution_mode,
          latency_ms: execution.latency_ms,
          created_at: nowIso(),
        };
      } else {
        results.failed += 1;
        follower.last_error = execution.error;
      }
    }

    signal.executions = results.executions;
    return results;
  }

  async closeSignal(signalId) {
    const signal = this.signals[signalId];
    if (!signal) {
      return { success: false, error: 'Signal not found' };
    }

    signal.status = 'CLOSED';
    const closed = [];
    const failed = [];

    for (const trade of Object.values(this.trades)) {
      if (trade.signal_id !== signalId || trade.status !== 'OPEN') continue;

      const follower = this.followers[trade.follower_id];
      const result = await this.bridges.closePosition(trade, follower);

      if (result.success) {
        trade.status = 'CLOSED';
        trade.closed_at = nowIso();
        closed.push({ trade_id: trade.id, broker_type: trade.broker_type });
      } else {
        failed.push({
          trade_id: trade.id,
          broker_type: trade.broker_type,
          error: result.error,
        });
      }
    }

    return {
      success: failed.length === 0,
      signal_id: signalId,
      trades_closed: closed.length,
      closed,
      failed,
    };
  }

  async syncStopLossTakeProfit(signalId, stopLoss, takeProfit) {
    const signal = this.signals[signalId];
    if (!signal) {
      return { success: false, error: 'Signal not found' };
    }

    signal.stop_loss = stopLoss ?? signal.stop_loss;
    signal.take_profit = takeProfit ?? signal.take_profit;

    const updated = [];
    const failed = [];

    for (const trade of Object.values(this.trades)) {
      if (trade.signal_id !== signalId || trade.status !== 'OPEN') continue;

      const follower = this.followers[trade.follower_id];
      const result = await this.bridges.modifyPosition(trade, follower, stopLoss, takeProfit);

      if (result.success) {
        updated.push({ trade_id: trade.id, broker_type: trade.broker_type });
      } else {
        failed.push({
          trade_id: trade.id,
          broker_type: trade.broker_type,
          error: result.error,
        });
      }
    }

    return {
      success: failed.length === 0,
      signal_id: signalId,
      stop_loss: signal.stop_loss,
      take_profit: signal.take_profit,
      trades_updated: updated.length,
      updated,
      failed,
    };
  }
}

loadConfig();

const bridges = new BridgeManager(config, runner);
const engine = new ExecutionEngine(bridges);
const revenueTracker = new RevenueTracker();

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const method = req.method;

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (pathname === '/api/health' && method === 'GET') {
    sendJson(res, 200, {
      status: 'ok',
      timestamp: nowIso(),
      service: 'Micromax Real Execution Server',
      bridges_initialized: bridges.initialized,
      brokers: bridges.getAllStatuses(),
    });
    return;
  }

  if (pathname === '/api/bridges/status' && method === 'GET') {
    sendJson(res, 200, {
      success: true,
      timestamp: nowIso(),
      brokers: bridges.getAllStatuses(),
    });
    return;
  }

  if (pathname === '/api/signals/create' && method === 'POST') {
    const body = await readBody(req);
    const { strategy, symbol, action, volume, stop_loss, take_profit } = body;

    if (!strategy || !symbol || !action || !volume) {
      sendJson(res, 400, {
        success: false,
        error: 'Missing required fields: strategy, symbol, action, volume',
      });
      return;
    }

    if (!['BUY', 'SELL'].includes(String(action).toUpperCase())) {
      sendJson(res, 400, { success: false, error: 'Action must be BUY or SELL' });
      return;
    }

    const signal = engine.createSignal(strategy, symbol, action, volume, stop_loss, take_profit);
    sendJson(res, 200, { success: true, signal });
    return;
  }

  if (pathname.match(/^\/api\/signals\/[a-z0-9]+$/) && method === 'GET') {
    const signalId = pathname.split('/').pop();
    const signal = engine.getSignal(signalId);

    if (!signal) {
      sendJson(res, 404, { success: false, error: 'Signal not found' });
      return;
    }

    sendJson(res, 200, { success: true, signal });
    return;
  }

  if (pathname.match(/^\/api\/signals\/[a-z0-9]+\/broadcast$/) && method === 'POST') {
    const signalId = pathname.split('/')[3];
    const result = await engine.broadcastSignal(signalId);
    sendJson(res, result.success ? 200 : 400, result);
    return;
  }

  if (pathname.match(/^\/api\/signals\/[a-z0-9]+\/close$/) && method === 'POST') {
    const signalId = pathname.split('/')[3];
    const result = await engine.closeSignal(signalId);
    sendJson(res, result.success ? 200 : 400, result);
    return;
  }

  if (pathname.match(/^\/api\/signals\/[a-z0-9]+\/sync$/) && method === 'PUT') {
    const signalId = pathname.split('/')[3];
    const body = await readBody(req);
    const result = await engine.syncStopLossTakeProfit(
      signalId,
      body.stop_loss,
      body.take_profit
    );
    sendJson(res, result.success ? 200 : 400, result);
    return;
  }

  if (pathname === '/api/followers/add' && method === 'POST') {
    const body = await readBody(req);
    const {
      follower_id,
      broker_type,
      credentials = {},
      volume_factor = 1.0,
      symbol_map = {},
    } = body;

    if (!follower_id || !broker_type) {
      sendJson(res, 400, {
        success: false,
        error: 'Missing required fields: follower_id, broker_type',
      });
      return;
    }

    if (!['mt5', 'binance', 'bitget'].includes(broker_type)) {
      sendJson(res, 400, { success: false, error: 'Unsupported broker_type' });
      return;
    }

    const result = engine.registerFollower(
      follower_id,
      broker_type,
      credentials,
      volume_factor,
      symbol_map
    );

    sendJson(res, 200, result);
    return;
  }

  if (pathname === '/api/followers' && method === 'GET') {
    const followers = engine.listFollowers();
    sendJson(res, 200, {
      success: true,
      followers,
      count: followers.length,
    });
    return;
  }

  if (pathname === '/api/copy-trading/status' && method === 'GET') {
    sendJson(res, 200, {
      success: true,
      timestamp: nowIso(),
      ...engine.getStatistics(),
      brokers: bridges.getAllStatuses(),
    });
    return;
  }

  // ========== STRATEGY MANAGEMENT ENDPOINTS ==========

  if (pathname === '/api/strategies/save' && method === 'POST') {
    const body = await readBody(req);
    const { userId, name, description, code, entryRules, exitRules, riskRules } = body;

    if (!userId || !name || !code) {
      sendJson(res, 400, {
        success: false,
        error: 'Missing required fields: userId, name, code',
      });
      return;
    }

    try {
      const strategy = saveStrategy(
        { name, description, code, entryRules, exitRules, riskRules },
        userId
      );
      sendJson(res, 200, {
        success: true,
        strategy,
        message: 'Strategy saved successfully',
      });
    } catch (error) {
      sendJson(res, 500, {
        success: false,
        error: error.message,
      });
    }
    return;
  }

  if (pathname === '/api/strategies/list' && method === 'GET') {
    const queryParams = new url.URL(req.url, `http://${req.headers.host}`).searchParams;
    const userId = queryParams.get('userId');

    if (!userId) {
      sendJson(res, 400, {
        success: false,
        error: 'Missing query parameter: userId',
      });
      return;
    }

    try {
      const strategies = loadUserStrategies(userId);
      sendJson(res, 200, {
        success: true,
        strategies,
        count: strategies.length,
      });
    } catch (error) {
      sendJson(res, 500, {
        success: false,
        error: error.message,
      });
    }
    return;
  }

  if (pathname.match(/^\/api\/strategies\/[a-z0-9_-]+$/) && method === 'GET') {
    const strategyId = pathname.split('/').pop();
    const queryParams = new url.URL(req.url, `http://${req.headers.host}`).searchParams;
    const userId = queryParams.get('userId');

    if (!userId) {
      sendJson(res, 400, {
        success: false,
        error: 'Missing query parameter: userId',
      });
      return;
    }

    try {
      const strategy = loadStrategy(strategyId, userId);
      sendJson(res, 200, {
        success: true,
        strategy,
      });
    } catch (error) {
      sendJson(res, 404, {
        success: false,
        error: 'Strategy not found',
      });
    }
    return;
  }

  if (pathname.match(/^\/api\/strategies\/[a-z0-9_-]+$/) && method === 'DELETE') {
    const strategyId = pathname.split('/').pop();
    const queryParams = new url.URL(req.url, `http://${req.headers.host}`).searchParams;
    const userId = queryParams.get('userId');

    if (!userId) {
      sendJson(res, 400, {
        success: false,
        error: 'Missing query parameter: userId',
      });
      return;
    }

    try {
      deleteStrategy(strategyId, userId);
      sendJson(res, 200, {
        success: true,
        message: 'Strategy deleted successfully',
      });
    } catch (error) {
      sendJson(res, 404, {
        success: false,
        error: 'Strategy not found',
      });
    }
    return;
  }

  if (pathname.match(/^\/api\/strategies\/[a-z0-9_-]+$/) && method === 'PUT') {
    const strategyId = pathname.split('/').pop();
    const queryParams = new url.URL(req.url, `http://${req.headers.host}`).searchParams;
    const userId = queryParams.get('userId');
    const body = await readBody(req);

    if (!userId) {
      sendJson(res, 400, {
        success: false,
        error: 'Missing query parameter: userId',
      });
      return;
    }

    try {
      const updated = updateStrategy(strategyId, userId, body);
      sendJson(res, 200, {
        success: true,
        strategy: updated,
        message: 'Strategy updated successfully',
      });
    } catch (error) {
      sendJson(res, 404, {
        success: false,
        error: 'Strategy not found',
      });
    }
    return;
  }

  // ========== REVENUE TRACKING ENDPOINTS ==========

  if (pathname === '/api/revenue/stats' && method === 'GET') {
    const stats = revenueTracker.getPlatformStats();
    sendJson(res, 200, { success: true, ...stats });
    return;
  }

  if (pathname === '/api/revenue/user' && method === 'GET') {
    const queryParams = new url.URL(req.url, `http://${req.headers.host}`).searchParams;
    const userId = queryParams.get('userId');

    if (!userId) {
      sendJson(res, 400, { success: false, error: 'Missing userId parameter' });
      return;
    }

    const userStats = revenueTracker.getUserStats(userId);
    sendJson(res, 200, { success: true, ...userStats });
    return;
  }

  if (pathname === '/api/revenue/by-broker' && method === 'GET') {
    const byBroker = revenueTracker.getRevenueByBroker();
    sendJson(res, 200, { success: true, ...byBroker });
    return;
  }

  if (pathname === '/api/revenue/top-users' && method === 'GET') {
    const queryParams = new url.URL(req.url, `http://${req.headers.host}`).searchParams;
    const limit = Math.min(parseInt(queryParams.get('limit')) || 10, 100);

    const topUsers = revenueTracker.getTopUsers(limit);
    sendJson(res, 200, { success: true, ...topUsers });
    return;
  }

  if (pathname === '/api/revenue/export' && method === 'GET') {
    const queryParams = new url.URL(req.url, `http://${req.headers.host}`).searchParams;
    const format = queryParams.get('format') || 'json';

    const report = revenueTracker.exportReport(format);
    
    if (format === 'csv') {
      res.writeHead(200, { 'Content-Type': 'text/csv' });
      res.end(report);
    } else {
      sendJson(res, 200, JSON.parse(report));
    }
    return;
  }

  // ========== TRADE RECORDING (call this after each trade completes) ==========
  // Example: After a signal is executed
  // revenueTracker.recordTrade(userId, signalId, brokerType, tradeDetails, profitLoss);

  sendJson(res, 404, {
    success: false,
    error: 'Endpoint not found',
    path: pathname,
    method,
  });
});

(async () => {
  await bridges.initialize();

  server.listen(PORT, () => {
    console.log(`Micromax real execution server listening on http://localhost:${PORT}`);
    console.log('Broker status:');
    Object.values(bridges.getAllStatuses()).forEach((broker) => {
      console.log(
        ` - ${broker.broker_type}: ${broker.status} | mode=${broker.execution_mode} | ready=${broker.ready}`
      );
      if (broker.error) {
        console.log(`   error: ${broker.error}`);
      }
    });
  });
})();

process.on('SIGINT', () => {
  console.log('\nShutting down real execution server');
  process.exit(0);
});

module.exports = { engine, bridges, server };
