# 📈 MicroMax: Distributed AI Trading Terminal

**Project Scope:** High-Performance Execution & Infrastructure Foundation  
**Infrastructure Role:** Distributed System Runtime with Custom Go-Based Scaling  
**Live Access:** 🔗 [Quick Market Analyzer @ impulsehub.tech](https://impulsehub.tech/?section=micromax&i=1) and here [Login to Trade @ trading.impulsehub.tech](https://trading.impulsehub.tech/?i=1)

## 📖 System Overview
MicroMax is a professional-grade trading terminal engineered for sub-100ms signal processing and AI-assisted market analysis. Moving beyond a standard dashboard, this repository serves as the production-grade foundation for a **Distributed Infrastructure**, featuring a custom **Go-based Kubernetes controller** designed to handle the extreme volatility of global financial markets.

## 🏗️ Technical Architecture Patterns
This system implements enterprise-level infrastructure and platform engineering patterns:

* **Predictive Workload Scaling:** A custom **Kubernetes Controller written in Go** that monitors WebSocket message depth and market volatility to scale execution pods proactively, ensuring the system stays ahead of the data firehose.
* **Zero-Trust Service Mesh:** Full implementation of **Istio STRICT mTLS** to secure internal communication between trade-logic services and regional exchange adapters.
* **Resilient Data Ingress:** Multi-source persistent **WebSocket (WSS)** orchestration for Binance and CoinGecko with automated circuit-breaking and failover logic.
* **Multi-Region Edge Routing:** Architectural support for regional deployment (NY4/LD4) using Node.js routing classes to minimize physical distance to exchange matching engines.
* **AI-Augmented Observability:** Integration of **Gemini Vision** for real-time chart analysis, synchronized with **Prometheus/Grafana** telemetry to monitor system impact during high-frequency data bursts.

## 🛠️ The Comprehensive Tech Stack
| Layer | Technologies | Engineering Focus |
| :--- | :--- | :--- |
| **Infrastructure** | Kubernetes (EKS), Istio, Terraform | Multi-region orchestration and Zero-Trust networking. |
| **Custom Tooling** | **Go (Golang)** | Performance-critical Kubernetes Autoscaler logic. |
| **Runtime** | Node.js 20, TypeScript, Redis | High-concurrency trade execution and tick caching. |
| **Frontend/AI** | React 18, Vite 6, Gemini API | Sub-second UI updates and AI-driven chart insights. |
| **Analytics** | TradingView LWC, Recharts | Low-latency visualization of live market data. |

## 🚀 Operational Impact (Scoped)
* **Performance Optimization:** The custom Go-scaler delivers a **40% reduction in cold-start latency**, critical for capturing price movements during flash-volatility.
* **Network Security:** 100% of internal traffic is encrypted via identity-based auth, preventing signal spoofing or unauthorized execution.
* **Data Reliability:** Sub-millisecond data retrieval achieved through optimized Redis KV-store caching of live exchange ticks.

## 📡 Technical Walkthrough & Telemetry
> [!IMPORTANT]
> 🎥 **[Watch the Market Analyzer & Scaler Integration](https://drive.google.com/file/d/17a-VnRDUBmMwyLkf1AT61dI2goCEwjdH/view?usp=drive_link)**
>
> In this 3-minute walkthrough, I demonstrate:
> * **Predictive Signal Generation:** How technical indicators (RSI/ATR) trigger proactive infrastructure scaling.
> * **Service Mesh Security:** A live look at Istio mTLS enforcing traffic policies between services.
> * **Dashboard Correlation:** Viewing the React terminal side-by-side with **Grafana** infrastructure metrics.

---
> [!TIP]
> **View System Blueprints:** 🔗 [solutiondriven.online/kubernetes](https://solutiondriven.online/projects/autoscaler)

## 🔒 Source Access Note
Primary trade-execution algorithms, mTLS configurations, and private infrastructure modules are maintained in private repositories for security.
**Technical walkthroughs or JIT collaborator access can be provided upon request.**
