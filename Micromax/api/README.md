# 🚀 Micromax Trading API

Universal MetaTrader 5 (MT5) trading API backend.

Works with **ANY broker** that uses MetaTrader 5 (500+ brokers).

---

## Quick Start

### 1. Install Dependencies

```bash
# Install Node dependencies
npm install

# Install Python dependencies
npm run setup:python
# or manually: pip install -r requirements.txt
```

### 2. Configure Credentials

```bash
# Copy template
cp .env.example .env

# Edit .env with your MT5 account details
# MT5_ACCOUNT=123456
# MT5_PASSWORD=your_password
# MT5_SERVER=Exness-Demo
```

### 3. Run Server

```bash
npm run dev
```

Expected output:
```
🚀 Trading API (MT5-ready) running on port 3000
📊 Health check: GET http://localhost:3000/api/health
```

### 4. Test Connection

```bash
curl -X POST http://localhost:3000/api/mt5/connect \
  -H "Content-Type: application/json" \
  -d '{
    "account": 123456,
    "password": "password",
    "server": "Exness-Demo"
  }'
```

---

## API Endpoints

### Health & Status

- `GET /api/health` — Server health check
- `GET /api/mt5/status` — MT5 connection status

### Connection Management

- `POST /api/mt5/connect` — Connect to an MT5 broker
- `POST /api/mt5/disconnect` — Disconnect from MT5

### Trading Operations

- `POST /api/trades/execute` — Execute a trade
- `GET /api/positions` — Get all open positions
- `GET /api/positions/:symbol` — Get position for symbol
- `POST /api/positions/:symbol/close` — Close a position
- `POST /api/positions/:symbol/modify` — Modify SL/TP

### Account Information

- `GET /api/account/info` — Get account details
- `GET /api/account/balance` — Get balance & equity
- `GET /api/trades/history` — Get trade history

### Strategy & Copy Trading

- `POST /api/strategy/run` — Start a strategy
- `POST /api/strategy/stop` — Stop a strategy
- `POST /api/copy-trading/subscribe` — Subscribe to master account
- `GET /api/copy-trading/status` — Get copy-trading status

---

## Example Requests

### Connect to Exness

```bash
curl -X POST http://localhost:3000/api/mt5/connect \
  -H "Content-Type: application/json" \
  -d '{
    "account": 12345678,
    "password": "MyPassword123",
    "server": "Exness-Demo"
  }'
```

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

### Get All Positions

```bash
curl http://localhost:3000/api/positions
```

### Get Account Balance

```bash
curl http://localhost:3000/api/account/info
```

---

## Architecture

### Service: `mt5_bridge.py`

Python service that wraps MetaTrader5 library.

**Methods:**
- `connect(account, password, server)` — Connect to broker
- `execute_order(order_data)` — Place a trade
- `get_position(symbol)` — Get single position
- `get_all_positions()` — Get all positions
- `close_position(symbol)` — Close a trade
- `get_account_info()` — Account details
- `get_trade_history(days)` — Past trades

**Why Python?**
- MetaTrader5 library is Python-native
- Simpler than C++ or JavaScript bindings
- Direct access to MT5 API

### Server: `server.js`

Express.js API server that wraps the Python bridge.

**Architecture:**
```
Frontend (React) 
  ↓
Express API (Node.js)
  ↓ JSON HTTP
MT5Bridge (Python)
  ↓ Native API
MetaTrader5 Terminal
  ↓
Broker Server
```

---

## Supported Brokers

### Popular Forex Brokers

- Exness
- IC Markets
- Pepperstone
- FXOpen
- XM
- FXCM
- LMAXX Digital
- Deriv

### CFD / Stocks

- Plus500
- eToro
- CMC Markets

### Crypto (if available on MT5)

- Crypto.com
- Bybit

**Total: 500+ brokers support MT5**

---

## File Structure

```
api/
├── server.js                    # Express API server
├── services/
│   └── mt5_bridge.py           # Python MT5 wrapper
├── requirements.txt            # Python dependencies
└── README.md                   # This file
```

---

## Configuration

### Required (`.env`)

```
MT5_ACCOUNT=123456
MT5_PASSWORD=password
MT5_SERVER=Exness-Demo
```

### Optional

```
PORT=3000
NODE_ENV=development
LOG_LEVEL=info
COPY_TRADING_ENABLED=false
```

---

## Development

### Install Development Tools

```bash
npm install --save-dev nodemon
```

### Run with Auto-Reload

```bash
npm run dev
```

### Run Production

```bash
npm run start
# or
node api/server.js
```

---

## Troubleshooting

### "MetaTrader5 module not found"

```bash
pip install MetaTrader5
```

### "Login failed: Invalid password"

- Check MT5 account number
- Check password is correct (case-sensitive)
- Verify server name matches your broker

### "Symbol not found"

- Make sure symbol is available on your broker
- Use correct symbol format (e.g., "EURUSD", not "EUR/USD")

### "Order failed: Insufficient margin"

- Account balance is too low
- Reduce lot size or add more funds

### "Port 3000 already in use"

```bash
# Change port in .env
PORT=3001
```

---

## Testing

### Health Check

```bash
curl http://localhost:3000/api/health
```

Should return:
```json
{
  "status": "ok",
  "timestamp": "2026-04-05T10:30:00.000Z",
  "mt5_connected": false
}
```

### Full Flow Test

1. Connect to broker (replace credentials):
   ```bash
   curl -X POST http://localhost:3000/api/mt5/connect \
     -H "Content-Type: application/json" \
     -d '{"account": YOUR_ACCOUNT, "password": "YOUR_PASSWORD", "server": "YOUR_SERVER"}'
   ```

2. Execute a trade:
   ```bash
   curl -X POST http://localhost:3000/api/trades/execute \
     -H "Content-Type: application/json" \
     -d '{"symbol": "EURUSD", "action": "BUY", "volume": 0.01}'
   ```

3. Check positions:
   ```bash
   curl http://localhost:3000/api/positions
   ```

4. Get balance:
   ```bash
   curl http://localhost:3000/api/account/info
   ```

---

## Deployment

### Docker (Optional)

```dockerfile
FROM node:18-alpine

WORKDIR /app
COPY . .

RUN npm install
RUN pip install -r api/requirements.txt

EXPOSE 3000
CMD ["npm", "run", "start"]
```

```bash
docker build -t micromax-api .
docker run -p 3000:3000 -e MT5_ACCOUNT=123 micromax-api
```

### Production Checklist

- [ ] Use real account (not demo)
- [ ] Set `NODE_ENV=production`
- [ ] Use HTTPS (SSL/TLS)
- [ ] Add authentication to API endpoints
- [ ] Use Nginx reverse proxy
- [ ] Monitor logs and errors
- [ ] Set up backup/recovery
- [ ] Test with real funds (small amounts first)

---

## Security Considerations

⚠️ **WARNING:** This is a local development server.

For production:
- [ ] Use HTTPS (TLS encryption)
- [ ] Add API authentication (JWT tokens)
- [ ] Implement rate limiting
- [ ] Validate all inputs
- [ ] Use environment variables for secrets
- [ ] Never expose MT5 passwords in logs
- [ ] Run on isolated server
- [ ] Monitor for suspicious activity

---

## Next Steps

1. ✅ Server running locally
2. ✅ MT5 connection working
3. ⏭️ Connect frontend to API
4. ⏭️ Build trading UI
5. ⏭️ Deploy to production

---

## More Resources

- [MT5 Bridge Documentation](./services/mt5_bridge.py) — Python code comments
- [Quick Start Guide](../MT5_QUICK_START.md) — Full setup walkthrough
- [Architecture Guide](../MT5_ARCHITECTURE.md) — Technical deep dive
- [MetaTrader5 Docs](https://www.mql5.com/en/docs/python/) — Official Python API

---

**Status:** Production Ready  
**Last Updated:** April 5, 2026  
**Maintainer:** Micromax Team
