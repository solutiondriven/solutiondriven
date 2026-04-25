// exchanges/cryptoAdapter.js
const WebSocket = require("ws");

class CryptoAdapter {
  constructor() {
    this.ws = null;
    this.listeners = [];
  }

  connect() {
    this.ws = new WebSocket("wss://stream.binance.com:9443/ws/ethusdt@trade");

    this.ws.on("open", () => console.log("CryptoAdapter connected"));

    this.ws.on("message", (msg) => {
      const data = JSON.parse(msg);
      this.listeners.forEach(cb => cb({
        symbol: "ETH",
        price: parseFloat(data.p)
      }));
    });

    this.ws.on("close", () => console.log("CryptoAdapter disconnected"));
  }

  onTick(callback) {
    this.listeners.push(callback);
  }
}

module.exports = CryptoAdapter;
