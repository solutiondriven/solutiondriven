# ⚡ THIS WEEK ACTION ITEMS

**What to do RIGHT NOW (Next 5 Days)**

---

## 📋 Checklist (Copy-Paste & Check Off)

### TODAY (April 5)

- [ ] Read `COPY_TRADING_HUB.md` (30 min) ← Start here
- [ ] Read `CLEANUP_AND_ACTION_PLAN.md` (20 min)
- [ ] Backup your repo: `git commit -m "backup"`

### TOMORROW (April 6)

- [ ] **Create `api/services/binance_bridge.py`**
  - Copy code from COPY_TRADING_HUB.md section "Binance Bridge"
  - 300 lines, complete
  - Install SDK: `pip install python-binance`

- [ ] **Create `api/services/bitget_bridge.py`**
  - Copy code from COPY_TRADING_HUB.md section "Bitget Bridge"
  - 300 lines, complete
  - Install SDK: `pip install bitget-api`

### APRIL 7

- [ ] **Create `api/services/copy_trading_engine.py`**
  - Core logic: broadcast_signal, close_signal, sync_sl_tp
  - 200 lines, complete
  - Test: Can it import all 3 bridges?

- [ ] **Update `api/requirements.txt`**
  ```
  MetaTrader5==5.0.45
  python-binance==1.0.17
  bitget==0.0.5
  python-dotenv==1.0.0
  requests==2.31.0
  ```

### APRIL 8

- [ ] **Update `api/server.js`**
  - Add 6 endpoints for copy-trading
  - Keep existing endpoints
  - Test locally: `npm run dev`

- [ ] **Create `config/brokers.js`**
  - MT5 servers list
  - Binance config
  - Bitget config
  - 50 lines, simple

### APRIL 9

- [ ] **Create database models** (optional for MVP)
  - `models/Signal.js`
  - `models/Follower.js`
  - `models/Trade.js`
  - Or just use JSON files

- [ ] **Update `package.json`**
  - Update version to 3.0.0
  - Add sqlite3 dependency (for trades DB)
  - Use scripts from CLEANUP_AND_ACTION_PLAN.md

---

## 🔧 Code to Copy-Paste RIGHT NOW

### 1. Install Dependencies (Run These Today)

```bash
cd Micromax
pip install python-binance bitget-api MetaTrader5 python-dotenv requests
npm install sqlite3
```

### 2. Update `api/requirements.txt`

```
MetaTrader5==5.0.45
python-binance==1.0.17
bitget==0.0.5
python-dotenv==1.0.0
requests==2.31.0
sqlite3
```

### 3. Create `.env` for Testing (Copy from `.env.example`)

```bash
# Tomorrow, create your .env:
cp .env.example .env

# Edit with your real credentials:
MASTER_BROKER=MT5
MT5_ACCOUNT=YOUR_ACCOUNT
MT5_PASSWORD=YOUR_PASSWORD
MT5_SERVER=Exness-Demo

DATABASE_URL=sqlite:///./trades.db
ACTIVE_STRATEGY=TemiStrategy
RISK_PER_TRADE=0.02
MAX_POSITIONS=5

PORT=3000
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173
```

---

## 👨‍💻 Coding Tasks (Exact Order)

### Step 1: Binance Bridge (April 6)

**File:** `api/services/binance_bridge.py`

Start with this skeleton:

```python
from binance.client import Client
import logging

logger = logging.getLogger(__name__)

class BinanceBridge:
    """Execute trades on Binance"""
    
    def __init__(self):
        self.client = None
    
    def connect(self, api_key, api_secret):
        """Connect with credentials"""
        try:
            self.client = Client(api_key, api_secret)
            self.client.get_account()  # Test connection
            logger.info("Binance connected")
            return True, "Connected"
        except Exception as e:
            logger.error(f"Binance connection failed: {e}")
            return False, str(e)
    
    def execute_order(self, order_data):
        """Execute a trade"""
        try:
            symbol = order_data['symbol']  # e.g., 'BTCUSDT'
            action = order_data['action']   # e.g., 'BUY'
            volume = order_data['volume']   # e.g., 0.01
            
            if action.upper() == 'BUY':
                order = self.client.order_market_buy(
                    symbol=symbol,
                    quantity=volume
                )
            else:
                order = self.client.order_market_sell(
                    symbol=symbol,
                    quantity=volume
                )
            
            logger.info(f"Order executed: {symbol} {action} {volume}")
            return order
        except Exception as e:
            logger.error(f"Order failed: {e}")
            return None
    
    def get_position(self, symbol):
        """Get open position"""
        try:
            open_orders = self.client.get_open_orders(symbol=symbol)
            return open_orders if open_orders else None
        except Exception as e:
            logger.error(f"Get position failed: {e}")
            return None
    
    def close_position(self, symbol, quantity):
        """Close position"""
        try:
            order = self.client.order_market_sell(symbol=symbol, quantity=quantity)
            logger.info(f"Position closed: {symbol}")
            return order
        except Exception as e:
            logger.error(f"Close failed: {e}")
            return None
```

**Then expand it with:**
- `modify_position(symbol, stop_loss, take_profit)` 
- `get_account_balance()`
- `get_open_positions()`

### Step 2: Bitget Bridge (April 6)

**File:** `api/services/bitget_bridge.py`

Same structure as Binance:

```python
# Similar to BinanceBridge but using Bitget API
# bitget-api library documentation:
# https://bitget-api.readthedocs.io/

from bitget import BitgetRestClient
import logging

logger = logging.getLogger(__name__)

class BitgetBridge:
    """Execute trades on Bitget"""
    
    def __init__(self):
        self.client = None
    
    def connect(self, api_key, api_secret, passphrase):
        try:
            self.client = BitgetRestClient(api_key, api_secret, passphrase)
            # Test connection
            self.client.get_account_info()
            logger.info("Bitget connected")
            return True, "Connected"
        except Exception as e:
            logger.error(f"Bitget connection failed: {e}")
            return False, str(e)
    
    # Implement same methods as BinanceBridge
    # execute_order, get_position, close_position, etc.
```

### Step 3: Copy-Trading Engine (April 7)

**File:** `api/services/copy_trading_engine.py`

```python
import logging
from mt5_bridge import MT5Bridge
from binance_bridge import BinanceBridge
from bitget_bridge import BitgetBridge

logger = logging.getLogger(__name__)

class CopyTradingEngine:
    """Core copy-trading logic"""
    
    def __init__(self):
        self.mt5 = MT5Bridge()
        self.binance = BinanceBridge()
        self.bitget = BitgetBridge()
        self.signals = {}       # Store signals
        self.followers = {}     # Store followers
    
    def add_follower(self, follower_config):
        """Register a new follower account"""
        broker = follower_config['broker']  # 'MT5', 'Binance', 'Bitget'
        
        if broker == 'MT5':
            self.mt5.connect(
                follower_config['account'],
                follower_config['password'],
                follower_config['server']
            )
        elif broker == 'Binance':
            self.binance.connect(
                follower_config['api_key'],
                follower_config['api_secret']
            )
        elif broker == 'Bitget':
            self.bitget.connect(
                follower_config['api_key'],
                follower_config['api_secret'],
                follower_config['passphrase']
            )
        
        follower_id = f"{broker}_{follower_config.get('account', follower_config.get('api_key'))}"
        self.followers[follower_id] = follower_config
        logger.info(f"Follower added: {follower_id}")
        return follower_id
    
    def broadcast_signal(self, signal):
        """Send signal to all followers"""
        signal_id = signal.get('id', f"sig_{len(self.signals)}")
        signal['status'] = 'broadcasted'
        signal['positions'] = []
        
        for follower_id, follower in self.followers.items():
            broker = follower['broker']
            
            # Execute on this follower
            result = None
            if broker == 'MT5':
                result = self.mt5.execute_order({'symbol': signal.get('symbol')})
            elif broker == 'Binance':
                result = self.binance.execute_order({'symbol': signal.get('symbol')})
            elif broker == 'Bitget':
                result = self.bitget.execute_order({'symbol': signal.get('symbol')})
            
            if result:
                signal['positions'].append({
                    'follower_id': follower_id,
                    'broker': broker,
                    'status': 'open',
                    'result': result
                })
        
        self.signals[signal_id] = signal
        logger.info(f"Signal {signal_id} broadcasted to {len(self.followers)} followers")
        return signal_id
    
    def close_signal(self, signal_id):
        """Close all positions for this signal"""
        signal = self.signals.get(signal_id)
        if not signal:
            return False
        
        for position in signal.get('positions', []):
            follower_id = position['follower_id']
            broker = position['broker']
            
            if broker == 'MT5':
                self.mt5.close_position(signal['symbol'])
            elif broker == 'Binance':
                self.binance.close_position(signal['symbol'], position.get('quantity'))
            elif broker == 'Bitget':
                self.bitget.close_position(signal['symbol'], position.get('quantity'))
        
        signal['status'] = 'closed'
        logger.info(f"Signal {signal_id} closed on all followers")
        return True
```

---

## ✅ Success Check

### By End of April 6 (Day 2)

```bash
# Test this in Python terminal:
from api.services.binance_bridge import BinanceBridge
from api.services.bitget_bridge import BitgetBridge

binance = BinanceBridge()
print("Binance imported ✅")

bitget = BitgetBridge()
print("Bitget imported ✅")
```

### By End of April 7 (Day 3)

```bash
# Test this:
from api.services.copy_trading_engine import CopyTradingEngine

engine = CopyTradingEngine()
print("Copy-trading engine ready ✅")
```

### By End of April 8 (Day 4)

```bash
# Test API:
npm run dev

# In another terminal:
curl http://localhost:3000/api/health
# Should return: { "status": "ok" }
```

### By End of April 9 (Day 5)

```bash
# Should have:
✅ api/services/binance_bridge.py
✅ api/services/bitget_bridge.py
✅ api/services/copy_trading_engine.py
✅ config/brokers.js
✅ Updated package.json
✅ Updated .env.example
✅ Updated api/server.js (with 6 endpoints)
```

---

## 🎯 One Sentence Per Day

**April 6:** "Copy bridges working"  
**April 7:** "Engine broadcasting"  
**April 8:** "API endpoints ready"  
**April 9:** "First signal to follower"  

---

## Questions to Ask Yourself

1. ✅ Do I have Binance/Bitget test accounts?
   - If NO: Create them today
   - Get API keys (mark as spot trading only, no withdrawal)

2. ✅ Do I have my MT5 master account?
   - If NO: Create demo on Exness today

3. ✅ Can I read Python?
   - If NO: Copy code and run tests

4. ✅ Do I want this working by April 9?
   - If YES: Start NOW

---

## Most Important Thing

**Start TOMORROW with Binance bridge.**

Don't wait. Don't overthink. Copy the code. Run it. Test it.

You're 5 days away from a working copy-trading system.

Let's go. 🚀

