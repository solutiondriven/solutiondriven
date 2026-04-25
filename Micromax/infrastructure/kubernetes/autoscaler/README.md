# Volatility Scaler

This folder contains a custom Go-based Kubernetes autoscaler for Micromax's `RegionalExchangeAdapter` deployment.

## Why it exists

The default Horizontal Pod Autoscaler only reacts to CPU and memory. That is too slow for bursty market data during FOMC prints, liquidation cascades, or exchange-side microbursts.

The volatility scaler reacts to trading pressure indicators instead:

- Redis Pub/Sub backlog depth
- processing backlog in milliseconds
- WebSocket p95 latency

When any of those signals cross the configured thresholds, the controller scales `regional-exchange-adapter` before downstream throttling shows up as missed ticks or increased execution lag.

## Metrics contract

Each metrics endpoint must return JSON shaped like this:

```json
{
  "source": "signal-processor-us-east-1",
  "redisPubSubDepth": 2450,
  "processingBacklogMs": 14,
  "websocketLatencyP95Ms": 18,
  "messagesPerSecond": 12850.2,
  "capturedAt": "2026-03-29T14:05:00Z"
}
```

The controller takes the worst observed queue depth, backlog age, and latency across all configured endpoints, then applies cooldowns and a stabilization window to avoid flapping.

## Files

- `cmd/volatility-scaler/main.go`: controller entrypoint
- `internal/config/config.go`: environment-driven tuning knobs
- `internal/metrics/client.go`: HTTP collector for volatility snapshots
- `internal/scaler/controller.go`: scaling logic and Kubernetes deployment updates
- `volatility-scaler.yaml`: RBAC, config map, deployment, and service account

## Build

```bash
cd infrastructure/kubernetes/autoscaler
docker build -t micromax/volatility-scaler:latest .
```

## Deploy

```bash
kubectl apply -f infrastructure/kubernetes/autoscaler/volatility-scaler.yaml
```

## Key tuning defaults

- `PROCESSING_TARGET_MS=10`
- `WEBSOCKET_LATENCY_TARGET_MS=15`
- `QUEUE_DEPTH_THRESHOLD=2000`
- `MIN_REPLICAS=3`
- `MAX_REPLICAS=30`
- `SCALE_UP_STEP=4`
- `SCALE_DOWN_STEP=1`

These defaults are intentionally aggressive on scale-up and conservative on scale-down.
