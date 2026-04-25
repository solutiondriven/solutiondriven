// exchanges/forexAdapter.js
const WebSocket = require("ws");

class ForexAdapter {
  constructor() {
    this.ws = null;
    this.listeners = [];
  }

  connect() {
    this.ws = new WebSocket("wss://example-forex-provider/ws", {
      headers: { Authorization: "Bearer YOUR_API_KEY" },
    });

    this.ws.on("open", () => {
      console.log("ForexAdapter connected");
      this.ws.send(JSON.stringify({ type: "subscribe", pairs: ["EURUSD","GBPUSD"] }));
    });

    this.ws.on("message", (msg) => {
      const data = JSON.parse(msg);
      this.listeners.forEach(cb => cb({ symbol: data.pair, price: parseFloat(data.price) }));
    });

    this.ws.on("close", () => console.log("ForexAdapter disconnected"));
  }

  onTick(callback) {
    this.listeners.push(callback);
  }
}

module.exports = ForexAdapter;
