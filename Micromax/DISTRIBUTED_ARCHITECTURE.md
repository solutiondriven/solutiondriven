# Micromax Architectural Portfolio

## Overview

Micromax is a web-based AI trading workspace built around four product pillars:

1. AI-assisted chart analysis
2. Live trading workspace and user controls
3. Broker and notification connectivity
4. Secure distributed backend foundations

The platform combines a Vite/React frontend, Supabase-backed authentication and profile storage, Gemini-powered AI analysis, TradingView-driven charting and calendar embeds, and a broker-ready dashboard architecture that can be extended into live execution services.

---

## Current Product Capabilities

### 1. AI Trading Assistant

The floating Micromax assistant is the primary interaction layer for users.

Current features:

- Freeform AI chat for market and strategy questions
- One-click chart screenshot capture for AI analysis
- Live screen-share analysis mode for reviewing the active chart
- Voice input support where browser APIs are available
- Session transcript storage for later review

Frontend component:

- `frontend/Trading Terminal Development/src/app/components/FloatingMicromax.tsx`

Core service:

- `frontend/Trading Terminal Development/src/app/services/aiService.ts`

How it works:

1. The user opens the floating assistant.
2. The user sends text, voice, screenshot, or live-screen context.
3. The frontend packages the request.
4. Gemini vision or text models return analysis.
5. Results are shown in the assistant and can be archived as session transcripts.

---

### 2. Trading Workspace

The main trading workspace is designed around chart visibility, overlays, and account controls.

Key UI areas:

- Trading/chart viewport
- Floating assistant
- Right sidebar for profile, notifications, billing, and broker connectivity
- Settings and strategy management modals

Important components:

- `frontend/Trading Terminal Development/src/app/components/RightSidebar.tsx`
- `frontend/Trading Terminal Development/src/app/components/UserSettingsPage.tsx`
- `frontend/Trading Terminal Development/src/app/components/BillingPage.tsx`
- `frontend/Trading Terminal Development/src/app/components/EdgeSidebar.tsx`

---

### 3. Notifications and Market Calendar

Micromax supports user alert preferences and economic-calendar visibility inside the dashboard.

Current features:

- Telegram connection and ID management
- Calendar/news alert preferences
- Embedded live economic calendar widget

Important components:

- `frontend/Trading Terminal Development/src/app/components/TelegramNotificationManager.tsx`
- `frontend/Trading Terminal Development/src/app/components/RightSidebar.tsx`

Architecture notes:

- Telegram identity is tied to the authenticated user profile
- Notification preferences are managed in the client-side dashboard flow
- The economic calendar is embedded as a live widget rather than hardcoded event text

---

### 4. Billing, Plans, and Feature Gating

The product includes plan-aware usage controls across AI chat, screenshots, and screen-sharing workflows.

Current plans:

- Free
- Pro
- Elite
- Unlimited

Plan-aware controls currently influence:

- Daily AI message limits
- Screenshot usage limits
- Screen-share usage limits

Important component:

- `frontend/Trading Terminal Development/src/app/components/BillingPage.tsx`

Supporting behavior:

- Usage counters are shown in the assistant
- Certain actions are disabled when the current plan limit is reached

---

### 5. Broker Connectivity Layer

Micromax now includes a broker connection management layer in the sidebar experience.

Currently supported broker profiles:

- MT5 Web
- cTrader
- Match-Trader

Current implementation status:

- Broker connection modal exists in the frontend
- Users can save broker connection profiles per account/session
- Broker entries can be reviewed and removed from the dashboard

Important component:

- `frontend/Trading Terminal Development/src/app/components/RightSidebar.tsx`

Current architectural state:

- This is a broker onboarding and profile-management layer
- It is not yet a live order-routing or broker-execution backend
- The UI and account model are now prepared for deeper broker API integration

Future backend extension:

1. Broker adapter microservices
2. Secure credential vaulting
3. Token refresh and session maintenance
4. Position sync and account balance polling
5. Order execution and reconciliation

---

## Frontend Architecture

### Stack

- React
- TypeScript
- Vite
- Tailwind-style utility classes
- Browser-native media APIs

### Frontend Modules

#### Assistant Layer

- Floating chat and interaction shell
- Transcript and session handling
- Screenshot and live-screen analysis flows

#### Control Layer

- Settings
- Billing
- Notifications
- Broker connection management

#### Auth Layer

- Supabase session restore
- Profile loading
- Profile update workflows

#### Data Display Layer

- Chart viewport integration
- Economic calendar widget
- Plan and account surfaces

---

## Backend and Service Architecture

### Identity and User Data

Micromax uses Supabase-backed authentication and profile retrieval for:

- Session initialization
- Login and logout
- User plan lookup
- Telegram ID storage
- Profile metadata retrieval

### AI Service Layer

The AI service layer is responsible for:

- Text chat requests
- Screenshot analysis requests
- Vision-model fallback sequencing
- Token and message-rate limiting
- Error reporting for timeout and quota failures

### Broker-Ready Service Direction

The current product is frontend-heavy, but the architecture naturally extends into these backend services:

- Broker Router
- Broker Adapters
- Risk Manager
- Strategy Engine
- Execution Service
- Portfolio State Service
- Alert Dispatcher

---

## Distributed Systems Portfolio Story

Micromax is no longer just a concept for distributed infra; it is now a product with working user-facing surfaces that map cleanly onto a distributed trading platform.

### Present Layer

What is already present today:

- Working AI trading assistant
- Live chart screenshot analysis
- Screen-share analysis flow
- User plan enforcement
- Telegram and market-calendar surfaces
- Broker connection management UI
- Session transcript storage

### Distributed Layer

What the platform is architected to evolve into:

- Region-aware broker routing
- Broker-specific adapter services
- Event-driven notifications
- Position and execution synchronization
- Risk-policy enforcement between strategy and execution
- Secure service-to-service communication

---

## Security Direction

The current frontend product should be viewed alongside a security roadmap that includes:

- secure handling of broker credentials
- encrypted token storage
- role-aware service authorization
- isolated execution services
- auditable signal and order trails

For a fully distributed deployment, the recommended model remains:

- zero-trust service identity
- mTLS between services
- policy-based authorization
- environment-isolated broker execution paths

---

## Why Some Features Struggle on Mobile

The current implementation contains several desktop-first assumptions that explain why many features do not behave well on mobile browsers.

### 1. Screen Capture APIs Are Desktop-Biased

The assistant relies on browser APIs such as:

- `navigator.mediaDevices.getDisplayMedia()`
- `MediaRecorder`
- speech-recognition browser implementations

These APIs are inconsistent or limited on mobile browsers, especially on iPhone and many Android WebViews.

### 2. Dragging Uses Mouse-First Logic

The floating assistant container is positioned and moved with mouse-based drag handling.

Examples in the code:

- `onMouseDown`
- `clientX/clientY` drag math
- fixed screen coordinates

That works better on desktop than on touch-first devices.

### 3. Desktop-Centered Fixed Positioning

The assistant and modal system rely heavily on:

- fixed positioning
- viewport math from `window.innerWidth` and `window.innerHeight`
- desktop-width assumptions for offsets and overlays

This can cause clipping, overlap, or inaccessible controls on small screens.

### 4. Hover-Driven UX Exists in Key Areas

Some components still use hover-centered interaction styles and tooltip behavior, which do not translate well to touch devices.

### 5. Chart Capture Depends On Visible Screen Geometry

The screenshot flow calculates crop regions from the chart rectangle and desktop viewport dimensions. Mobile browser chrome, zooming, and embedded chart behavior can make those calculations unreliable.

### 6. Embedded Third-Party Content Has Mobile Constraints

TradingView embeds and related widget flows can behave differently on mobile and may impose restrictions on iframe/script usage, scrolling, and input focus.

---

## Mobile Stabilization Roadmap

To make the product truly mobile-ready, the next engineering steps should be:

1. Replace mouse-only dragging with pointer/touch-safe drag behavior.
2. Add a mobile-specific layout mode for the floating assistant.
3. Disable or gracefully degrade unsupported browser APIs on mobile.
4. Replace hover-only affordances with touch-friendly controls.
5. Add explicit mobile capture fallbacks instead of assuming desktop tab capture.
6. Test on Safari iOS and Chrome Android as first-class targets.

---

## Deployment Model

### Frontend Deployment

The frontend is bundled with Vite and deployed as static assets:

- `dist/index.html`
- `dist/assets/*`

This makes it suitable for:

- cPanel static hosting
- CDN-backed static hosting
- edge-delivered frontend deployments

### Environment Requirements

Production deployment should provide:

- Supabase environment variables
- Gemini API configuration
- stable HTTPS hosting for media/browser APIs

---

## Portfolio Summary

Micromax demonstrates a strong architectural narrative across product, frontend engineering, AI integration, and distributed-system direction.

It now includes:

- a working AI trading assistant
- screenshot and screen-share chart analysis
- transcript/session persistence
- billing and plan-aware feature gating
- Telegram and calendar integrations
- broker connection management for MT5 Web, cTrader, and Match-Trader

This makes the architectural portfolio much stronger because it no longer describes only backend theory; it now connects real user-facing product capabilities to the distributed trading system that Micromax is designed to become.
