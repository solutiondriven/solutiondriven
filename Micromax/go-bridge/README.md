# Go MT5 Broadcast Worker

This sidecar adds the fast fan-out path that the current Node server is missing.

It does three things:

1. Accepts a trade signal over HTTP.
2. Pulls active followers for a master trader from Supabase.
3. Sends the signal to an MT5 bridge concurrently using goroutines.

It now also exposes Bitget broker helpers so you can provision sub-accounts and execute the same futures order across follower-owned Bitget API keys in parallel.

## Why this exists

`api/server-real.js` currently broadcasts in a sequential loop. This worker gives you a separate service that can fan out the same signal across many follower accounts in parallel.

## Expected follower schema

The worker reads from a Supabase table that returns rows shaped like this:

```json
{
  "id": "follower_001",
  "master_id": "master_alpha",
  "username": "victor",
  "account_id": "12345678",
  "login": "12345678",
  "password": "secret",
  "server": "Exness-MT5Real6",
  "bridge_account_id": "mt5-terminal-01",
  "volume_factor": 1.0,
  "active": true,
  "metadata": {
    "risk_profile": "balanced"
  }
}
```

Only `master_id`, `active`, and enough MT5 identity fields for your bridge are required. You can adjust the queried column names with env vars.

## Expected MT5 bridge contract

The worker posts each follower execution to:

`POST {MT5_BRIDGE_URL}{MT5_BRIDGE_PATH}`

Payload:

```json
{
  "follower_id": "follower_001",
  "account_id": "12345678",
  "login": "12345678",
  "password": "secret",
  "server": "Exness-MT5Real6",
  "bridge_account_id": "mt5-terminal-01",
  "trade": {
    "master_id": "master_alpha",
    "symbol": "EURUSD",
    "action": "BUY",
    "volume": 0.01,
    "stop_loss": 1.09,
    "take_profit": 1.11,
    "comment": "Impulse test"
  }
}
```

A successful bridge response should ideally return JSON with fields like:

```json
{
  "status": "FILLED",
  "order_id": "987654321"
}
```

## Setup

1. Install Go 1.22+ on your VPS or local machine.
2. Copy `.env.example` to `.env`.
3. Set your Supabase URL and service role key.
4. For MT5 fan-out, point `MT5_BRIDGE_URL` to your local MT5 WebSocket or REST bridge adapter.
5. For Bitget provisioning, set `BITGET_API_KEY`, `BITGET_SECRET_KEY`, and `BITGET_PASSPHRASE` to your broker master credentials.
6. Run:

```bash
go run .
```

The worker listens on `http://localhost:8081` by default.

## Bitget endpoints

### Create sub-account

`POST /bitget/subaccounts/create`

```json
{
  "subaccount_name": "impulse_victor@example.com",
  "label": "ImpulseHub_User"
}
```

### Create sub-account API key

`POST /bitget/subaccounts/apikeys/create`

```json
{
  "sub_uid": "123456789",
  "passphrase": "FollowerPass123",
  "label": "victor-live",
  "perm_type": "read_and_write",
  "perm_list": ["contract_order", "contract_position"],
  "ip_list": ["1.2.3.4"]
}
```

The response includes the sub-account `apiKey` and `secretKey`. Persist those in your followers table columns configured by:

- `SUPABASE_FOLLOWER_API_KEY_COLUMN`
- `SUPABASE_FOLLOWER_API_SECRET_COLUMN`
- `SUPABASE_FOLLOWER_PASSPHRASE_COLUMN`

### Fan out a Bitget futures order to followers

`POST /bitget/followers/execute`

```json
{
  "master_id": "victor_uid",
  "symbol": "BTCUSDT",
  "product_type": "USDT-FUTURES",
  "margin_mode": "crossed",
  "margin_coin": "USDT",
  "side": "buy",
  "trade_side": "open",
  "order_type": "market",
  "size": 0.01,
  "client_oid": "victor-btc-entry"
}
```

Each follower order uses that follower's own stored Bitget API credentials and applies `volume_factor` to the submitted `size`.

## Test request

Use `DRY_RUN=true` first so you can verify Supabase fan-out without placing real trades.

```bash
curl -X POST http://localhost:8081/signals/execute \
  -H "Content-Type: application/json" \
  -d '{
    "master_id": "master_alpha",
    "symbol": "EURUSD",
    "action": "BUY",
    "volume": 0.01,
    "stop_loss": 1.09,
    "take_profit": 1.11,
    "comment": "Impulse test"
  }'
```

## Suggested next integration

Once this worker is running, the Node API can forward `/api/signals/:id/broadcast` to this service instead of executing followers serially in-process.

## Bitget notes

- The sub-account and API key payloads in this worker follow Bitget's current official broker docs for `POST /api/v2/broker/account/create-subaccount` and `POST /api/v2/broker/manage/create-subaccount-apikey`.
- The order fan-out endpoint targets Bitget's current contract endpoint `POST /api/v2/mix/order/place-order`.
- Do not hardcode live credentials in source. Keep them in `.env` or your secret manager.
