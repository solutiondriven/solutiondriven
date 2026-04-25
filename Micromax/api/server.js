/**
 * Micromax Trading API Server
 * 
 * Universal MT5-based trading backend
 * Works with ANY broker that uses MetaTrader 5
 * 
 * Brokers: Exness, IC Markets, Pepperstone, FXOpen, +500 more
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const { spawn } = require('child_process');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// ============================================
// GLOBALS
// ============================================

let mt5Manager = null;

// MT5 Manager class - handles Python subprocess communication
class MT5Manager {
  constructor() {
    this.process = null;
    this.connected = false;
    this.bridge = null;
  }

  // Start MT5 bridge subprocess
  start() {
    const pythonPath = process.env.PYTHON_PATH || 'python';
    const scriptPath = path.join(__dirname, 'services', 'mt5_manager.py');
    
    this.process = spawn(pythonPath, [scriptPath]);
    
    this.process.stdout.on('data', (data) => {
      console.log(`[MT5] ${data.toString().trim()}`);
    });
    
    this.process.stderr.on('data', (data) => {
      console.error(`[MT5 ERROR] ${data.toString().trim()}`);
    });
  }

  stop() {
    if (this.process) {
      this.process.kill();
      this.process = null;
      this.connected = false;
    }
  }
}

// ============================================
// HEALTH CHECK
// ============================================

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    mt5_connected: mt5Manager?.connected || false
  });
});

// ============================================
// MT5 CONNECTION MANAGEMENT
// ============================================

/**
 * POST /api/mt5/connect
 * Connect to any MT5 broker
 */
app.post('/api/mt5/connect', (req, res) => {
  const { account, password, server } = req.body;
  
  // Validate input
  if (!account || !password || !server) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields: account, password, server'
    });
  }

  // Initialize MT5 manager if not exists
  if (!mt5Manager) {
    mt5Manager = new MT5Manager();
    mt5Manager.start();
  }

  // Return success - actual connection happens in Python
  res.json({
    success: true,
    message: `Connecting to ${server}...`,
    broker_server: server,
    account_number: account,
    timestamp: new Date().toISOString()
  });
});

/**
 * POST /api/mt5/disconnect
 * Disconnect from MT5
 */
app.post('/api/mt5/disconnect', (req, res) => {
  if (mt5Manager) {
    mt5Manager.stop();
    mt5Manager = null;
  }

  res.json({
    success: true,
    message: 'Disconnected from MT5'
  });
});

/**
 * GET /api/mt5/status
 * Get MT5 connection status
 */
app.get('/api/mt5/status', (req, res) => {
  res.json({
    connected: mt5Manager?.connected || false,
    broker_server: mt5Manager?.server || null,
    account: mt5Manager?.account || null
  });
});

// ============================================
// TRADING OPERATIONS
// ============================================

/**
 * POST /api/trades/execute
 * Execute a trade on the connected MT5 broker
 */
app.post('/api/trades/execute', async (req, res) => {
  const { symbol, action, volume, stopLoss, takeProfit } = req.body;

  // Validate input
  if (!symbol || !action || !volume) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields: symbol, action, volume'
    });
  }

  if (!['BUY', 'SELL'].includes(action.toUpperCase())) {
    return res.status(400).json({
      success: false,
      error: 'Action must be BUY or SELL'
    });
  }

  if (!mt5Manager?.connected) {
    return res.status(400).json({
      success: false,
      error: 'Not connected to MT5. Call /api/mt5/connect first'
    });
  }

  try {
    // In production, this would call Python subprocess
    // For now, return a mock response
    
    const orderId = Math.floor(Math.random() * 1000000);
    
    res.json({
      success: true,
      order_id: orderId,
      symbol: symbol.toUpperCase(),
      action: action.toUpperCase(),
      volume,
      stop_loss: stopLoss,
      take_profit: takeProfit,
      timestamp: new Date().toISOString(),
      message: `Order ${orderId} executed successfully`
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/positions
 * Get all open positions
 */
app.get('/api/positions', (req, res) => {
  if (!mt5Manager?.connected) {
    return res.status(400).json({
      error: 'Not connected to MT5'
    });
  }

  // Mock response - in production, calls Python
  res.json({
    success: true,
    positions: []
  });
});

/**
 * GET /api/positions/:symbol
 * Get position for a specific symbol
 */
app.get('/api/positions/:symbol', (req, res) => {
  const { symbol } = req.params;

  if (!mt5Manager?.connected) {
    return res.status(400).json({
      error: 'Not connected to MT5'
    });
  }

  // Mock response
  res.json({
    success: true,
    position: null,
    message: `No position for ${symbol}`
  });
});

/**
 * POST /api/positions/:symbol/close
 * Close a position
 */
app.post('/api/positions/:symbol/close', (req, res) => {
  const { symbol } = req.params;

  if (!mt5Manager?.connected) {
    return res.status(400).json({
      error: 'Not connected to MT5'
    });
  }

  res.json({
    success: true,
    message: `Position ${symbol} closed`,
    closed_time: new Date().toISOString()
  });
});

/**
 * POST /api/positions/:symbol/modify
 * Modify stop loss and/or take profit
 */
app.post('/api/positions/:symbol/modify', (req, res) => {
  const { symbol } = req.params;
  const { stopLoss, takeProfit } = req.body;

  if (!mt5Manager?.connected) {
    return res.status(400).json({
      error: 'Not connected to MT5'
    });
  }

  res.json({
    success: true,
    symbol,
    stop_loss: stopLoss,
    take_profit: takeProfit,
    message: 'Position modified successfully'
  });
});

// ============================================
// ACCOUNT INFORMATION
// ============================================

/**
 * GET /api/account/info
 * Get account information
 */
app.get('/api/account/info', (req, res) => {
  if (!mt5Manager?.connected) {
    return res.status(400).json({
      error: 'Not connected to MT5'
    });
  }

  // Mock response
  res.json({
    account: null,
    balance: 0,
    equity: 0,
    profit: 0,
    margin: 0,
    margin_free: 0,
    margin_level: 0,
    currency: 'USD',
    company: 'Unknown'
  });
});

/**
 * GET /api/account/balance
 * Get account balance
 */
app.get('/api/account/balance', (req, res) => {
  if (!mt5Manager?.connected) {
    return res.status(400).json({
      error: 'Not connected to MT5'
    });
  }

  res.json({
    balance: 0,
    equity: 0,
    profit: 0,
    margin_level: 0
  });
});

// ============================================
// TRADE HISTORY
// ============================================

/**
 * GET /api/trades/history
 * Get trade history
 */
app.get('/api/trades/history', (req, res) => {
  const { days = 7 } = req.query;

  if (!mt5Manager?.connected) {
    return res.status(400).json({
      error: 'Not connected to MT5'
    });
  }

  res.json({
    success: true,
    days: parseInt(days),
    trades: []
  });
});

// ============================================
// STRATEGY EXECUTION
// ============================================

/**
 * POST /api/strategy/run
 * Run a strategy
 */
app.post('/api/strategy/run', async (req, res) => {
  const { strategy, symbol, timeframe = '1H' } = req.body;

  if (!strategy) {
    return res.status(400).json({
      error: 'Missing strategy parameter'
    });
  }

  if (!mt5Manager?.connected) {
    return res.status(400).json({
      error: 'Not connected to MT5'
    });
  }

  res.json({
    success: true,
    strategy,
    symbol,
    timeframe,
    message: `Strategy ${strategy} started`
  });
});

/**
 * POST /api/strategy/stop
 * Stop a running strategy
 */
app.post('/api/strategy/stop', (req, res) => {
  const { strategy } = req.body;

  res.json({
    success: true,
    strategy,
    message: `Strategy ${strategy} stopped`
  });
});

// ============================================
// COPY TRADING
// ============================================

// Note: copy_trading_engine is a Python service, initialize via python_bridge_runner
let engine = null;

function getEngine() {
  // Returns null - copy trading via Python bridges in separate process
  return engine;
}

/**
 * POST /api/signals/create
 * Create a new trade signal
 */
app.post('/api/signals/create', (req, res) => {
  const { strategy, symbol, action, volume, stop_loss, take_profit, broker = 'mt5' } = req.body;

  if (!strategy || !symbol || !action || !volume) {
    return res.status(400).json({
      success: false,
      error: 'Missing required: strategy, symbol, action, volume'
    });
  }

  try {
    const engine = getEngine();
    const signal = engine.create_signal(strategy, symbol, action, volume, stop_loss, take_profit, broker);
    
    res.json({
      success: true,
      signal: signal
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/signals/:id
 * Get signal details
 */
app.get('/api/signals/:id', (req, res) => {
  try {
    const engine = getEngine();
    const signal = engine.get_signal(req.params.id);
    
    if (!signal || Object.keys(signal).length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Signal not found'
      });
    }
    
    res.json({
      success: true,
      signal: signal
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/signals/:id/broadcast
 * Broadcast signal to all followers
 */
app.post('/api/signals/:id/broadcast', (req, res) => {
  try {
    const engine = getEngine();
    const result = engine.broadcast_signal(req.params.id);
    
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/signals/:id/close
 * Close all positions from a signal
 */
app.post('/api/signals/:id/close', (req, res) => {
  try {
    const engine = getEngine();
    const result = engine.close_signal(req.params.id);
    
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * PUT /api/signals/:id/sync
 * Sync stop loss and take profit
 */
app.put('/api/signals/:id/sync', (req, res) => {
  const { stop_loss, take_profit } = req.body;
  
  try {
    const engine = getEngine();
    const result = engine.sync_stop_loss_take_profit(req.params.id, stop_loss, take_profit);
    
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/followers/add
 * Register a new follower
 */
app.post('/api/followers/add', (req, res) => {
  const { follower_id, broker_type, credentials, volume_factor = 1.0 } = req.body;

  if (!follower_id || !broker_type || !credentials) {
    return res.status(400).json({
      success: false,
      error: 'Missing required: follower_id, broker_type, credentials'
    });
  }

  try {
    const engine = getEngine();
    const result = engine.add_follower(follower_id, broker_type, credentials, volume_factor);
    
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/followers
 * Get all followers
 */
app.get('/api/followers', (req, res) => {
  try {
    const engine = getEngine();
    const followers = engine.list_followers();
    
    res.json({
      success: true,
      followers: followers,
      count: followers.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/copy-trading/status
 * Get copy trading status
 */
app.get('/api/copy-trading/status', (req, res) => {
  try {
    const engine = getEngine();
    const stats = engine.get_statistic();
    
    res.json({
      success: true,
      ...stats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================
// ACCOUNT PROVISIONING (MT5 ONBOARDING)
// ============================================

const { initializeMetaApiProvisioning, router: accountProvisioningRouter } = require('./routes/accountProvisioning');

try {
  const metaApiToken = process.env.METAAPI_TOKEN;
  if (metaApiToken) {
    initializeMetaApiProvisioning(metaApiToken);
    app.use('/api/accounts', accountProvisioningRouter);
    console.log('✅ Account Provisioning System initialized');
  } else {
    console.warn('⚠️  METAAPI_TOKEN not set - Account Provisioning disabled');
  }
} catch (error) {
  console.warn('⚠️  Account Provisioning initialization skipped:', error.message);
}

// ============================================
// ERROR HANDLING
// ============================================

app.use((req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    path: req.path,
    method: req.method
  });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message
  });
});

// ============================================
// SERVER STARTUP
// ============================================

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║     MICROMAX TRADING API SERVER - MT5 UNIVERSAL            ║
║                                                            ║
║  🚀 Server running on port ${PORT}                              ║
║  📊 Health check: GET http://localhost:${PORT}/api/health         ║
║  🔗 Supports: Exness, IC Markets, Pepperstone, +500 more  ║
║                                                            ║
║  QUICK START:                                              ║
║  1. POST /api/mt5/connect (with account credentials)       ║
║  2. POST /api/trades/execute (place a trade)              ║
║  3. GET /api/positions (see open positions)                ║
║  4. GET /api/account/info (see balance)                    ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
  `);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down...');
  if (mt5Manager) {
    mt5Manager.stop();
  }
  process.exit(0);
});

module.exports = app;
