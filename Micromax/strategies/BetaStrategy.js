// strategies/temiStrategy.js
module.exports = {
  name: "Temi Strategy",
  onTick(symbol, price) {
    // simple example: always BUY if price is even
    if(price % 2 === 0) {
      return {
        symbol,
        side: "BUY",
        stopLoss: price - 1,
        takeProfit: price + 2
      };
    }
    return null; // do nothing
  }
};
