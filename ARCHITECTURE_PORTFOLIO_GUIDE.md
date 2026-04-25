# MICROMAX: Architecture Portfolio Guide
## Complete Repository Architecture, Runtime Boundaries, and Infrastructure Depth

**Created:** March 2026  
**Purpose:** Comprehensive portfolio and engineering reference for the Micromax repository  
**Audience:** Hiring managers, senior engineers, technical leads, startup founders, collaborators  
**Scope:** This guide documents every material layer present in this codebase: frontend, backend runtime, trading logic, broker and exchange adapters, cache behavior, screen-share backend, Supabase integrations, and infrastructure assets including Istio, Terraform, and the Go-based Kubernetes autoscaler.

---

## Executive Summary

The current repository contains three distinct architecture strata that need to be described separately and honestly.

1. **A shipped frontend trading workspace** in React/TypeScript/Vite with real authentication, AI assistant flows, chart embeds, notification settings, transcript handling, plan-aware gating, broker onboarding UI, and desktop-first screen capture behavior.
2. **A Node.js trading bot/runtime prototype** with live exchange tick ingestion, coin price caching, strategy execution hooks, and risk management logic.
3. **A distributed infrastructure foundation** with multi-region routing classes, Kubernetes/Istio zero-trust policies, a custom Go volatility autoscaler, and Terraform production topology for regional EKS clusters and service mesh deployment.

That means Micromax is not just a frontend mockup. It is also not a fully unified production trading backend. It is a mixed-stage system where some layers are operational, some are local-runtime prototypes, and some are architecture-forward infrastructure assets waiting for missing modules/services.

The most accurate portfolio description is:

> Micromax is an AI-assisted trading platform repository that combines a real desktop-oriented trading frontend, a Node-based market-data and strategy runtime, and a distributed multi-region infrastructure foundation for secure broker-aware backend evolution.

---

## Repository Topology

### Major roots

- `ARCHITECTURE_PORTFOLIO_GUIDE.md` - portfolio architecture source of truth
- `Micromax/` - main application and infrastructure repository root
- `Micromax/frontend/Trading Terminal Development/` - React frontend product
- `Micromax/core/` - shared backend logic such as risk management
- `Micromax/core/distributed/` - distributed routing, service discovery, and regional adapter abstractions
- `Micromax/exchanges/` - simple market data adapters for crypto and forex tick streams
- `Micromax/brokers/` - broker/exchange connectivity prototypes and simulator
- `Micromax/strategies/` - strategy definitions
- `Micromax/infrastructure/` - Terraform and Kubernetes/Istio assets
- `Micromax/cache/` and `Micromax/coins.json` - coin metadata and price cache storage
- `Micromax/screen_share_api.py` - FastAPI WebSocket backend for frame streaming and analysis

### Architectural split by execution model

- **Browser runtime:** React app, TradingView embed, Gemini API usage, screen capture, local persistence
- **Node runtime:** market-data bot, cache warming, trade generation, risk evaluation, WebSocket adapters
- **Python runtime:** frame-stream backend for screen-share analysis
- **Infra-as-code/config layer:** Terraform, Kubernetes, Istio policies, Go autoscaler controller

---

## System Status Matrix

| Layer | Status | What is real | What is incomplete or scaffolded |
| --- | --- | --- | --- |
| Frontend trading workspace | Real working product layer | Login flow, chart embed, AI assistant UI, billing/settings UI, broker onboarding UI, Telegram settings, transcripts | Still desktop-first, some integrations are client-side only |
| Supabase auth integration | Real working integration | Signup, signin, session restore, user fetch, local session storage | User typing and metadata mapping are inconsistent in code |
| Gemini AI integration | Real working integration | Direct browser calls to Gemini models with fallback sequence and rate limiting | API key is browser-exposed via Vite env, fallback is mock response |
| Screen-share frontend capture | Real working client feature | `getDisplayMedia`, ROI detection, frame diffing, WebSocket streaming | Best on desktop browsers only |
| Screen-share backend | Real prototype backend | FastAPI WebSocket ingest, async queue, broadcast stats, stub analysis | Uses simulated analysis instead of production vision inference |
| Node trading bot | Real code/runtime | CoinGecko cache, live crypto stream, forex stream contract, strategy trigger, risk checks | Not integrated with frontend product or persistent execution services |
| Broker adapters | Partial | Binance market data adapter and simulator exist | `metaapiAdapter.js` is empty; live broker execution stack is absent |
| Distributed routing layer | Real code-level architecture assets | multi-region router, service discovery, regional exchange adapter abstractions | Depends on services/endpoints that are not present in repo |
| Terraform/Istio infra | Real config assets | remote state config, regional providers, EKS topology, strict mTLS policy, authz rules | Referenced Terraform modules are missing, so repo is not self-contained for apply |
| Go volatility autoscaler | Real infrastructure component | custom Kubernetes controller code, deployment manifests, RBAC, metrics contract, scale-up/down policy | depends on in-cluster deployment plus volatility metrics endpoints that are not yet implemented in the Node services |
| Automated testing | Minimal | Jest is configured in root package | `tests/riskManager.test.js` is empty |

---

## Full Stack Inventory

## 1. Frontend Product Stack

### Runtime and build stack

From `Micromax/frontend/Trading Terminal Development/package.json`:

- React 18
- TypeScript
- Vite 6
- Tailwind CSS v4 tooling
- Radix UI primitives
- MUI packages
- `html2canvas`
- `lightweight-charts`
- `socket.io-client`
- motion/animation packages
- form and component utility libraries

### Application shell

Primary file:

- `Micromax/frontend/Trading Terminal Development/src/app/App.tsx`

What the shell does:

- boots the app and restores the user session on load
- mounts a TradingView chart widget dynamically from `https://s3.tradingview.com/tv.js`
- applies dark/light theme switching
- gates the main workspace behind authentication
- mounts the floating AI assistant only for authenticated users
- opens a right-hand dashboard/sidebar for user controls

### Main frontend surfaces

- `FloatingMicromax.tsx` - floating AI assistant and transcript workflow
- `RightSidebar.tsx` - account dashboard, broker connectivity, Telegram, calendar access
- `UserSettingsPage.tsx` - user settings and control surfaces
- `BillingPage.tsx` - plan presentation and usage gating UI
- `LoginModal.tsx` - auth entry flow
- `Header.tsx`, `Footer.tsx`, `EdgeSidebar.tsx` - chrome and navigation

### Architectural role

This frontend is the most product-complete part of the repository. It is the user-facing operating surface for Micromax.

---

## 2. Authentication and User State Layer

Primary implementation:

- `Micromax/frontend/Trading Terminal Development/src/app/services/supabaseAuth.ts`
- `Micromax/frontend/Trading Terminal Development/src/app/components/LoginModal.tsx`
- `Micromax/frontend/Trading Terminal Development/src/app/App.tsx`

### What is implemented

- Supabase Auth REST calls against `/signup`, `/token?grant_type=password`, and `/user`
- local session storage using `micromax_supabase_session`
- current-user restoration on app boot
- local persistence of user info and token expiry
- sign in, sign up, sign out, and current user fetch flows
- mapping of user metadata including full name, phone, and Telegram ID

### Important architectural notes

- Auth is executed client-side from the browser using the public anon key.
- Session state is stored in `localStorage`, not in secure HTTP-only cookies.
- The `AuthUser` type includes plan and usage counters, but `mapUser()` currently returns only a subset of those fields. This means the typing and runtime payload are not fully aligned.
- There is a duplicate `AuthRequestOptions` interface declaration in the file.

### Honest portfolio framing

> Micromax has a real Supabase authentication layer with local session restore and profile metadata handling, but it currently uses browser-managed session persistence rather than a hardened backend session broker.

---

## 3. AI Service Layer

Primary implementation:

- `Micromax/frontend/Trading Terminal Development/src/app/services/aiService.ts`

### What is implemented

- client-side chat orchestration for the Micromax assistant
- direct calls to Google Gemini from the browser when `VITE_GOOGLE_API_KEY` is present
- fallback model rotation across:
  - `gemini-2.5-flash`
  - `gemini-2.5-pro`
  - `gemini-2.0-flash`
  - `gemini-flash-latest`
  - `gemini-pro-latest`
- cached "last working model" persistence in `localStorage`
- client-side daily rate limiting using message and token counters
- mock response fallback when API calls fail

### Architectural consequences

- AI inference is usable today from the frontend.
- The integration is product-real, but the secret-handling model is not backend-hardened because the Gemini API key comes from the Vite runtime environment in the browser.
- Rate limiting is local to the browser session and can be reset by storage manipulation.

### What this layer is good for

- demonstrating productized AI UX
- showing multimodal assistant workflow design
- showcasing plan-aware user gating and resilient model fallback

### What it is not yet

- a server-governed inference gateway
- an audit-safe or abuse-resistant AI control plane

---

## 4. Screen Capture and Screen-Share Architecture

Frontend implementation:

- `Micromax/frontend/Trading Terminal Development/src/app/services/screenShareService.ts`

Backend implementation:

- `Micromax/screen_share_api.py`

### Frontend capture pipeline

The screen-share service implements this flow:

1. `navigator.mediaDevices.getDisplayMedia()` captures the user's screen.
2. A hidden video element renders the stream.
3. Canvas extraction reads frames.
4. Frame-diff logic compares the current frame to the previous frame.
5. ROI detection tries to isolate the chart region based on dark-pixel clustering.
6. Only changed frames, or periodic fallback frames, are sent over WebSocket.

### Backend processing pipeline

The FastAPI backend provides:

- WebSocket endpoint at `/ws/screen-share`
- in-memory connection manager
- bounded deque for recent frames
- async frame processing queue
- broadcast of frame analysis results and connection stats
- `/health`, `/stats`, and `/analyze-image` endpoints

### What is real

- end-to-end architecture exists for frame streaming
- backend queueing and broadcast behavior are implemented
- metrics such as frames received, processed, and average frame size are tracked

### What is still prototype-grade

- analysis is stubbed with synthetic output like `uptrend`, `support_level`, and `buy`
- no real production model invocation is wired in
- no auth, tenancy, or durable message retention exists on the FastAPI service

### Mobile limitation explanation

This is one of the reasons the product is desktop-first:

- `getDisplayMedia()` is inconsistent on mobile browsers
- fixed-position overlays and drag logic are mouse-oriented
- large-frame canvas analysis assumes desktop viewport geometry

---

## 5. Notifications and Telegram Layer

Primary implementation:

- `Micromax/frontend/Trading Terminal Development/src/app/components/RightSidebar.tsx`
- `Micromax/frontend/Trading Terminal Development/src/app/components/TelegramNotificationManager.tsx`
- `Micromax/frontend/Trading Terminal Development/src/app/services/telegramNotificationService.ts`

### What is implemented

- user-facing Telegram connect flow from the sidebar
- Telegram ID capture and verification UX
- local connection token storage with keys like `telegram_connection_token`
- helper methods for sending trade alerts, price alerts, status updates, error messages, and test notifications
- invocation pattern targeting a Supabase Edge Function endpoint at `/functions/v1/send-telegram-notification`

### Economic calendar architecture

`RightSidebar.tsx` also embeds or launches TradingView economic calendar experiences, replacing static placeholder news content with a real market data surface.

### Architectural reality

- notification and Telegram management is product-real at the UI/service layer
- delivery depends on an external Telegram bot path and Supabase function availability
- the notification service is integration-ready rather than fully self-sufficient within this repo

---

## 6. Billing, Plans, and Product Gating

Primary implementation:

- `Micromax/frontend/Trading Terminal Development/src/app/components/BillingPage.tsx`
- `Micromax/frontend/Trading Terminal Development/src/app/components/FloatingMicromax.tsx`

### What is implemented

- plan-tier presentation for Free, Pro, Elite, and Unlimited experiences
- plan-aware gating around AI-heavy actions such as chat, screenshots, and screen share
- usage counters surfaced inside the assistant workflow

### Architectural note

The repo treats plan enforcement primarily as a frontend experience plus user state concept. It is useful as product logic, but not yet hardened as a backend entitlement system.

---

## 7. Broker Onboarding and Account Management UI

Primary implementation:

- `Micromax/frontend/Trading Terminal Development/src/app/components/RightSidebar.tsx`

### What is implemented

- broker connection modal and forms
- per-user local persistence with keys like `micromax_brokers_<userId>`
- broker account save, list, and delete flows
- supported broker profile types:
  - MT5 Web
  - cTrader
  - Match-Trader
- capture of account ID, server name, and password/token

### Important boundary

This layer is real UX, but it is not yet a secure broker credential management platform.

What is missing in this repo:

- encrypted credential vaulting
- secure token exchange with broker APIs
- live account sync
- position synchronization
- order execution reconciliation

### Honest portfolio framing

> Micromax includes a real broker onboarding dashboard for multiple broker profiles, but the current repository stops at client-side account/profile management and does not yet contain the secure execution backend those forms would ultimately feed.

---

## 8. Node Trading Bot Runtime

Primary implementation:

- `Micromax/index.js`

### What this runtime does

The root Node entrypoint is a local trading/runtime bot that:

- loads cached coin metadata and prices from `Micromax/coins.json`
- queries CoinGecko for full coin lists and live prices
- warms a local disk cache in background batches
- accepts a CLI symbol input like `eth` or `eurusd`
- feeds ticks into `TemiStrategy`
- immediately evaluates resulting trades through `RiskManager`
- subscribes to live crypto and forex tick streams through adapters

### Main runtime dependencies

From the root `Micromax/package.json`:

- `axios`
- `dotenv`
- `winston`
- `ws`
- `jest` as a dev dependency

### Architectural meaning

This is the clearest backend/runtime implementation in the repo, even though it is not yet an API server. It represents a local event loop for ingesting market prices, generating trade intents, and evaluating risk logic.

---

## 9. Cache and Coin Data Layer

Primary implementation:

- `Micromax/index.js`
- `Micromax/coins.json`
- `Micromax/cache/coins.json`

### Cache behavior

The Node runtime uses a 30-minute cache window and stores:

- known coin IDs and symbols
- cached USD prices
- timestamp of last refresh
- last processed batch index for incremental background warming

### Files and their roles

- `Micromax/coins.json` currently contains a populated CoinGecko-style coin inventory and price cache data
- `Micromax/cache/coins.json` is an empty structured cache scaffold with `coins`, `prices`, `lastBatchIndex`, and `timestamp`

### Why this matters

This repository does include a backend cache concept, not just frontend state. It is a disk-backed market-data cache that reduces repeated discovery calls and supports batched refresh.

### Limitations

- local-file cache only
- no Redis or distributed cache
- no TTL invalidation beyond timestamp checks in process
- no cache coordination across services

---

## 10. Strategy Layer

Primary implementation:

- `Micromax/strategies/TemiStrategy.js`
- `Micromax/strategies/AlphaStrategy.js`
- `Micromax/strategies/BetaStrategy.js`

### Confirmed implemented behavior

`TemiStrategy.js` is the strategy actively referenced by the Node runtime. It:

- reacts to ticks for `ETH` and `EURUSD`
- creates a `BUY` order object
- sets a fixed stop loss one unit below price
- sets a fixed take profit two units above price
- marks break-even state as `false` initially

### Architectural role

The strategy layer is simple, but it demonstrates the event boundary where market data becomes a trade decision.

### Limitation

The distributed integration example references richer strategy/risk APIs like `strategy.analyze()` and `riskManager.checkRisk()`, but those methods do not exist in the implemented local classes. That means the distributed demo is architecture-forward and not fully aligned with the current strategy code.

---

## 11. Risk Management Layer

Primary implementation:

- `Micromax/core/riskManager.js`

### What is implemented

The current risk manager evaluates an open trade against current price and performs two controls:

- moves stop loss to break-even when price reaches 50% progress toward take profit
- force-closes a trade when price moves 50% beyond stop loss distance

### Architectural meaning

This is a concrete risk-control algorithm already present in code, not just a roadmap item.

### Current gaps

- no portfolio-level exposure model
- no max drawdown enforcement
- no position sizing engine
- no asynchronous approval workflow
- no persistence or audit trail
- empty test file despite Jest being installed

---

## 12. Exchange Adapters

Primary implementations:

- `Micromax/exchanges/CryptoAdapter.js`
- `Micromax/exchanges/ForexAdapter.js`
- `Micromax/brokers/BinanceAdapter.js`

### CryptoAdapter

- connects to Binance WebSocket trade stream for `ethusdt@trade`
- emits normalized ticks in the form `{ symbol: 'ETH', price }`

### ForexAdapter

- opens a WebSocket to a placeholder provider URL: `wss://example-forex-provider/ws`
- subscribes to `EURUSD` and `GBPUSD`
- emits normalized `{ symbol: pair, price }` ticks

### BinanceAdapter

- supports multiple symbols through Binance combined trade streams
- maintains an in-memory ticker map for current prices
- reconnects automatically after disconnect
- provides a callback-based `onTick()` interface

### Architectural interpretation

These files prove the repo does contain backend market-data integration work. The maturity level varies:

- Binance connectivity is concrete and usable
- forex connectivity is contract/prototype quality because the endpoint and token are placeholders

---

## 13. Broker Runtime Layer

Primary implementations:

- `Micromax/brokers/simulator.js`
- `Micromax/brokers/metaapiAdapter.js`

### Simulator

The simulator provides:

- tick handler registration
- synthetic tick emission
- order creation
- open trade retrieval
- stop loss modification
- trade closing

This is useful as a local execution sandbox.

### MetaAPI adapter state

- `metaapiAdapter.js` exists but is empty

### Architectural implication

The repo does have a broker-layer directory, but it is not uniformly implemented. The most honest guide should say that live broker execution infrastructure is only partially started.

---

## 14. Distributed Systems Layer

Primary implementations:

- `Micromax/core/distributed/MultiRegionRouter.js`
- `Micromax/core/distributed/RegionalExchangeAdapter.js`
- `Micromax/core/distributed/ServiceDiscovery.js`
- `Micromax/core/distributed/integration-example.js`

### MultiRegionRouter

Implements:

- regional endpoint registry for primary, Europe, and APAC
- exchange-to-region relevance mapping
- latency-aware region selection
- request metrics per region
- retries and failover
- circuit breaker state and recovery timers
- health check loop and monitoring events

### RegionalExchangeAdapter

Implements abstractions for:

- market-data ingestion routed through regional clusters
- order execution through regional infrastructure
- order cancellation
- position and balance retrieval
- payload signing using HMAC SHA-256
- validation of market data and order shape
- adapter metrics collection

### ServiceDiscovery

Implements:

- Kubernetes DNS resolution for services like `<service>.<namespace>.svc.cluster.local`
- endpoint caching
- health-aware endpoint selection
- generated VirtualService and DestinationRule style config objects
- generated AuthorizationPolicy objects for zero-trust service-to-service access

### Integration example

The example demonstrates intended orchestration among router, service discovery, regional adapters, risk manager, and strategy.

### Critical honesty point

This layer is rich in architectural code, but it targets services such as `strategy-service`, `execution-service`, `risk-manager`, and `data-ingestion` that are not implemented elsewhere in this repo. It is therefore a serious distributed-systems foundation, not a complete runnable backend platform.

---

## 15. Infrastructure Layer: Terraform

Primary files:

- `Micromax/infrastructure/terraform/live/prod/backend.tf`
- `Micromax/infrastructure/terraform/live/prod/providers.tf`
- `Micromax/infrastructure/terraform/live/prod/main.tf`
- `Micromax/infrastructure/terraform/live/prod/variables.tf`
- `Micromax/infrastructure/terraform/live/prod/outputs.tf`

### What is defined

#### Remote state

- S3 backend bucket: `micromax-terraform-state`
- state key: `micromax/prod/terraform.tfstate`
- server-side encryption enabled
- DynamoDB state locking table: `terraform-locks`

#### Multi-region providers

- AWS primary region: `us-east-1`
- AWS Europe region: `eu-west-1`
- AWS APAC region: `ap-southeast-1`
- region-specific Kubernetes and Helm providers

#### Production topology

- EKS cluster module calls for primary, Europe, and APAC
- per-region service mesh module calls
- kubeconfig setup via `aws eks update-kubeconfig`
- observability-related flags for Prometheus and Jaeger
- VPC flow logs and 90-day retention support
- compute-optimized default worker instance types: `c6i.2xlarge`, `c6i.4xlarge`

#### Outputs

- cluster endpoints and names for each region
- Terraform state bucket output
- regional service mesh endpoint mapping

### Important caveat

`main.tf` references modules at `../modules/eks` and `../modules/service-mesh`, but those module directories are not present in this repository. That means the Terraform layer expresses intended production topology, but this checkout alone cannot be applied end to end without the missing modules.

---

## 16. Infrastructure Layer: Kubernetes, Istio, and Custom Autoscaling

Primary files:

- `Micromax/infrastructure/kubernetes/istio/mtls-policy.yaml` — zero-trust security policies
- `Micromax/infrastructure/kubernetes/autoscaler/volatility-scaler.yaml` — deployment manifests
- `Micromax/infrastructure/kubernetes/autoscaler/cmd/volatility-scaler/main.go` — Go controller entry point
- `Micromax/infrastructure/kubernetes/autoscaler/internal/scaler/controller.go` — scaling algorithm
- `Micromax/core/distributed/MultiRegionRouter.js` — intelligent multi-region request routing
- `Micromax/core/distributed/RegionalExchangeAdapter.js` — regional exchange integration
- `Micromax/core/distributed/ServiceDiscovery.js` — Kubernetes service resolution

---

### 16.1 Custom Go-Based Kubernetes Autoscaler (The "Volatility Scaler")

#### Why it exists

The default Kubernetes Horizontal Pod Autoscaler (HPA) only reacts to CPU and memory metrics, which is far too slow for extreme market-data bursts during high volatility (FOMC prints, liquidation cascades, flash crashes). The volatility scaler reacts to **trading pressure signals** instead:

- Redis Pub/Sub message queue depth
- processing backlog in milliseconds
- WebSocket latency (p95)

This allows the system to scale **before** performance degradation reaches users.

#### Architecture

##### Go module and build

- Language: Go 1.22
- Dependencies: `k8s.io/api`, `k8s.io/apimachinery`, `k8s.io/client-go` (Kubernetes SDK)
- Docker base: `golang:1.22-alpine` for build, `distroless/static-debian12` for runtime (minimal footprint)
- Binary: Static-linked, ~5MB resulting image

##### Main controller loop (`cmd/volatility-scaler/main.go`)

```go
func main() {
    ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
    defer stop()

    cfg, err := config.FromEnv()  // Load all tuning knobs from ConfigMap
    metricsClient := metrics.NewHTTPClient(cfg.MetricsEndpoints, cfg.MetricsTimeout)
    controller, err := scaler.NewController(cfg, metricsClient)
    
    controller.Run(ctx)  // Infinite reconciliation loop
}
```

The controller:
- loads configuration from environment (ConfigMap-injected)
- creates Kubernetes client from in-cluster config
- initializes an HTTP metrics client targeting signal-processor and trade-executor endpoints
- enters reconciliation loop to continuously monitor and scale

##### Scaling algorithm (`internal/scaler/controller.go`)

The controller runs a **reconciliation loop** every `POLL_INTERVAL` (default 5 seconds):

1. **Collect metrics** from all configured endpoints
   - Expected JSON payload: `{ redisPubSubDepth, processingBacklogMs, websocketLatencyP95Ms, messagesPerSecond, capturedAt }`

2. **Summarize** by taking the worst observed value across all endpoints
   - `QueueDepth = max(all depth values)`
   - `ProcessingBacklog = max(all backlog values)`
   - `WebsocketLatency95 = max(all latency values)`

3. **Fetch current deployment** state from Kubernetes API
   - Target: `micromax/regional-exchange-adapter` deployment

4. **Calculate desired replicas** based on pressure signals:
   
   ```go
   overloaded = QueueDepth >= 2000 ||
                ProcessingBacklog >= 10ms ||
                WebsocketLatency95 >= 15ms
   ```

   If overloaded:
   - Set `healthySince = now`
   - Calculate scale-up magnitude based on how far metrics exceed thresholds
   - Apply SCALE_UP_COOLDOWN (15s) to prevent thrashing
   - Clamp desired replicas to [MIN_REPLICAS=3, MAX_REPLICAS=30]

   If healthy:
   - Wait for STABILIZATION_WINDOW (30s) to confirm stability
   - Apply SCALE_DOWN_COOLDOWN (90s) before reducing capacity
   - Decrement replicas by SCALE_DOWN_STEP (1) per reconciliation

5. **Update deployment** if desired != current via Kubernetes API

6. **Log the decision** with full metrics context for observability

#### Metrics contract

Each endpoint (`signal-processor` and `trade-executor`) must expose a JSON metrics endpoint returning:

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

#### Deployment manifest and RBAC

The `volatility-scaler.yaml` file defines:

- **ServiceAccount**: `volatility-scaler` in `micromax` namespace
- **Role**: allows `get`, `list`, `watch`, `update`, `patch` on `Deployment` resources
- **RoleBinding**: grants the role to the service account
- **ConfigMap**: all tuning parameters as environment variables:
  - `TARGET_NAMESPACE=micromax`
  - `TARGET_DEPLOYMENT=regional-exchange-adapter`
  - `POLL_INTERVAL=5s`
  - `METRICS_TIMEOUT=1500ms`
  - `METRICS_ENDPOINTS=http://signal-processor.micromax.svc.cluster.local:8080/internal/volatility,http://trade-executor.micromax.svc.cluster.local:8080/internal/volatility`
  - `MIN_REPLICAS=3`, `MAX_REPLICAS=30`
  - `QUEUE_DEPTH_THRESHOLD=2000`, `PROCESSING_TARGET_MS=10`, `WEBSOCKET_LATENCY_TARGET_MS=15`
  - `SCALE_UP_STEP=4`, `SCALE_DOWN_STEP=1`
  - `SCALE_UP_COOLDOWN=15s`, `SCALE_DOWN_COOLDOWN=90s`
  - `STABILIZATION_WINDOW=30s`
- **Deployment**: 1 replica of the controller itself
  - runs as `65532:65532` (unprivileged user)
  - injected with Istio sidecar for mTLS compliance

#### Portfolio significance

This is not theoretical infrastructure. The Go code demonstrates:
- in-cluster Kubernetes API usage
- stateful, long-running control-plane logic
- sophisticated cooldown and stabilization state management
- native goroutines for concurrent metric collection
- production-grade error handling and resource constraints

---

### 16.2 Service Mesh & Zero-Trust Security (Istio)

Primary file: `Micromax/infrastructure/kubernetes/istio/mtls-policy.yaml`

#### What is defined

##### Cluster-wide mTLS enforcement

```yaml
apiVersion: security.istio.io/v1beta1
kind: PeerAuthentication
metadata:
  name: default
  namespace: istio-system
spec:
  mtls:
    mode: STRICT
```

- **STRICT mode**: all traffic between pods must use mTLS
- applies cluster-wide to all namespaces
- enforces mutual Transport Layer Security at the mesh level
- rejections of non-mTLS traffic by default

##### Namespace-level mTLS for micromax services

```yaml
apiVersion: security.istio.io/v1beta1
kind: PeerAuthentication
metadata:
  name: micromax-mtls
  namespace: micromax
spec:
  mtls:
    mode: STRICT
```

Ensures all inter-service communication in the `micromax` namespace uses encrypted, authenticated channels.

##### JWT request authentication

```yaml
apiVersion: security.istio.io/v1beta1
kind: RequestAuthentication
metadata:
  name: micromax-jwt-auth
  namespace: micromax
spec:
  jwtRules:
  - issuer: "https://auth.micromax.local"
    jwksUri: "https://auth.micromax.local/.well-known/jwks.json"
    audiences: "micromax-services"
    forwardOriginalToken: true
  - issuer: "https://external-partner.com"
    jwksUri: "https://external-partner.com/.well-known/jwks.json"
    audiences: "external-integrations"
```

- validates JWT tokens for service-to-service communication
- supports multiple issuers (internal + external partners)
- validates against published JWKS endpoints
- forwards original token in request headers for downstream use

##### Authorization policies (service allowlists)

```yaml
apiVersion: security.istio.io/v1beta1
kind: AuthorizationPolicy
metadata:
  name: <service-name>
spec:
  rules:
  - from:
    - source:
        principals: ["cluster.local/ns/micromax/sa/<source-service>"]
    to:
    - operation:
        methods: ["POST"]
        paths: ["/api/v1/*"]
```

Allowlisted service communication:
- `signal-aggregator` and `broker-router` → `strategy-service` (signals must be processed by strategy evaluation)
- `broker-router` and `risk-manager` → `execution-service` (only authorized risk/broker services trigger execution)
- regional Binance adapters → `data-ingestion` (market data flows only to data layer)

##### Default-deny posture

```yaml
apiVersion: security.istio.io/v1beta1
kind: AuthorizationPolicy
metadata:
  name: default-deny
  namespace: micromax
spec: {}
```

Empty spec = deny all traffic by default. All communication must be explicitly allowlisted above.

##### Observability pass-through

Prometheus and monitoring systems retain access to metrics port `8080` for scraping without breaking mTLS.

#### Architectural significance

This is **zero-trust security at runtime**:
- no service can call any other service without cryptographically verified identity
- all traffic is encrypted in transit
- service-to-service calls require valid JWT tokens
- every communication path is auditable

This approach is used by Google, Netflix, Uber, and other hyperscale platforms because it prevents lateral movement and insider threats.

---

### 16.3 Multi-Region Edge Routing and Regional Adapters

#### Multi-Region Router (`core/distributed/MultiRegionRouter.js`)

##### Regional configuration

The router maintains three regional endpoints, each tied to exchange proximity:

```javascript
this.regions = {
  primary: {
    name: 'us-east-1',
    endpoint: 'https://primary.micromax.local',
    exchanges: ['NYSE', 'NASDAQ', 'BITMEX', 'BINANCE_US'],
    avgLatency: 0,
    healthStatus: 'healthy'
  },
  europe: {
    name: 'eu-west-1',
    endpoint: 'https://europe.micromax.local',
    exchanges: ['LSE', 'EUREX', 'BINANCE_EU', 'CRYPTO_EXCHANGES'],
    avgLatency: 0,
    healthStatus: 'healthy'
  },
  apac: {
    name: 'ap-southeast-1',
    endpoint: 'https://apac.micromax.local',
    exchanges: ['NSE', 'BINANCE_APAC', 'CRYPTO_ASIA', 'NIKKEI'],
    avgLatency: 0,
    healthStatus: 'healthy'
  }
};
```

##### Intelligent routing logic

When a request arrives (e.g., `route('BINANCE_US', '/api/v1/trade', payload)`):

1. **Exchange lookup**: find which region serves that exchange
2. **Latency-aware selection**: if multiple regions serve the exchange, pick the one with lowest observed latency
3. **Health check**: skip unhealthy regions (failed health checks or circuit breaker open)
4. **Retry + failover**: retries up to `maxRetries` times (default 2), falling back to next-best region on failure

##### Circuit breaker integration

```javascript
this.circuitBreakers = {
  primary: { open: false, failureCount: 0, successCount: 0 },
  europe: { open: false, failureCount: 0, successCount: 0 },
  apac: { open: false, failureCount: 0, successCount: 0 }
};
```

- tracks failure and success counts per region
- opens circuit when failure rate exceeds `circuitBreakerThreshold` (default 50%)
- automatically recovers after timeout
- prevents cascading failures by failing fast

##### Metrics and observability

Per-region tracking:
- `requestsPerRegion` — total request count per region
- `successPerRegion` — successful requests per region
- `failurePerRegion` — failed requests per region
- `latencyHistory` — rolling latency samples per region

Event emissions for monitoring:
- `request-success` — successful regional call with latency
- `request-failure` — failed request with error reason
- `circuit-breaker-open` — circuit opened for a region
- `region-healthy` / `region-unhealthy` — health state change

#### Regional Exchange Adapter (`core/distributed/RegionalExchangeAdapter.js`)

Each region runs an adapter instance responsible for:

##### Market data ingestion

```javascript
async ingestMarketData(ticker, marketData) {
  // 1. Validate data integrity
  if (!this.validateMarketData(marketData)) throw Error('Invalid format')
  
  // 2. Create signed signal
  const signal = {
    id: `${this.exchangeName}-${ticker}-${Date.now()}`,
    exchange: this.exchangeName,
    ticker,
    region: this.region,
    timestamp: new Date().toISOString(),
    data: marketData,
    signature: this.signSignal(marketData)  // HMAC-SHA256
  };
  
  // 3. Route through multi-region mesh to signal aggregator
  const response = await this.router.route(
    this.exchangeName,
    '/api/v1/signals/ingest',
    signal
  );
  
  this.metrics.signalsProcessed++;
  return { success: true, signalId: signal.id };
}
```

Features:
- validates market data shape before processing
- cryptographically signs every signal with HMAC-SHA256
- routes through service mesh (ensures mTLS/JWT compliance)
- tracks metrics: received, processed, failed signals

##### Trade execution

```javascript
async executeOrder(order) {
  // 1. Validate order structure
  if (!this.validateOrder(order)) throw Error('Invalid order format')
  
  // 2. Send through service mesh to execution endpoint
  const response = await this.router.route(
    this.exchangeName,
    '/api/v1/orders/execute',
    { ...order, signature: this.signSignal(order) }
  );
  
  return response.data;
}
```

- validates order shape
- applies cryptographic signature
- transmitted via service mesh (in-transit encryption + auth)

##### Regional isolation

Each region maintains:
- independent WebSocket connections to local exchanges
- regional metrics backend (separate signal-processor per region)
- local risk evaluation before execution
- per-region error tracking and circuit breaker state

This minimizes "time-to-market" (TTM) by allowing NY-region traders to hit US exchanges with sub-10ms latency instead of routing through Europe or Asia.

#### Kubernetes Service Discovery (`core/distributed/ServiceDiscovery.js`)

Resolves service endpoints using Kubernetes DNS:

```javascript
async resolveService(serviceName) {
  const fqdn = `${serviceName}.micromax.svc.cluster.local`;
  
  // Check cache first (30-second TTL)
  const cached = this.getCache(fqdn);
  if (cached) return cached;
  
  // Resolve via Kubernetes DNS
  const addresses = await dns.resolve4(fqdn);
  
  const endpoints = addresses.map(ip => ({
    ip,
    host: fqdn,
    port: 8000,
    healthy: true
  }));
  
  this.setCache(fqdn, endpoints);
  return endpoints;
}
```

Features:
- service names map to DNS: `<service>.<namespace>.svc.cluster.local`
- caches results for 30 seconds to reduce DNS load
- falls back to stale cache if resolution fails
- returns list of IPs for load balancing

#### Integration example

The `core/distributed/integration-example.js` demonstrates the full orchestration:

```javascript
const router = new MultiRegionRouter({ latencyThreshold: 50 });
const adapters = {
  primary: new RegionalExchangeAdapter('BINANCE_US', 'us-east-1', router),
  europe: new RegionalExchangeAdapter('BINANCE_EU', 'eu-west-1', router),
  apac: new RegionalExchangeAdapter('BINANCE_APAC', 'ap-southeast-1', router)
};

// Event monitoring
router.on('circuit-breaker-open', (event) => {
  console.error(`🔴 CIRCUIT BREAKER OPEN: ${event.region}`);
  console.error('Rerouting all signals away from this region...');
});

// Ingest market data through regional adapter
await adapters.primary.ingestMarketData('ETH', { price: 2500, volume: 100 });
```

#### Why this architecture matters

**The Speed of Light problem in trading:**
- Light travels ~5 milliseconds across the North American continent
- Being 100ms closer to an exchange can determine a winning vs losing trade
- Multi-region routing ensures each request hits the physically closest regional cluster
- Regional adapters maintain warm, persistent WebSocket connections to local exchanges
- Circuit breakers prevent one region's outage from affecting others

### Architectural significance

This section demonstrates:
- modern platform engineering patterns (circuit breakers, service discovery, regional failover)
- trading-specific optimizations (latency awareness, exchange-to-region mapping)
- cloud-native Kubernetes assumptions (DNS-based service resolution)
- production-grade observability (per-region metrics and event streams)

#### Honest portfolio framing

The distributed layer is rich in architectural code, but it targets Kubernetes-based services such as `strategy-service`, `execution-service`, `signal-processor`, and `data-ingestion` that are not yet implemented elsewhere in this repo. It is therefore a serious distributed-systems foundation waiting for the upstream services to be built.

---

## 17. Data, Secrets, and Persistence Boundaries

### Browser-side persistence

Used for:

- auth session storage
- cached working Gemini model
- AI rate limit counters
- broker connection profiles
- Telegram connection tokens
- transcripts and user workflow state in the assistant UI

### Local filesystem persistence

Used for:

- coin metadata and price cache (`coins.json`)
- root/runtime cache checkpointing

### Infrastructure-state persistence

Used for:

- Terraform remote state in S3 with DynamoDB locking

### Secret handling maturity by layer

- **Frontend AI key:** weak, browser-exposed via Vite env
- **Supabase anon key:** normal for public client usage
- **Broker secrets in UI:** weak, stored in client-side local persistence flow
- **Service mesh and JWT model:** strong on paper/config, but backend services are not all present

---

## 18. Architecture Diagram: Complete Repository View

```text
MICROMAX REPOSITORY
|
|-- Frontend Product (React + TypeScript + Vite)
|   |-- TradingView chart workspace
|   |-- Floating AI assistant
|   |-- Billing / settings / transcripts
|   |-- Broker onboarding UI
|   |-- Telegram + economic calendar surfaces
|   |-- Screen capture and WebSocket frame streaming
|
|-- Backend Runtime Prototype (Node.js)
|   |-- CLI bot entrypoint
|   |-- CoinGecko coin + price caching
|   |-- Strategy trigger layer
|   |-- Risk manager
|   |-- Crypto + forex WebSocket adapters
|   |-- Binance adapter + local simulator
|
|-- Screen Share Backend (FastAPI)
|   |-- WebSocket ingest
|   |-- Async frame queue
|   |-- Broadcast analysis + stats
|   |-- Health and image-analysis endpoints
|
|-- Distributed Backend Foundation
|   |-- MultiRegionRouter
|   |-- RegionalExchangeAdapter
|   |-- ServiceDiscovery
|   |-- Integration example for regional services
|
|-- Infrastructure
|   |-- Terraform prod topology
|   |   |-- S3 remote state + DynamoDB locking
|   |   |-- 3-region AWS provider setup
|   |   |-- EKS cluster topology
|   |   |-- Istio service-mesh deployment references
|   |
|   |-- Kubernetes / Istio security policy
|       |-- STRICT mTLS
|       |-- JWT request auth
|       |-- AuthorizationPolicy allowlists
|       |-- NetworkPolicy segmentation
|       |-- DestinationRule circuit breakers
```

---

## 19. What Is Actually Production-Ready vs Prototype vs Directional

## Production-real or close to product-real

- React trading workspace with TradingView integration
- Supabase auth flows with session restore
- Gemini-powered assistant with model fallback and rate limiting
- plan-aware UX gating and billing controls
- Telegram settings and notification surfaces
- broker onboarding dashboard UI
- screen-capture client architecture with frame diffing
- local Node runtime for coin lookup and live crypto ticks

## Prototype-grade but implemented

- FastAPI screen-share analysis service
- local coin cache warming and batched refresh
- simple risk manager logic (break-even, forced close)
- Temi strategy trigger logic
- Binance multi-symbol adapter
- simulator broker runtime
- multi-region router with intelligent exchange-to-region mapping
- regional adapter abstractions with payload signing
- Kubernetes service discovery with DNS caching
- circuit breaker pattern implementation

## Production-grade infrastructure components

- **Go Kubernetes autoscaler controller**: production-ready code with in-cluster API calls, stateful reconciliation, cooldown management, and container security hardening
- **Istio zero-trust security policies**: cluster-wide mTLS enforcement in STRICT mode, JWT-based request authentication, service authorization allowlists, default-deny posture
- **Multi-region AWS Terraform topology**: remote state management, three-region EKS and Istio provider setup, VPC flow logs, compute-optimized worker instances
- **Container image hardening**: distroless base image, unprivileged user context (uid 65532), static binary linking, minimal attack surface

## Directional / incomplete / missing dependencies

- secure broker execution backend
- credential vaulting for broker keys
- durable backend entitlement enforcement
- distributed portfolio state service
- missing Terraform modules for EKS and service mesh (referenced but not included)
- empty MetaAPI adapter
- empty risk manager test file
- distributed example methods that do not line up exactly with current strategy/risk implementations
- volatility scaler metrics endpoints not yet wired into Node signal-processor and trade-executor services

---

## 20. Strong Interview Positioning

### Best concise description

> Micromax is an AI-assisted trading platform repository with a real React trading terminal, a Node-based market-data and strategy runtime, a multi-region zero-trust infrastructure foundation, and a custom Go Kubernetes autoscaler for handling extreme market-volatility bursts.

### If asked what the frontend does

> I built the trading workspace, floating AI assistant, auth flow, plan-aware usage gating, Telegram and calendar controls, transcript handling, broker onboarding UI, and desktop screen-analysis workflow.

### If asked what backend work exists in the repo

> The repository contains a Node runtime for live market-data ingestion, disk-backed coin caching, strategy-triggered trade generation, and a risk manager. It also includes a FastAPI service for screen-share frame streaming, a multi-region router with intelligent exchange-to-region mapping, regional adapters with payload signing, and Kubernetes service discovery.

### If asked about infrastructure

> The infra layer includes a custom Go-based Kubernetes autoscaler that monitors Redis queue depth, processing latency, and WebSocket p95 metrics to scale the regional-exchange-adapter pods *before* system degradation. It also defines multi-region Terraform topology for EKS with remote state and locking.

> For security and observability, the codebase contains concrete Istio policies enforcing cluster-wide STRICT mTLS encryption, JWT-based request authentication with multiple issuer support, explicit service authorization allowlists, and a default-deny network posture. This implements zero-trust architecture used by hyperscale platforms like Google and Netflix.

> The Terraform references reusable modules that are not included in this checkout, so the design is concrete but not self-contained for end-to-end deployment.

---

## 21. Final Portfolio Position

Micromax should be presented as:

- a **real AI trading frontend product**
- a **backend/runtime prototype repository with actual market-data, strategy, risk, and caching code**
- an **infrastructure-forward distributed system foundation** with explicit multi-region routing, Kubernetes security policies, and a production-grade Go autoscaler

Micromax should not be presented as:

- frontend-only
- fully productionized broker execution infrastructure
- fully self-contained multi-region deployment code (Terraform modules are missing)
- a finished institutional trading platform

The strongest honest framing is that Micromax spans product, runtime, and infrastructure layers at different maturity levels. The platform engineering depth is real—including a custom control-plane controller, zero-trust security, and multi-region failover logic—but those layers are waiting for the upstream services (strategy-service, execution-service, data-ingestion) to be built.
