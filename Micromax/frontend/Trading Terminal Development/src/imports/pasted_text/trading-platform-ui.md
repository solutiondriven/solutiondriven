Design a premium, modern web-based trading platform UI inspired by MetaTrader and TradingView, but simplified into a clean, luxury B2C product.

🎯 CORE DESIGN PHILOSOPHY
Minimal, elegant, distraction-free
"Frosted glass" UI (like macOS / iOS panels)
Focus on the chart as the hero
AI integrated subtly, not overwhelming
🟦 LEFT SIDEBAR (Glass Panel)

Width: 240px (resizable, collapsible)

Style:

Frosted glass effect:
backdrop-blur-lg
bg-black/30 or bg-slate-900/30
border border-white/10
soft shadow

Sections:

Market Watch
Currency pairs list (EURUSD, GBPUSD, etc.)
Columns:
Symbol
Price
Change %
Smooth hover effects
Active pair highlighted with soft glow
Live updating feel
Navigator
Minimal expandable tree:
Accounts
Indicators
Strategies
Clean icons, no clutter
Drawing Tools (Vertical Icon Bar)
Floating or docked
Icons only:
Trendline
Fibonacci
Horizontal line
Rectangle
Active tool has glowing accent
🟩 MAIN CHART AREA (CENTER FOCUS)

This is the HERO of the product.

Layout:

Full width remaining space
No right sidebar (keep it clean)

Chart Container:

Slight frosted overlay frame
Rounded corners (rounded-2xl)
Subtle shadow

Top Tabs (Glass Style):

[ EURUSD ] [ GBPUSD ] [ XAUUSD ] [+]
Active tab:
brighter
subtle glow underline

Chart Features:

Candlestick chart (smooth, modern)
Soft grid (low opacity)
Right-side price scale
Bottom time scale

Top Floating Toolbar:

Timeframes: M1, M5, M15, H1, H4, D1
Indicators button
Drawing toggle
Settings icon

Everything should feel lightweight and floating.

🟥 BOTTOM PANEL (AI COPILOT — KEY FEATURE)

Height: 160–220px (resizable)

Style:

Frosted glass (same as sidebar)
Slight separation from chart (gap + shadow)

Tabs:

AI Copilot (default)
Trades
Alerts

AI Copilot UI:

Chat-based interface (clean bubbles)
AI messages:
subtle gray/blue glass bubbles
User messages:
slightly brighter tone

Behavior:

AI observes chart interactions
Responds intelligently:
Examples:
"You placed a Fibonacci retracement. Price is reacting near 61.8%."
"This aligns with your breakout strategy."
"Trendline suggests bullish continuation."

Input Field:

Rounded, glass style
Placeholder:
"Ask AI about your chart..."
🔐 LOGIN EXPERIENCE
Full-screen minimal login
Centered glass card
Fields:
Email
Password
CTA:
"Enter Trading Workspace"

After login:

Load user-specific:
Saved charts
Strategies
AI behavior profile
🎨 VISUAL DESIGN SYSTEM

Theme:

Dark mode only (premium feel)

Colors:

Background: gradient (very dark)
from #0b0f14 to #0e1117
Glass panels:
bg-black/30 or bg-slate-900/30
Borders:
border-white/10
Accent:
#3b82f6 (soft blue glow)
Bullish:
#22c55e
Bearish:
#ef4444

Effects:

backdrop-blur-lg everywhere (glass)
subtle shadows (shadow-xl, shadow-black/30)
smooth transitions (transition-all duration-200)

Typography:

Inter or SF Pro style
Medium weight for labels
Light for data
⚙️ INTERACTIONS
Panels are resizable (left + bottom)
Smooth hover + glow effects
Chart updates instantly on tab switch
Tabs can be added/closed
AI reacts in real-time to:
Drawn tools
Indicator changes
Timeframe switches
🧠 AI INTEGRATION (IMPORTANT UX)
AI should feel like a silent expert
No noisy alerts
Only contextual insights based on:
User strategy
Chart actions
Personalized per logged-in user
📦 COMPONENT STRUCTURE (React + Tailwind)
Sidebar.tsx (glass panel)
MarketWatch.tsx
DrawingTools.tsx
ChartTabs.tsx
ChartCanvas.tsx (TradingView Lightweight Charts)
TopToolbar.tsx
AICopilotPanel.tsx
LoginPage.tsx
🚀 GOAL

Create a visually stunning, luxury trading platform that feels like:

👉 TradingView + Apple Design + AI Copilot

Focus on:

Simplicity
Beauty
Performance
AI-enhanced trading experience

Avoid clutter. Every element must feel intentional.

Generate full UI layout with React + Tailwind components.