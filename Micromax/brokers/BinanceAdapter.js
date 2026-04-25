const WebSocket = require("ws");

class BinanceAdapter {
  constructor(symbols = []) {
    this.symbols = symbols.map(s => s.toLowerCase());
    this.tickers = {}; // store last price per symbol
    this.ws = null;
    this.onTickCallback = null;
  }

  connect() {
    // Binance streams multiple symbols via combined stream
    const streams = this.symbols.map(s => `${s}@trade`).join("/");
    const url = `wss://stream.binance.com:9443/stream?streams=${streams}`;
    this.ws = new WebSocket(url);

    this.ws.on("open", () => {
      console.log("✅ Binance WebSocket connected");
    });

    this.ws.on("message", data => {
      try {
        const parsed = JSON.parse(data);
        if (!parsed.data) return;
        const { s: symbol, p: price } = parsed.data; // s = symbol, p = price
        this.tickers[symbol.toLowerCase()] = parseFloat(price);

        if (this.onTickCallback) {
          this.onTickCallback({
            symbol: symbol.toLowerCase(),
            price: parseFloat(price),
            exchange: "binance"
          });
        }
      } catch (err) {
        console.error("Binance WS parse error:", err.message);
      }
    });

    this.ws.on("close", () => {
      console.log("⚠️ Binance WebSocket disconnected. Reconnecting in 5s...");
      setTimeout(() => this.connect(), 5000);
    });

    this.ws.on("error", err => {
      console.error("Binance WS error:", err.message);
      this.ws.close();
    });
  }

  onTick(callback) {
    this.onTickCallback = callback;
  }

  getCurrentPrice(symbol) {
    return this.tickers[symbol.toLowerCase()] || null;
  }

  close() {
    if (this.ws) this.ws.close();
  }
}

module.exports = BinanceAdapter;
