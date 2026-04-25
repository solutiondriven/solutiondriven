# 🚀 REAL EXECUTION ENGINE - SETUP & GO LIVE

**Status: Ready to execute REAL trades**

---

## ⚡ QUICK START (5 minutes to real execution)

### Step 1: Get Your API Credentials

#### For MT5 (Forex):
1. Open MetaTrader 5
2. File → Account Settings
3. Note your **Account Number**
4. Your **Password** (trading password)
5. Your **Server** (e.g., Exness-Demo, Exness-Real, IC Markets)

#### For Binance (Crypto):
1. Go to https://www.binance.com
2. Account → API Management
3. Create new API key
4. Copy **API Key** and **Secret Key**
5. Enable "Spot Trading"

#### For Bitget (Crypto):
1. Go to https://www.bitget.com
2. Account → API Management
3. Create new API key
4. Copy **API Key**, **Secret Key**, and **Passphrase**
5. Enable "Spot Trading"

### Step 2: Configure Credentials

```bash
cd Micromax
cp .env.json.example .env.json
```

Edit `.env.json` and fill in your REAL credentials:

```json
{
  "mt5": {
    "account": "1234567",
    "password": "YourPassword",
    "server": "Exness-Demo"
  },
  "binance": {
    "api_key": "your-binance-api-key",
    "api_secret": "your-binance-api-secret"
  },
  "bitget": {
    "api_key": "your-bitget-api-key",
    "api_secret": "your-bitget-api-secret",
    "passphrase": "your-bitget-passphrase"
  }
}
```

⚠️ **KEEP THIS FILE SAFE** - It contains your trading credentials!

### Step 3: Start the Real Execution Engine

```bash
cd Micromax
node api/server-real.js
```

You should see:
```
✓ Binance connected
✓ Bitget connected  
✓ MT5 ready

REAL EXECUTION ENGINE - LIVE ON PORT 3000
```

### Step 4: Execute Your First Real Trade

#### Terminal 2:
```bash
cd Micromax
node api/test-real-execution.js
```

This will:
1. ✅ Create a trading signal
2. ✅ Register your 3 broker accounts
3. ✅ **BROADCAST THE SIGNAL** → Executes on all 3 brokers simultaneously
4. ✅ Show you how to verify the trades

Expected output:
```
✓ Signal created: abc123
✓ MT5 follower registered
✓ Binance follower registered
✓ Bitget follower registered

BROADCAST SIGNAL TO ALL BROKERS
✓ my_mt5_account (mt5)
✓ my_binance_account (binance)
✓ my_bitget_account (bitget)

Results: 3 executed, 0 failed
```

### Step 5: Verify Trades On Your Brokers

Check that the order actually executed:

**MT5:**
- Open MetaTrader 5
- Terminal → Trade tab
- Look for: EURUSD BUY order (0.1 volume)

**Binance:**
- https://www.binance.com
- Open Orders section
- You should see a BUY order

**Bitget:**
- https://www.bitget.com
- Portfolio → Order History
- Look for recent BUY orders

---

## 🎯 WHAT JUST HAPPENED

```
Your Signal Generator → Central Hub
                           ↓
                    Broadcast Command
                           ↓
        ┌────────────┬──────────────┬──────────────┐
        ↓            ↓              ↓              ↓
      MT5       Binance          Bitget      Your Accounts
     (0.1)       (0.05)           (0.03)
      ↓            ↓              ↓
    ORDER    →    ORDER    →     ORDER
    PLACED       PLACED          PLACED
      ↓            ↓              ↓
   EURUSD       BTCUSD       Your Coin
   FILLED       FILLED        FILLED
```

**All 3 executed simultaneously. Money moved on all 3 brokers.**

---

## 🔧 API ENDPOINTS (For Manual Testing)

### Create Signal
```bash
curl -X POST http://localhost:3000/api/signals/create \
  -H "Content-Type: application/json" \
  -d '{
    "strategy": "MyStrategy",
    "symbol": "EURUSD",
    "action": "BUY",
    "volume": 1.0,
    "stop_loss": 1.0900,
    "take_profit": 1.1100
  }'
```

### Register Follower
```bash
curl -X POST http://localhost:3000/api/followers/add \
  -H "Content-Type: application/json" \
  -d '{
    "follower_id": "my_mt5",
    "broker_type": "mt5",
    "volume_factor": 1.0
  }'
```

### Broadcast Signal (EXECUTE REAL TRADES!)
```bash
curl -X POST http://localhost:3000/api/signals/abc123/broadcast
```

### Close All Positions
```bash
curl -X POST http://localhost:3000/api/signals/abc123/close
```

### Sync Stop Loss & Take Profit
```bash
curl -X PUT http://localhost:3000/api/signals/abc123/sync \
  -H "Content-Type: application/json" \
  -d '{
    "stop_loss": 1.0800,
    "take_profit": 1.1200
  }'
```

### Get Hub Status
```bash
curl http://localhost:3000/api/copy-trading/status
```

---

## ⚠️ SAFETY & BEST PRACTICES

### For Testing:
```json
{
  "mt5": {
    "account": "demo_account",
    "server": "Exness-Demo"  ← Use DEMO account first!
  }
}
```

### Volume Management:
- Start small: 0.01-0.1 volume
- Use volume_factor to scale followers:
  - Master: 1.0 (full volume)
  - Follower 1: 0.5 (half volume)
  - Follower 2: 0.25 (quarter volume)

### Stop Loss & Take Profit:
Always set these before broadcasting:
```bash
# Set SL/TP before broadcast
curl -X POST .../api/signals/create \
  -d '{
    "stop_loss": 1.0900,      ← Required
    "take_profit": 1.1100      ← Required
  }'
```

### API Key Security:
- Use Read+Trade only permissions
- Never commit .env.json to git
- Add to .gitignore:
```
.env.json
.env
credentials.json
```

---

## 🚨 TROUBLESHOOTING

### "Binance connection failed"
```
✗ Check:
  1. API keys are correct
  2. API is enabled on Binance
  3. Correct IP whitelisting
  4. Network connectivity
```

### "MT5 not initialized"
```
✗ Check:
  1. MetaTrader 5 is open
  2. Account number is correct
  3. Password is correct
  4. Server name matches
```

### "No credentials loaded"
```
✗ Make sure:
  1. .env.json exists in Micromax folder
  2. File is valid JSON
  3. No typos in keys
```

### "Order failed with error: insufficient balance"
```
✗ Solution:
  1. Check your broker account has funds
  2. Reduce order size
  3. Use demo account for testing
```

---

## 📊 NEXT: AUTOMATION

Once real execution works, you can:

### Set Up Continuous Bot
```javascript
// Run strategy every minute, generate signals automatically
setInterval(() => {
  const signal = generateSignalFromStrategy();
  engine.broadcastSignal(signal);
}, 60000);
```

### Add Database
Store signals, trades, and users:
- Replace in-memory engine with SQLite/MongoDB
- Persist everything to database
- Never lose data on restart

### Deploy to VPS
```bash
scp -r Micromax user@vps.ip:/home/app/
ssh user@vps.ip
cd /home/app/Micromax
node api/server-real.js
```

---

## ✅ CHECKLIST

Before going live:

- [ ] .env.json created with your credentials
- [ ] Test with demo account first
- [ ] Small order sizes (0.01-0.1)
- [ ] Stop loss and take profit set
- [ ] Verified on all 3 brokers
- [ ] Understand fees and slippage
- [ ] Ready for real money

---

## 🎉 YOU NOW HAVE

✅ A working copy-trading hub  
✅ Real execution on 3 brokers  
✅ 1 signal → 3 accounts executing simultaneously  
✅ Money actually moving

**Next: Scale it, add features, make revenue.**

🚀
