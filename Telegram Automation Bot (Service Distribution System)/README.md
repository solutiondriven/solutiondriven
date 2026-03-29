# 🤖 IMPULSE HUB: Production Telegram Platform

**Project Scope:** High-Throughput Automation & Payment Gateway  
**Infrastructure Model:** Stateless Webhook Architecture (Render + Supabase + Redis)  
**Live Access:** 🔗 [Start Micromax](https://t.me/Impulsehub_bot)

## 📖 System Overview
This repository documents a production-grade Telegram bot platform engineered for high-concurrency financial signal broadcasting. Operating on a **Stateless Webhook model**, the system is designed to handle thousands of concurrent users and real-time payment events without message loss, even during peak market volatility.

## 🏗️ Technical Implementation Patterns
This platform implements several advanced engineering patterns to ensure reliability and scale:

* **Distributed Task Orchestration:** Utilizes **BullMQ 2.0** and **Redis** to decouple the bot's response loop from long-running tasks. Signal broadcasting, subscription checks, and payment processing are offloaded to background workers to maintain a sub-200ms user response time.
* **Database Integrity & Logic:** Engineered with **Supabase (Postgres)** using strict referential integrity. I implemented custom database triggers for automated entity generation (e.g., unique Trader IDs like `TR001`) and real-time permission enforcement.
* **Production Deployment Flow:** The entire stack is containerized with **Docker (Node 20 Alpine)** and deployed via **Render Blueprints (IaC)**, ensuring a version-controlled, reproducible infrastructure environment.
* **Security & Auth Mesh:** Implemented **Supabase Service Role** authentication with custom middleware for Role-Based Access Control (RBAC). This manages tiered access for Admins, Traders, and Trial Users while enforcing real-time bans and subscription expirations.

## 🛠️ Detailed Technical Stack
| Category | Technology | Operational Function |
| :--- | :--- | :--- |
| **Runtime** | Node.js 20 (Alpine), TypeScript 5.0 | Type-safe, high-performance execution. |
| **Messaging** | Telegraf 4.12, Express.js | Stateless webhook handling and API health checks. |
| **Queueing** | **BullMQ 2.0, Redis (ioredis)** | Reliable asynchronous job processing and auto-retries. |
| **Storage** | Supabase (PostgreSQL) | Managed persistence with real-time auth and triggers. |
| **Gateways** | Flutterwave, Stripe, Paystack | Secure, webhook-validated payment processing. |

## 🚀 Scoped Operational Impact
* **Reliability:** Maintains a **live, 24/7 operational status** through automated health checks and persistent job state in Redis.
* **Scalability:** The stateless design allows for immediate horizontal scaling across Render instances during high-traffic signal events.
* **Delivery Velocity:** Features a fully automated signal broadcasting engine with **exponential backoff** to ensure delivery success across various global network conditions.

## 📡 Technical Walkthrough & Telemetry
> [!IMPORTANT]
> 🎥 **[Watch the Live Platform & Telemetry Walkthrough](https://drive.google.com/file/d/17a-VnRDUBmMwyLkf1AT61dI2goCEwjdH/view?usp=drive_link)**
>
> In this 3-minute video, I showcase:
> * **Live Bot Interaction:** Real-time signal creation and automated user subscription flow.
> * **BullMQ Monitoring:** Visualizing the background job queue and retry logic in a Redis dashboard.
> * **Database Logic:** Demonstrating Supabase triggers and the relational schema in action.

---
> [!TIP]
> **Explore the Full Control Plane:** 🔗 [solutiondriven.online](https://solutiondriven.online/projects/event-mesh)

## 🔒 Security & Source Access
To protect the security of live payment webhooks and private API keys, the primary source code remains in private repositories. 
**Technical walkthroughs or JIT (Just-In-Time) collaborator access can be provided to hiring leads upon request.**
