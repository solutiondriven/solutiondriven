#!/usr/bin/env node

/**
 * Micromax Copy-Trading Hub - Simplified Test Server
 * Minimal implementation without external dependencies (for testing)
 * 
 * Usage: node api/test-server.js
 * Then: curl http://localhost:3000/api/health
 */

const http = require('http');
const url = require('url');

// ============================================
// COPY TRADING ENGINE (In-Memory)
// ============================================

class SimpleCopyTradingEngine {
  constructor() {
    this.signals = {};
    this.followers = {};
    this.trades = {};
  }

  create_signal(strategy, symbol, action, volume, stop_loss, take_profit) {
    const signal_id = Math.random().toString(36).substring(7);
    this.signals[signal_id] = {
      id: signal_id,
      strategy,
      symbol,
      action,
      volume,
      stop_loss,
      take_profit,
      status: 'ACTIVE',
      created_at: new Date().toISOString(),
      followers_executed: [],
      followers_failed: []
    };
    return this.signals[signal_id];
  }

  broadcast_signal(signal_id) {
    const signal = this.signals[signal_id];
    if (!signal) return { success: false, error: 'Signal not found' };

    const result = {
      signal_id,
      timestamp: new Date().toISOString(),
      followers_count: Object.keys(this.followers).length,
      executions: []
    };

    for (const [follower_id, follower] of Object.entries(this.followers)) {
      result.executions.push({
        success: true,
        follower_id,
        symbol: signal.symbol,
        volume: signal.volume
      });
      signal.followers_executed.push(follower_id);
    }

    return result;
  }

  add_follower(follower_id, broker_type, volume_factor = 1.0) {
    this.followers[follower_id] = {
      id: follower_id,
      broker_type,
      volume_factor,
      active: true,
      created_at: new Date().toISOString()
    };
    return { success: true, follower_id, broker_type };
  }

  close_signal(signal_id) {
    const signal = this.signals[signal_id];
    if (!signal) return { success: false };
    signal.status = 'CLOSED';
    return { success: true, trades_closed: signal.followers_executed.length };
  }

  sync_sl_tp(signal_id, stop_loss, take_profit) {
    const signal = this.signals[signal_id];
    if (!signal) return { success: false };
    signal.stop_loss = stop_loss;
    signal.take_profit = take_profit;
    return { success: true, trades_updated: signal.followers_executed.length };
  }

  get_statistics() {
    return {
      total_signals: Object.keys(this.signals).length,
      active_signals: Object.values(this.signals).filter(s => s.status === 'ACTIVE').length,
      total_followers: Object.keys(this.followers).length,
      total_trades: Object.keys(this.trades).length
    };
  }
}

// Create engine
const engine = new SimpleCopyTradingEngine();

// ============================================
// HTTP SERVER
// ============================================

const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const method = req.method;

  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'application/json');

  if (method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Helper to send JSON
  const sendJSON = (status, data) => {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data, null, 2));
  };

  // Helper to get request body
  const getBody = (callback) => {
    let body = '';
    req.on('data', chunk => body += chunk.toString());
    req.on('end', () => {
      try {
        callback(body ? JSON.parse(body) : {});
      } catch {
        callback({});
      }
    });
  };

  // ============================================
  // ROUTES
  // ============================================

  if (pathname === '/api/health' && method === 'GET') {
    return sendJSON(200, {
      status: 'ok',
      timestamp: new Date().toISOString(),
      message: 'Copy-Trading Hub running!'
    });
  }

  if (pathname === '/api/signals/create' && method === 'POST') {
    return getBody(body => {
      const { strategy, symbol, action, volume, stop_loss, take_profit } = body;
      if (!strategy || !symbol || !action || !volume) {
        return sendJSON(400, { success: false, error: 'Missing required fields' });
      }
      const signal = engine.create_signal(strategy, symbol, action, volume, stop_loss, take_profit);
      sendJSON(200, { success: true, signal });
    });
  }

  if (pathname.match(/^\/api\/signals\/[a-z0-9]+$/) && method === 'GET') {
    const signal_id = pathname.split('/').pop();
    const signal = engine.signals[signal_id];
    if (!signal) return sendJSON(404, { success: false, error: 'Signal not found' });
    return sendJSON(200, { success: true, signal });
  }

  if (pathname.match(/^\/api\/signals\/[a-z0-9]+\/broadcast$/) && method === 'POST') {
    const signal_id = pathname.split('/')[3];
    const result = engine.broadcast_signal(signal_id);
    return sendJSON(result.error ? 400 : 200, result);
  }

  if (pathname.match(/^\/api\/signals\/[a-z0-9]+\/close$/) && method === 'POST') {
    const signal_id = pathname.split('/')[3];
    const result = engine.close_signal(signal_id);
    return sendJSON(200, result);
  }

  if (pathname.match(/^\/api\/signals\/[a-z0-9]+\/sync$/) && method === 'PUT') {
    const signal_id = pathname.split('/')[3];
    return getBody(body => {
      const { stop_loss, take_profit } = body;
      const result = engine.sync_sl_tp(signal_id, stop_loss, take_profit);
      return sendJSON(200, result);
    });
  }

  if (pathname === '/api/followers/add' && method === 'POST') {
    return getBody(body => {
      const { follower_id, broker_type, volume_factor = 1.0 } = body;
      if (!follower_id || !broker_type) {
        return sendJSON(400, { success: false, error: 'Missing required fields' });
      }
      const result = engine.add_follower(follower_id, broker_type, volume_factor);
      return sendJSON(200, result);
    });
  }

  if (pathname === '/api/followers' && method === 'GET') {
    const followers = Object.values(engine.followers);
    return sendJSON(200, { success: true, followers, count: followers.length });
  }

  if (pathname === '/api/copy-trading/status' && method === 'GET') {
    const stats = engine.get_statistics();
    return sendJSON(200, { success: true, ...stats });
  }

  // 404
  return sendJSON(404, { error: 'Endpoint not found', path: pathname, method });
});

server.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║     MICROMAX COPY-TRADING HUB - TEST SERVER               ║
║                                                            ║
║  🚀 Server running on http://localhost:${PORT}                 ║
║  📊 Health check: curl http://localhost:${PORT}/api/health   ║
║                                                            ║
║  QUICK START:                                              ║
║  1. Create Signal:                                         ║
║     curl -X POST http://localhost:${PORT}/api/signals/create \\
║       -H "Content-Type: application/json" \\
║       -d '{"strategy":"TestStrat","symbol":"EURUSD",\\
║            "action":"BUY","volume":1.0}'                  ║
║                                                            ║
║  2. Add Follower:                                          ║
║     curl -X POST http://localhost:${PORT}/api/followers/add \\
║       -H "Content-Type: application/json" \\
║       -d '{"follower_id":"user1","broker_type":"mt5"}'    ║
║                                                            ║
║  3. Broadcast Signal:                                      ║
║     curl -X POST http://localhost:${PORT}/api/signals/{id}/broadcast
║                                                            ║
║  4. Check Status:                                          ║
║     curl http://localhost:${PORT}/api/copy-trading/status  ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
  `);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n✓ Server shutdown gracefully');
  process.exit(0);
});
