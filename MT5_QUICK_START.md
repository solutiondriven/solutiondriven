# 🚀 MT5 Integration Quick Start

## What You Now Have

A **universal trading bot** that works with ANY broker that uses MetaTrader 5.

```
Your Bot → MT5 Python Bridge → MT5 Terminal
                              ↓
                    Connect to ANY MT5 Broker
                    (Exness, IC Markets, Pepperstone, FXOpen, etc.)
```

---

## Step 1: Install MetaTrader 5

### For Windows (Recommended)

1. Download MT5 from your broker:
   - **Exness:** https://exness.com/download/
   - **IC Markets:** https://icmarkets.com/download/
   - **Pepperstone:** https://pepperstone.com/download/
   - Or any other broker using MT5

2. Install the platform

3. Create/Import an account:
   - Demo account (for testing) OR
   - Real account (for live trading)

4. **IMPORTANT:** Enable algorithmic trading
   - Tools → Options → Expert Advisors
   - ✅ Enable Expert Advisors
   - ✅ Enable DLL imports
   - ✅ Allow live trading (for real accounts)

5. Note your credentials:
   - **Account number:** (shown in terminal top-left)
   - **Password:** (your login password)
   - **Server:** (e.g., "Exness-Real2", "ICMarkets-Demo01")

---

## Step 2: Install Python Dependencies

```bash
cd Micromax/api
pip install -r requirements.txt
```

This installs:
- `MetaTrader5` — Python bridge to MT5
- `requests` — HTTP client
- `python-dotenv` — Environment variables

---

## Step 3: Start the Trading Server

```bash
cd Micromax
npm run dev
```

Expected output:
```
╔════════════════════════════════════════════════════════════╗
║     MICROMAX TRADING API SERVER - MT5 UNIVERSAL            ║
║                                                            ║
║  🚀 Server running on port 3000                            ║
║  📊 Health check: GET http://localhost:3000/api/health   ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
```

---

## Step 4: Connect to Your MT5 Broker

### Using cURL (For Testing)

```bash
curl -X POST http://localhost:3000/api/mt5/connect \
  -H "Content-Type: application/json" \
  -d '{
    "account": 123456,
    "password": "your_password",
    "server": "Exness-Real2"
  }'
```

Replace:
- `123456` → your account number
- `your_password` → your MT5 password
- `Exness-Real2` → your broker server (see examples below)

### Broker Server Names

| Broker | Demo Server | Real Server |
|--------|-----------|------------|
| Exness | `Exness-Demo` | `Exness-Real2` |
| IC Markets | `ICMarkets-Demo01` | `ICMarkets-Live` |
| Pepperstone | `Pepperstone-Demo` | `Pepperstone-Live` |
| FXOpen | `FXOpen-Demo` | `FXOpen-Real` |
| Others | Check in MT5 terminal | Check in MT5 terminal |

---

## Step 5: Test Trading

### Execute a Trade

```bash
curl -X POST http://localhost:3000/api/trades/execute \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "EURUSD",
    "action": "BUY",
    "volume": 0.1,
    "stopLoss": 1.0850,
    "takeProfit": 1.1050
  }'
```

Response:
```json
{
  "success": true,
  "order_id": 654321,
  "symbol": "EURUSD",
  "action": "BUY",
  "volume": 0.1,
  "stop_loss": 1.0850,
  "take_profit": 1.1050,
  "timestamp": "2026-04-05T10:30:00.000Z"
}
```

### Get All Positions

```bash
curl http://localhost:3000/api/positions
```

### Get Account Balance

```bash
curl http://localhost:3000/api/account/info
```

### Close a Position

```bash
curl -X POST http://localhost:3000/api/positions/EURUSD/close
```

### Modify Stop Loss / Take Profit

```bash
curl -X POST http://localhost:3000/api/positions/EURUSD/modify \
  -H "Content-Type: application/json" \
  -d '{
    "stopLoss": 1.0900,
    "takeProfit": 1.1100
  }'
```

---

## Step 6: Connect Frontend to API

### Update `frontend/src/app/services/tradingService.ts`

```typescript
const API_URL = 'http://localhost:3000/api';

export const tradingService = {
  // Connect to a broker
  async connectToBroker(account: number, password: string, server: string) {
    const response = await fetch(`${API_URL}/mt5/connect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ account, password, server })
    });
    return await response.json();
  },

  // Execute a trade
  async executeTrade(symbol: string, action: string, volume: number, sl: number, tp: number) {
    const response = await fetch(`${API_URL}/trades/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        symbol,
        action,
        volume,
        stopLoss: sl,
        takeProfit: tp
      })
    });
    return await response.json();
  },

  // Get positions
  async getPositions() {
    const response = await fetch(`${API_URL}/positions`);
    return await response.json();
  },

  // Get account info
  async getAccountInfo() {
    const response = await fetch(`${API_URL}/account/info`);
    return await response.json();
  },

  // Close position
  async closePosition(symbol: string) {
    const response = await fetch(`${API_URL}/positions/${symbol}/close`, {
      method: 'POST'
    });
    return await response.json();
  },

  // Get trade history
  async getTradeHistory(days: number = 7) {
    const response = await fetch(`${API_URL}/trades/history?days=${days}`);
    return await response.json();
  }
};
```

---

## Step 7: Build a Simple Frontend Component

### React Trading Panel

```typescript
import React, { useState } from 'react';
import { tradingService } from '../services/tradingService';

export const MT5TradingPanel = () => {
  const [connected, setConnected] = useState(false);
  const [account, setAccount] = useState('');
  const [password, setPassword] = useState('');
  const [server, setServer] = useState('Exness-Demo');
  const [loading, setLoading] = useState(false);
  
  const [symbol, setSymbol] = useState('EURUSD');
  const [action, setAction] = useState('BUY');
  const [volume, setVolume] = useState(0.1);
  const [sl, setSL] = useState(1.0850);
  const [tp, setTP] = useState(1.1050);

  const handleConnect = async () => {
    setLoading(true);
    const result = await tradingService.connectToBroker(
      parseInt(account),
      password,
      server
    );
    if (result.success) {
      setConnected(true);
      alert('✅ Connected to ' + server);
    }
    setLoading(false);
  };

  const handleExecuteTrade = async () => {
    const result = await tradingService.executeTrade(symbol, action, volume, sl, tp);
    if (result.success) {
      alert(`✅ Order ${result.order_id} executed!`);
    } else {
      alert(`❌ Error: ${result.error}`);
    }
  };

  return (
    <div className="p-6 bg-gray-900 text-white rounded-lg">
      <h2 className="text-2xl font-bold mb-6">💼 MT5 Trading Terminal</h2>

      {!connected ? (
        <div className="space-y-4 mb-6 p-4 bg-gray-800 rounded">
          <h3 className="font-bold">📡 Connect to Broker</h3>
          
          <input
            type="text"
            placeholder="Account number"
            value={account}
            onChange={(e) => setAccount(e.target.value)}
            className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white"
          />
          
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white"
          />
          
          <select
            value={server}
            onChange={(e) => setServer(e.target.value)}
            className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white"
          >
            <option>Exness-Demo</option>
            <option>Exness-Real2</option>
            <option>ICMarkets-Demo01</option>
            <option>Pepperstone-Demo</option>
            <option>FXOpen-Demo</option>
          </select>
          
          <button
            onClick={handleConnect}
            disabled={loading || !account || !password}
            className="w-full bg-blue-600 disabled:opacity-50 p-2 rounded font-bold"
          >
            {loading ? '🔄 Connecting...' : '🚀 Connect'}
          </button>
        </div>
      ) : (
        <div className="p-4 bg-green-900 rounded mb-6">
          <p className="font-bold">✅ Connected to {server}</p>
        </div>
      )}

      {connected && (
        <div className="space-y-4 p-4 bg-gray-800 rounded">
          <h3 className="font-bold">📊 Execute Trade</h3>
          
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              placeholder="Symbol (EURUSD)"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              className="p-2 bg-gray-700 border border-gray-600 rounded text-white"
            />
            
            <select
              value={action}
              onChange={(e) => setAction(e.target.value)}
              className="p-2 bg-gray-700 border border-gray-600 rounded text-white"
            >
              <option>BUY</option>
              <option>SELL</option>
            </select>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <input
              type="number"
              step="0.01"
              value={volume}
              onChange={(e) => setVolume(parseFloat(e.target.value))}
              placeholder="Volume"
              className="p-2 bg-gray-700 border border-gray-600 rounded text-white"
            />
            
            <input
              type="number"
              step="0.0001"
              value={sl}
              onChange={(e) => setSL(parseFloat(e.target.value))}
              placeholder="Stop Loss"
              className="p-2 bg-gray-700 border border-gray-600 rounded text-white"
            />
            
            <input
              type="number"
              step="0.0001"
              value={tp}
              onChange={(e) => setTP(parseFloat(e.target.value))}
              placeholder="Take Profit"
              className="p-2 bg-gray-700 border border-gray-600 rounded text-white"
            />
          </div>
          
          <button
            onClick={handleExecuteTrade}
            className="w-full bg-green-600 hover:bg-green-700 p-3 rounded font-bold text-lg"
          >
            🎯 Execute Trade
          </button>
        </div>
      )}
    </div>
  );
};
```

---

## Supported Symbols

Any symbol available in your MT5 broker:

**Forex:**
- EURUSD, GBPUSD, USDJPY, USDCAD, AUDUSD, NZDUSD, EURGBP, EURJPY

**Crypto (if available):**
- BTCUSD, ETHUSD, XRPUSD

**Indices:**
- SPX500, DAX40, UK100

**Commodities:**
- XAUUSD (Gold), XAGUSD (Silver), XPDUSD, XPTUSD

Check your broker for available symbols.

---

## Troubleshooting

### "MetaTrader5 not found"

```
pip install MetaTrader5
```

### "Login failed: Invalid password"

- Check your account number
- Check your password (case-sensitive)
- Verify server name is correct for your broker

### "Symbol not found"

- Make sure the symbol is tradable on your broker
- Use exact symbol name (e.g., "EURUSD", not "EUR/USD")

### "Order failed: Insufficient margin"

- Your account balance is too low for the volume
- Reduce volume or increase balance

### Server not responding

- Make sure Express server is running: `npm run dev`
- Check port 3000 is not in use: `lsof -i :3000`

---

## Next Steps

1. ✅ Test with **demo account** first
2. ✅ Verify trades execute correctly
3. ✅ Connect **frontend to backend**
4. ✅ Set up **copy-trading** for followers
5. ✅ Deploy to production

---

## Copy-Trading Setup

Once you have the bot working:

1. Create a **Master MT5 account** (your trading account)
2. Create **Slave MT5 accounts** (follower accounts)
3. Use MT5's native copy-trading or our Python manager:

```python
from api.services.copytrader import CopyTrader

master = MT5Bridge()
master.connect(master_account, master_password, master_server)

followers = [
  MT5Bridge(), 
  MT5Bridge()
]

for follower in followers:
  follower.connect(follower_account, follower_password, follower_server)

copier = CopyTrader(master, followers)
copier.start()  # Sync trades instantly
```

---

## Done!

You now have:
- ✅ A universal MT5 adapter
- ✅ Works with ANY MT5 broker
- ✅ API server for frontend
- ✅ Trade execution on any broker
- ✅ Copy-trading ready

**Your bot is now truly broker-agnostic. Users can pick their favorite broker, and your bot works there.**

This is the right architecture.
