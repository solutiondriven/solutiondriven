// strategies/TemiStrategy.js
module.exports = {
  onTick(tick, broker) {
    // Example: trade only ETH and EURUSD
    if (tick.symbol === "ETH" || tick.symbol === "EURUSD") {
      return {
        action: 'OPEN',
        symbol: tick.symbol,
        side: 'BUY',
        volume: 1,
        entryPrice: tick.price,
        stopLoss: tick.price - 1,
        takeProfit: tick.price + 2,
        breakEvenSet: false
      };
    }
    return null;
  }
};
