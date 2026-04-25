# 🎯 SIMPLIFIED COPY-TRADING HUB ARCHITECTURE

**Philosophy:** Start simple, scale later  
**Model:** Duplikium-style copy-trading platform  
**Timeline:** 2-3 weeks to MVP  
**Brokers:** MT5 (Forex) + Binance (Crypto) + Bitget (Crypto)

---

## ⚡ The Core Idea (Ultra-Simple)

```
MASTER SIGNAL
    ↓
CENTRAL HUB (Express API)
    ↓
BROADCAST TO FOLLOWERS
    ├─ Follower Account 1 (MT5)
    ├─ Follower Account 2 (Binance)
    ├─ Follower Account 3 (Bitget)
    ├─ Follower Account 4 (MT5)
    └─ Follower Account 5 (Binance)
```

That's it. This is what makes money.

---

## 📊 What's REMOVED

From previous architecture, DELETE:

❌ cTrader adapter  
❌ Match Trader integration  
❌ Binance REST adapter (use unified approach)  
❌ Kubernetes Phase 1  
❌ Istio Phase 1  
❌ Multi-region routing Phase 1  

**These come back in Phase 2-3 when you have real users.**

---

## ✅ What Stays (Core Value)

### Brokers (3 Only)

**Forex:**
- MT5 (universal, 500+ brokers under one API)

**Crypto:**
- Binance (largest, most liquidity)
- Bitget (good API, copy-trading native support)

That's it. One simple decision per user:
- "Want forex?" → Use MT5 on your broker
- "Want crypto?" → Use Binance or Bitget

---

## 🏗️ Copy-Trading Hub Architecture

### File Structure (Simplified)

```
Micromax/
├── api/
│   ├── server.js                           ← Main hub
│   ├── services/
│   │   ├── mt5_bridge.py                   ← Forex execution
│   │   ├── binance_bridge.py               ← Crypto execution
│   │   ├── bitget_bridge.py                ← Crypto execution
│   │   └── copy_trading_engine.py          ← Core logic ⭐ NEW
│   ├── models/
│   │   ├── Signal.js                       ← Master signals
│   │   ├── Follower.js                     ← Follower accounts
│   │   └── Trade.js                        ← Copy record
│   └── requirements.txt
│
├── strategies/
│   ├── AlphaStrategy.js                    ← Your existing strategy
│   ├── BetaStrategy.js                     ← Your existing strategy
│   └── TemiStrategy.js                     ← Your existing strategy
│
├── config/
│   ├── .env.example                        ← Credentials
│   └── brokers.js                          ← Broker configs ⭐ NEW
│
└── dashboard/                              ← Simple React UI
    ├── FollowerList.tsx
    ├── CopyTradeStatus.tsx
    └── MasterSignalMonitor.tsx
```

---

## 💡 How It Works (End-to-End)

### Step 1: Strategy Triggers Master Signal

```javascript
// Your existing TemiStrategy generates signal
const signal = {
  symbol: "EURUSD",           // or "BTC" for crypto
  action: "BUY",
  volume: 1.0,
  stopLoss: 1.0850,
  takeProfit: 1.1050,
  timestamp: Date.now()
};

// Send to hub
POST /api/signals/create → {signal}
```

### Step 2: Hub Validates & Stores

```python
# copy_trading_engine.py
signal = create_signal(master_signal)
signal.status = "pending"         # Waiting for execution
signal.followers = [list of configured followers]
```

### Step 3: Hub Broadcasts to Followers

```javascript
// For each follower account:
FOR each follower in signal.followers:
  IF follower.broker == "MT5":
    → mt5_bridge.py: execute_order(signal)
  ELSE IF follower.broker == "Binance":
    → binance_bridge.py: execute_order(signal)
  ELSE IF follower.broker == "Bitget":
    → bitget_bridge.py: execute_order(signal)

// Track each execution
trade_record = {
  signal_id: "signal_123",
  follower_id: "follower_1",
  status: "executed",
  entry_price: 1.0900,
  timestamp: Date.now()
}
```

### Step 4: Monitor & Sync SL/TP

```python
# Continuous per-follower sync
EVERY 30 SECONDS:
  FOR each open_position:
    IF master.stop_loss changed:
      UPDATE follower.stop_loss
    IF master.take_profit changed:
      UPDATE follower.take_profit
```

### Step 5: Close Trade (When Master Closes)

```javascript
// Master closes position
PUT /api/signals/{signalId}/close
  ↓
FOR each follower:
  Close position on their broker
  Record P&L
```

---

## 📁 Core Files to Build

### 1. `api/services/copy_trading_engine.py` (NEW - ~200 lines)

```python
class CopyTradingEngine:
    """Core logic for replicating master trades to followers"""
    
    def broadcast_signal(self, signal, followers):
        """Send signal to all followers"""
        results = []
        for follower in followers:
            broker = follower['broker']  # 'MT5', 'Binance', 'Bitget'
            if broker == 'MT5':
                result = mt5_bridge.execute_order(signal, follower)
            elif broker == 'Binance':
                result = binance_bridge.execute_order(signal, follower)
            elif broker == 'Bitget':
                result = bitget_bridge.execute_order(signal, follower)
            results.append(result)
        return results
    
    def sync_stop_loss_take_profit(self, signal):
        """Update SL/TP on all open positions for this signal"""
        for position in signal['positions']:  # Per-follower positions
            broker = position['broker']
            if broker == 'MT5':
                mt5_bridge.modify_position(...)
            elif broker == 'Binance':
                binance_bridge.modify_position(...)
            elif broker == 'Bitget':
                bitget_bridge.modify_position(...)
    
    def close_signal(self, signal):
        """Close all positions from this signal across all followers"""
        for position in signal['positions']:
            broker = position['broker']
            if broker == 'MT5':
                mt5_bridge.close_position(...)
            elif broker == 'Binance':
                binance_bridge.close_position(...)
            elif broker == 'Bitget':
                bitget_bridge.close_position(...)
```

### 2. `api/services/binance_bridge.py` (NEW - ~300 lines)

```python
class BinanceBridge:
    """Execute trades on Binance Spot & Futures"""
    
    def connect(self, api_key, api_secret):
        """Connect to Binance with credentials"""
        self.client = Client(api_key, api_secret)
    
    def execute_order(self, order_data):
        """
        order_data = {
            'symbol': 'BTCUSDT',
            'action': 'BUY',
            'volume': 0.01,
            'stop_loss': 35000,
            'take_profit': 45000
        }
        """
        # Place market order
        order = self.client.order_market_buy(
            symbol=order_data['symbol'],
            quantity=order_data['volume']
        )
        
        # Add stop loss & take profit (additional orders)
        if order_data.get('stop_loss'):
            self.client.create_order(
                symbol=order_data['symbol'],
                side='SELL',
                type='STOP_LOSS',
                stopPrice=order_data['stop_loss'],
                quantity=order_data['volume']
            )
        
        return order
    
    def get_position(self, symbol):
        """Get open position for symbol"""
        positions = self.client.get_open_orders(symbol=symbol)
        return positions[0] if positions else None
    
    def close_position(self, symbol, quantity):
        """Close position (market sell)"""
        return self.client.order_market_sell(symbol=symbol, quantity=quantity)
    
    def modify_position(self, symbol, stop_loss, take_profit):
        """Cancel and replace SL/TP orders"""
        # Cancel existing stop orders
        self.client.cancel_open_orders(symbol=symbol)
        
        # Create new ones
        if stop_loss:
            self.client.create_order(...)
        if take_profit:
            self.client.create_order(...)
```

### 3. `api/services/bitget_bridge.py` (NEW - ~300 lines)

Similar to Binance, but using Bitget's API:

```python
class BitgetBridge:
    """Execute trades on Bitget Spot & Futures"""
    
    def connect(self, api_key, api_secret, passphrase):
        """Connect to Bitget"""
        self.client = BitgetRestClient(api_key, api_secret, passphrase)
    
    def execute_order(self, order_data):
        """Same signature as Binance for compatibility"""
        # Bitget native copy-trading support makes this easier
        trade = self.client.place_order(
            symbol=order_data['symbol'],
            side=order_data['action'].upper(),
            orderType='market',
            size=order_data['volume']
        )
        return trade
    
    def get_position(self, symbol):
        """Get open position"""
        return self.client.get_positions(symbol=symbol)
    
    def close_position(self, symbol, quantity):
        """Close position"""
        return self.client.close_position(symbol, quantity)
    
    def modify_position(self, symbol, stop_loss, take_profit):
        """Update SL/TP"""
        return self.client.modify_order(
            symbol=symbol,
            stopLoss=stop_loss,
            takeProfit=take_profit
        )
```

### 4. Update `api/server.js` (ADD these endpoints)

```javascript
// Copy-trading specific endpoints
app.post('/api/signals/create', (req, res) => {
  // New master signal from strategy
  const signal = copyTradingEngine.create_signal(req.body);
  copyTradingEngine.broadcast_signal(signal);
  res.json({ signal_id: signal.id, status: 'broadcasted' });
});

app.get('/api/signals/:signalId', (req, res) => {
  // Get signal details + all follower positions
  const signal = copyTradingEngine.get_signal(req.params.signalId);
  res.json(signal);
});

app.put('/api/signals/:signalId/sync', (req, res) => {
  // Sync SL/TP changes to all followers
  const result = copyTradingEngine.sync_stop_loss_take_profit(req.params.signalId);
  res.json({ updated: result.length });
});

app.post('/api/signals/:signalId/close', (req, res) => {
  // Close all follower positions for this signal
  const result = copyTradingEngine.close_signal(req.params.signalId);
  res.json({ closed: result.length });
});

app.get('/api/followers', (req, res) => {
  // List all connected follower accounts
  const followers = copyTradingEngine.get_all_followers();
  res.json(followers);
});

app.post('/api/followers/add', (req, res) => {
  // Add new follower account
  // { broker: 'Binance', account: '...', api_key: '...', api_secret: '...' }
  const follower = copyTradingEngine.add_follower(req.body);
  res.json({ follower_id: follower.id, status: 'connected' });
});
```

### 5. `config/brokers.js` (NEW)

```javascript
module.exports = {
  mt5: {
    name: 'MetaTrader 5',
    type: 'forex',
    brokers: [
      { name: 'Exness', server: 'Exness-Demo' },
      { name: 'IC Markets', server: 'ICMarketsSC' },
      // ... 500+ brokers
    ]
  },
  
  binance: {
    name: 'Binance',
    type: 'crypto',
    pairs: ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'XRPUSDT'],
    restUrl: 'https://api.binance.com',
    wsUrl: 'wss://stream.binance.com:9443'
  },
  
  bitget: {
    name: 'Bitget',
    type: 'crypto',
    pairs: ['BTCUSDT', 'ETHUSDT', 'BOMEUSDT'],
    restUrl: 'https://api.bitget.com',
    wsUrl: 'wss://ws.bitget.com/spot/v1/public'
  }
};
```

---

## 🚀 Phase 1: MVP (Weeks 1-3)

### Week 1: Setup & Core

- [ ] Install Binance SDK: `pip install python-binance`
- [ ] Install Bitget SDK: `pip install bitget-api`
- [ ] Implement `copy_trading_engine.py` (200 lines)
- [ ] Implement `binance_bridge.py` (300 lines)
- [ ] Implement `bitget_bridge.py` (300 lines)
- [ ] Update `api/server.js` with 6 new endpoints
- [ ] Create `config/brokers.js`

### Week 2: Integration & Testing

- [ ] Connect to your MT5 account (existing bridge)
- [ ] Connect to your Binance account
- [ ] Connect to your Bitget account
- [ ] Test signal broadcasting (1 signal → 3 followers)
- [ ] Test SL/TP sync
- [ ] Test position closing

### Week 3: UI & Polish

- [ ] Create simple React dashboard
  - FollowerList (show connected accounts)
  - CopyTradeStatus (show active signals)
  - SignalHistory (show past trades)
- [ ] Connect strategy to signal endpoint
- [ ] End-to-end testing

**Result:** A working copy-trading platform that replicates master trades to 2-5 followers.

---

## 📈 Phase 2 (Weeks 4-6): Improve Execution

**Only after MVP is live and working:**

- [ ] Region-based execution (faster routing)
- [ ] Latency optimization
- [ ] Better error handling & recovery
- [ ] Position sizing (risk management per follower)
- [ ] P&L tracking dashboard

---

## 🔥 Phase 3 (Weeks 7+): Scale Infrastructure

**Only when you have real users (100+):**

- [ ] Kubernetes deployment
- [ ] Istio service mesh
- [ ] Multi-region clusters
- [ ] Auto-scaling based on load
- [ ] Advanced routing

**This is what your Go autoscaler and Kubernetes setup was for.**

---

## 📊 Data Model

### Signal (Master Trade)

```javascript
{
  id: "signal_123",
  strategy: "TemiStrategy",
  symbol: "EURUSD",        // or "BTCUSDT"
  action: "BUY",
  volume: 1.0,
  stopLoss: 1.0850,
  takeProfit: 1.1050,
  
  // Status
  status: "broadcasted",   // pending, broadcasted, active, closed
  createdAt: 1712282400000,
  closedAt: null,
  
  // Followers who took this trade
  positions: [
    {
      follower_id: "follower_1",
      broker: "MT5",
      status: "open",
      entry_price: 1.0900,
      pnl: 45.50,
      pnl_percent: 0.5
    },
    {
      follower_id: "follower_2",
      broker: "Binance",
      status: "open",
      entry_price: 35200,
      pnl: 120.00,
      pnl_percent: 0.8
    }
  ]
}
```

### Follower Account

```javascript
{
  id: "follower_1",
  broker: "MT5",                    // 'MT5', 'Binance', 'Bitget'
  name: "John's Exness Account",
  
  // Credentials (encrypted)
  credentials: {
    account: 12345678,
    password: "encrypted...",
    server: "Exness-Demo"
  },
  
  // Copy settings
  copy_settings: {
    auto_copy: true,
    position_size_ratio: 1.0,       // 100% position sizing
    max_drawdown: 0.20,             // Stop copying at 20% DD
    min_balance: 1000               // Min account balance to trade
  },
  
  status: "connected",
  created_at: 1712282400000
}
```

---

## 🎯 Success Metrics

### Phase 1 Success

- ✅ Master signal broadcasts to 5 followers
- ✅ All 5 followers execute in <5 seconds
- ✅ SL/TP syncs across all accounts
- ✅ P&L calculated correctly
- ✅ UI shows active signal + P&L

### Phase 2 Success

- ✅ Execution latency <1 second
- ✅ 10+ followers supported
- ✅ P&L dashboard with performance metrics

### Phase 3 Success

- ✅ 100+ followers
- ✅ <100ms execution latency
- ✅ Auto-scaling handling load

---

## 💰 Revenue Model

Once MVP works:

1. **Basic Plan:** 5 followers, 0% fee
2. **Pro Plan:** 20 followers, 10% profit share
3. **Enterprise Plan:** Unlimited, 15% profit share

---

## ⚠️ What We Removed (And Why)

### ❌ cTrader & Match Trader

- Extra complexity
- No real users asked for it
- Can add later if needed
- MVP doesn't need it

### ❌ Kubernetes & Istio (Phase 1)

- Overkill for 5 followers
- Can run on $10/month VPS
- Brings it in when scaling to 100+
- This is the smart move

### ❌ Multi-region routing

- Wait until you need it (100+ users)
- Single region works fine for Phase 1

---

## 🚀 Why This Works

**Duplikium, Traders Connect, and every successful copy-trading platform:**

1. Started with simple hub
2. Master → Followers broadcast
3. Get real users getting real returns
4. THEN add infrastructure complexity

**You're skipping 6 months of unnecessary engineering.**

---

## Next Steps

1. **Today:** Decide if this is the direction (it is 🎯)
2. **Tomorrow:** Start `copy_trading_engine.py`
3. **Week 1:** Have all 3 brokers connected
4. **Week 2:** Broadcast working
5. **Week 3:** UI complete, test with your own strategy
6. **Week 4:** Live with real followers

---

**This is focused. This is profitable. This is implementable.**

Let's build it.

