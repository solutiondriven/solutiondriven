# 🔧 IMPLEMENTATION ROADMAP: Build the Core Trading Loop (Week 1)

**Goal:** Get ONE complete trade from frontend → backend → broker → execution → alert

**Timeline:** This week (7 days)

---

## Day 1-2: Foundation (Express API Server)

### What We're Building

```
Frontend (React)
    ↓
Express API Server (Node)
    ↓
BrokerAdapter (Uniform Interface)
    ↓
Brokers (Binance, MT5, etc)
```

### Files to Create

#### 1. `api/server.js` (Entry point)

```javascript
const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// Import adapters
const BinanceAdapter = require('../brokers/BinanceAdapter');
const riskManager = require('../core/riskManager');

// Initialize brokers
const brokerAdapters = {
  binance: new BinanceAdapter({
    apiKey: process.env.BINANCE_API_KEY,
    apiSecret: process.env.BINANCE_API_SECRET
  })
};

// --- REST API ENDPOINTS ---

// GET /api/health
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// POST /api/trades/execute
app.post('/api/trades/execute', async (req, res) => {
  try {
    const { broker, symbol, action, volume, stopLoss, takeProfit } = req.body;
    
    // Validate input
    if (!broker || !symbol || !action || !volume) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Get adapter for broker
    const adapter = brokerAdapters[broker];
    if (!adapter) {
      return res.status(400).json({ error: `Broker ${broker} not supported` });
    }
    
    // Execute order
    const result = await adapter.executeOrder({
      symbol,
      side: action, // BUY or SELL
      type: 'MARKET',
      quantity: volume,
      stopLoss,
      takeProfit
    });
    
    res.json({
      success: true,
      orderId: result.orderId,
      executedPrice: result.price,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/trades/position/:symbol
app.get('/api/trades/position/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const { broker } = req.query;
    
    const adapter = brokerAdapters[broker];
    const position = await adapter.getPosition(symbol);
    
    res.json(position || { error: 'No position for ' + symbol });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/account/balance
app.get('/api/account/balance', async (req, res) => {
  try {
    const { broker } = req.query;
    
    const adapter = brokerAdapters[broker];
    const balance = await adapter.getBalance();
    
    res.json(balance);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/strategy/execute
app.post('/api/strategy/execute', async (req, res) => {
  try {
    const { symbol, price, broker } = req.body;
    
    // Run strategy
    const TemiStrategy = require('../strategies/TemiStrategy');
    const tradeSignal = TemiStrategy.onTick({ symbol, price }, null);
    
    if (!tradeSignal) {
      return res.json({ signal: null, reason: 'No signal for symbol' });
    }
    
    // Check risk
    const riskCheck = riskManager.evaluateTrade(tradeSignal, price);
    
    if (!riskCheck.allowed) {
      return res.json({ signal: null, reason: riskCheck.reason });
    }
    
    // If broker provided, execute immediately
    if (broker) {
      const executionResult = await brokerAdapters[broker].executeOrder(tradeSignal);
      return res.json({
        signal: tradeSignal,
        executed: true,
        orderId: executionResult.orderId
      });
    }
    
    // Otherwise just return signal
    res.json({
      signal: tradeSignal,
      executed: false,
      readyToExecute: true
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Trading API server running on port ${PORT}`);
  console.log(`📊 Health check: GET http://localhost:${PORT}/api/health`);
});
```

#### 2. Update `package.json`

Add dependencies:
```bash
npm install express cors
```

Add scripts:
```json
{
  "scripts": {
    "start": "node api/server.js",
    "dev": "nodemon api/server.js",
    "test": "jest"
  }
}
```

---

## Day 2-3: Broker Abstraction Layer

### What We're Building

```
┌─────────────────────────────────────────┐
│      BrokerAdapter (Abstract)            │
│  - executeOrder()                        │
│  - getPosition()                         │
│  - getBalance()                          │
│  - closePosition()                       │
└──────┬──────────────────┬────────────────┘
       │                  │
   ┌───┴────┐      ┌──────┴────┐
   │ Binance │      │    MT5    │
   │Adapter  │      │  Adapter  │
   └────────┘      └───────────┘
```

#### 1. Create `api/adapters/BaseBrokerAdapter.js`

```javascript
/**
 * Abstract base class for all broker adapters
 * Defines the interface that all brokers must implement
 */
class BaseBrokerAdapter {
  constructor(config = {}) {
    this.config = config;
    this.connected = false;
  }

  async connect() {
    throw new Error('connect() must be implemented');
  }

  async disconnect() {
    throw new Error('disconnect() must be implemented');
  }

  async executeOrder(order) {
    /**
     * order = {
     *   symbol: 'EURUSD',
     *   side: 'BUY' | 'SELL',
     *   type: 'MARKET' | 'LIMIT',
     *   quantity: 1,
     *   price: 1.1000 (optional for MARKET),
     *   stopLoss: 1.0950,
     *   takeProfit: 1.1050
     * }
     */
    throw new Error('executeOrder() must be implemented');
  }

  async getPosition(symbol) {
    /**
     * Returns:
     * {
     *   symbol: 'EURUSD',
     *   quantity: 1,
     *   entryPrice: 1.1000,
     *   currentPrice: 1.1010,
     *   pnl: 10,
     *   pnlPercent: 0.09,
     *   stopLoss: 1.0950,
     *   takeProfit: 1.1050
     * }
     */
    throw new Error('getPosition() must be implemented');
  }

  async getBalance() {
    /**
     * Returns:
     * {
     *   balance: 10000,
     *   equity: 10050,
     *   margin: 1000,
     *   freeMargin: 9050,
     *   marginLevel: 1000.5
     * }
     */
    throw new Error('getBalance() must be implemented');
  }

  async closePosition(symbol) {
    throw new Error('closePosition() must be implemented');
  }

  async modifyPosition(symbol, updates) {
    /**
     * updates = {
     *   stopLoss?: number,
     *   takeProfit?: number
     * }
     */
    throw new Error('modifyPosition() must be implemented');
  }
}

module.exports = BaseBrokerAdapter;
```

#### 2. Upgrade `brokers/BinanceAdapter.js`

Replace the existing adapter:

```javascript
const axios = require('axios');
const crypto = require('crypto');
const BaseBrokerAdapter = require('../api/adapters/BaseBrokerAdapter');

class BinanceAdapter extends BaseBrokerAdapter {
  constructor(config) {
    super(config);
    this.baseURL = 'https://api.binance.com';
    this.apiKey = config.apiKey;
    this.apiSecret = config.apiSecret;
    this.recvWindow = 5000;
    this.openPositions = new Map();
  }

  // Helper: sign requests
  sign(params) {
    const query = new URLSearchParams(params);
    const signature = crypto
      .createHmac('sha256', this.apiSecret)
      .update(query.toString())
      .digest('hex');
    return { ...params, signature };
  }

  // Helper: make signed request
  async request(method, endpoint, params = {}) {
    const timestamp = Date.now();
    const signedParams = this.sign({ ...params, timestamp });
    
    try {
      const response = await axios({
        method,
        url: `${this.baseURL}${endpoint}`,
        params: signedParams,
        headers: {
          'X-MBX-APIKEY': this.apiKey
        }
      });
      return response.data;
    } catch (error) {
      throw new Error(`Binance API error: ${error.response?.data?.msg || error.message}`);
    }
  }

  async connect() {
    try {
      // Test connection
      await this.request('GET', '/api/v3/account');
      this.connected = true;
      console.log('✅ Connected to Binance');
    } catch (error) {
      throw new Error('Failed to connect to Binance: ' + error.message);
    }
  }

  async executeOrder(order) {
    const {
      symbol,
      side,
      type = 'MARKET',
      quantity,
      price,
      stopLoss,
      takeProfit
    } = order;

    // Normalize symbol for Binance (add USDT if not present)
    const binanceSymbol = symbol.includes('USDT') ? symbol : symbol + 'USDT';

    try {
      // Place market order
      const params = {
        symbol: binanceSymbol,
        side: side.toUpperCase(),
        type,
        quantity
      };

      if (type === 'LIMIT' && price) {
        params.price = price;
        params.timeInForce = 'GTC';
      }

      const result = await this.request('POST', '/api/v3/order', params);

      // Store position details
      this.openPositions.set(binanceSymbol, {
        symbol: binanceSymbol,
        orderId: result.orderId,
        quantity: parseFloat(quantity),
        entryPrice: parseFloat(result.fills?.[0]?.price || price || 0),
        stopLoss: parseFloat(stopLoss),
        takeProfit: parseFloat(takeProfit),
        openTime: new Date(result.transactTime),
        stops: {
          stopLoss,
          takeProfit
        }
      });

      return {
        success: true,
        orderId: result.orderId,
        symbol: binanceSymbol,
        side,
        quantity,
        price: result.fills?.[0]?.price || price,
        status: result.status,
        executedTime: new Date(result.transactTime)
      };
    } catch (error) {
      throw error;
    }
  }

  async getPosition(symbol) {
    const binanceSymbol = symbol.includes('USDT') ? symbol : symbol + 'USDT';

    // For now, return from open positions
    // In production, fetch from Binance
    if (this.openPositions.has(binanceSymbol)) {
      const pos = this.openPositions.get(binanceSymbol);
      
      // Get current price
      const ticker = await this.request('GET', '/api/v3/ticker/price', {
        symbol: binanceSymbol
      });

      const currentPrice = parseFloat(ticker.price);
      const entryPrice = pos.entryPrice;
      const pnl = (currentPrice - entryPrice) * pos.quantity;
      const pnlPercent = ((currentPrice - entryPrice) / entryPrice) * 100;

      return {
        symbol: binanceSymbol,
        quantity: pos.quantity,
        entryPrice,
        currentPrice,
        pnl,
        pnlPercent,
        stopLoss: pos.stopLoss,
        takeProfit: pos.takeProfit
      };
    }

    return null;
  }

  async getBalance() {
    try {
      const accountInfo = await this.request('GET', '/api/v3/account');
      
      const usdtBalance = accountInfo.balances.find(b => b.asset === 'USDT');
      
      return {
        balance: parseFloat(usdtBalance?.free || 0),
        locked: parseFloat(usdtBalance?.locked || 0),
        total: parseFloat(usdtBalance?.free || 0) + parseFloat(usdtBalance?.locked || 0)
      };
    } catch (error) {
      throw error;
    }
  }

  async closePosition(symbol) {
    const binanceSymbol = symbol.includes('USDT') ? symbol : symbol + 'USDT';
    
    const position = this.openPositions.get(binanceSymbol);
    if (!position) {
      throw new Error(`No open position for ${binanceSymbol}`);
    }

    try {
      const result = await this.request('POST', '/api/v3/order', {
        symbol: binanceSymbol,
        side: 'SELL',
        type: 'MARKET',
        quantity: position.quantity
      });

      this.openPositions.delete(binanceSymbol);

      return {
        success: true,
        closedPrice: result.fills?.[0]?.price,
        closedTime: new Date(result.transactTime)
      };
    } catch (error) {
      throw error;
    }
  }

  async modifyPosition(symbol, updates) {
    const binanceSymbol = symbol.includes('USDT') ? symbol : symbol + 'USDT';
    const position = this.openPositions.get(binanceSymbol);

    if (!position) {
      throw new Error(`No open position for ${binanceSymbol}`);
    }

    if (updates.stopLoss) position.stopLoss = updates.stopLoss;
    if (updates.takeProfit) position.takeProfit = updates.takeProfit;

    // Note: Binance doesn't have native SL/TP on spot, would need OCO orders
    // This is simplified for demo

    return { success: true, ...position };
  }

  async disconnect() {
    this.connected = false;
    console.log('❌ Disconnected from Binance');
  }
}

module.exports = BinanceAdapter;
```

---

## Day 3-4: MetaAPI (MT5) Integration

#### Create `brokers/MetaAPIAdapter.js`

```javascript
const BaseBrokerAdapter = require('../api/adapters/BaseBrokerAdapter');
const axios = require('axios');

class MetaAPIAdapter extends BaseBrokerAdapter {
  constructor(config) {
    super(config);
    this.accountId = config.accountId;
    this.token = config.metaApiToken; // Get from metaapi.cloud
    this.baseURL = 'https://api.metaapi.cloud/v1';
  }

  async connect() {
    try {
      const response = await axios.get(
        `${this.baseURL}/accounts/${this.accountId}`,
        { headers: { 'auth-token': this.token } }
      );
      
      if (response.data.state === 'CONNECTED') {
        this.connected = true;
        console.log('✅ Connected to MetaAPI (MT5)');
      } else {
        throw new Error('Account not connected');
      }
    } catch (error) {
      throw new Error('Failed to connect to MetaAPI: ' + error.message);
    }
  }

  async executeOrder(order) {
    const {
      symbol,
      side,
      quantity,
      stopLoss,
      takeProfit
    } = order;

    try {
      const response = await axios.post(
        `${this.baseURL}/accounts/${this.accountId}/trade`,
        {
          actionType: side === 'BUY' ? 'ORDER_TYPE_BUY' : 'ORDER_TYPE_SELL',
          symbol,
          volume: quantity,
          stopLoss,
          takeProfit
        },
        { headers: { 'auth-token': this.token } }
      );

      return {
        success: true,
        orderId: response.data.orderId,
        symbol,
        side,
        quantity,
        status: 'EXECUTED'
      };
    } catch (error) {
      throw new Error('MetaAPI trade failed: ' + error.message);
    }
  }

  async getPosition(symbol) {
    try {
      const response = await axios.get(
        `${this.baseURL}/accounts/${this.accountId}/positions`,
        { headers: { 'auth-token': this.token } }
      );

      const position = response.data.positions.find(p => p.symbol === symbol);
      if (!position) return null;

      return {
        symbol,
        quantity: position.volume,
        entryPrice: position.openPrice,
        currentPrice: position.currentPrice,
        pnl: position.profit,
        pnlPercent: (position.profit / (position.openPrice * position.volume)) * 100,
        stopLoss: position.stopLoss,
        takeProfit: position.takeProfit
      };
    } catch (error) {
      throw error;
    }
  }

  async getBalance() {
    try {
      const response = await axios.get(
        `${this.baseURL}/accounts/${this.accountId}`,
        { headers: { 'auth-token': this.token } }
      );

      return {
        balance: response.data.balance,
        equity: response.data.equity,
        margin: response.data.margin,
        freeMargin: response.data.freeMargin,
        marginLevel: response.data.marginLevel
      };
    } catch (error) {
      throw error;
    }
  }

  async closePosition(symbol) {
    try {
      await axios.post(
        `${this.baseURL}/accounts/${this.accountId}/trade`,
        {
          actionType: 'ORDER_TYPE_CLOSE_BY_SYMBOL',
          symbol
        },
        { headers: { 'auth-token': this.token } }
      );

      return { success: true, symbol };
    } catch (error) {
      throw error;
    }
  }

  async modifyPosition(symbol, updates) {
    // MetaAPI handles this through position updates
    // Implementation depends on their API specifics
    return { success: true };
  }

  async disconnect() {
    this.connected = false;
    console.log('Disconnected from MetaAPI');
  }
}

module.exports = MetaAPIAdapter;
```

---

## Day 4-5: Frontend Integration

### Update `frontend/src/app/services/tradingService.ts`

```typescript
interface Trade {
  symbol: string;
  action: 'BUY' | 'SELL';
  volume: number;
  stopLoss: number;
  takeProfit: number;
}

interface ExecutionResult {
  success: boolean;
  orderId?: string;
  error?: string;
  execut...
}

export const tradingService = {
  async executeTrade(broker: string, trade: Trade): Promise<ExecutionResult> {
    try {
      const response = await fetch('http://localhost:3000/api/trades/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          broker,
          symbol: trade.symbol,
          action: trade.action,
          volume: trade.volume,
          stopLoss: trade.stopLoss,
          takeProfit: trade.takeProfit
        })
      });

      return await response.json();
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  async getPosition(broker: string, symbol: string) {
    const response = await fetch(
      `http://localhost:3000/api/trades/position/${symbol}?broker=${broker}`
    );
    return await response.json();
  },

  async getBalance(broker: string) {
    const response = await fetch(
      `http://localhost:3000/api/account/balance?broker=${broker}`
    );
    return await response.json();
  },

  async runStrategyAndExecute(broker: string, symbol: string, price: number) {
    const response = await fetch('http://localhost:3000/api/strategy/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ broker, symbol, price })
    });
    return await response.json();
  }
};
```

---

## Day 5-6: UI Component for Trading

### Create `frontend/src/app/components/TradingPanel.tsx`

```typescript
import React, { useState } from 'react';
import { tradingService } from '../services/tradingService';

export const TradingPanel = () => {
  const [broker, setBroker] = useState('binance');
  const [symbol, setSymbol] = useState('EURUSD');
  const [action, setAction] = useState<'BUY' | 'SELL'>('BUY');
  const [volume, setVolume] = useState(1);
  const [stopLoss, setStopLoss] = useState(1.08);
  const [takeProfit, setTakeProfit] = useState(1.12);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleExecute = async () => {
    setLoading(true);
    const result = await tradingService.executeTrade(broker, {
      symbol,
      action,
      volume,
      stopLoss,
      takeProfit
    });
    setResult(result);
    setLoading(false);
  };

  return (
    <div className="p-4 border rounded">
      <h2 className="text-xl font-bold mb-4">💼 Trade Execution</h2>
      
      <div className="space-y-3">
        <select
          value={broker}
          onChange={e => setBroker(e.target.value)}
          className="w-full p-2 border rounded"
        >
          <option value="binance">Binance</option>
          <option value="mt5">MT5</option>
          <option value="ctrader">cTrader</option>
        </select>

        <input
          type="text"
          placeholder="Symbol (EURUSD, BTCUSDT)"
          value={symbol}
          onChange={e => setSymbol(e.target.value.toUpperCase())}
          className="w-full p-2 border rounded"
        />

        <div className="flex gap-2">
          <button
            onClick={() => setAction('BUY')}
            className={`flex-1 p-2 rounded ${action === 'BUY' ? 'bg-green-500 text-white' : 'bg-gray-200'}`}
          >
            BUY
          </button>
          <button
            onClick={() => setAction('SELL')}
            className={`flex-1 p-2 rounded ${action === 'SELL' ? 'bg-red-500 text-white' : 'bg-gray-200'}`}
          >
            SELL
          </button>
        </div>

        <input
          type="number"
          step="0.1"
          value={volume}
          onChange={e => setVolume(parseFloat(e.target.value))}
          placeholder="Volume"
          className="w-full p-2 border rounded"
        />

        <input
          type="number"
          step="0.0001"
          value={stopLoss}
          onChange={e => setStopLoss(parseFloat(e.target.value))}
          placeholder="Stop Loss"
          className="w-full p-2 border rounded"
        />

        <input
          type="number"
          step="0.0001"
          value={takeProfit}
          onChange={e => setTakeProfit(parseFloat(e.target.value))}
          placeholder="Take Profit"
          className="w-full p-2 border rounded"
        />

        <button
          onClick={handleExecute}
          disabled={loading}
          className="w-full bg-blue-500 text-white p-2 rounded font-bold disabled:opacity-50"
        >
          {loading ? 'Executing...' : '🚀 Execute Trade'}
        </button>
      </div>

      {result && (
        <div className={`mt-4 p-3 rounded ${result.success ? 'bg-green-100' : 'bg-red-100'}`}>
          {result.success ? (
            <>
              <p className="font-bold text-green-700">✅ Trade Executed!</p>
              <p className="text-sm">Order ID: {result.orderId}</p>
              <p className="text-sm">Price:${result.executedPrice}</p>
            </>
          ) : (
            <>
              <p className="font-bold text-red-700">❌ Execution Failed</p>
              <p className="text-sm">{result.error}</p>
            </>
          )}
        </div>
      )}
    </div>
  );
};
```

---

## Day 6-7: Testing & Integration

### Create `.env` file

```bash
# ./env
BINANCE_API_KEY=your_binance_key
BINANCE_API_SECRET=your_binance_secret
METAAPI_TOKEN=your_metaapi_token
METAAPI_ACCOUNT_ID=your_account_id
PORT=3000
```

### Test Script

```bash
# Start server in one terminal
npm run dev

# In another terminal, test with curl:
curl -X POST http://localhost:3000/api/health

# Test trade execution (simulate):
curl -X POST http://localhost:3000/api/strategy/execute \
  -H "Content-Type: application/json" \
  -d '{"symbol":"ETH","price":2500,"broker":"binance"}'

# Test account balance:
curl "http://localhost:3000/api/account/balance?broker=binance"
```

---

## What You'll Have at the End

✅ **Working API server** that connects frontend to backend
✅ **Broker abstraction layer** with consistent interface
✅ **Binance live trading** (testnet or real with paper trading)
✅ **MT5 integration** via MetaAPI
✅ **Frontend trade panel** with live execution
✅ **Position tracking** per symbol
✅ **Account balance** monitoring

---

## Week 2+: Next Steps

Once this is working:

1. **Add Telegram alerts** (when trade executes, send message)
2. **Add position monitoring** (update P&L every tick)
3. **Add copy-trading** (let followers auto-execute your trades)
4. **Add backtesting** (test strategy before live)
5. **Deploy to Kubernetes** (then scale)

---

## Files Summary

### New files to create:
- `api/server.js` — Express server
- `api/adapters/BaseBrokerAdapter.js` — Base class
- `brokers/MetaAPIAdapter.js` — MT5 adapter
- `frontend/src/app/services/tradingService.ts` — Frontend service
- `frontend/src/app/components/TradingPanel.tsx` — UI component
- `.env` — Configuration

### Files to update:
- `brokers/BinanceAdapter.js` — Add execution logic
- `package.json` — Add dependencies and scripts

---

## Dependencies to install

```bash
npm install express cors nodemon
npm install --save-dev @types/express @types/node
```

---

This gets you to a working trading platform in one week.

Would you like to start?
