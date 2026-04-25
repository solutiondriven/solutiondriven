class Simulator {
  constructor() {
    this.trades = [];
    this.tickHandlers = [];
  }

  onTick(handler) {
    this.tickHandlers.push(handler);
  }

  emitTick(symbol, price) {
    this.tickHandlers.forEach(h => h({symbol, price}));
  }

  createOrder(trade) {
    trade.id = `t${Date.now()}`;
    this.trades.push(trade);
    return trade;
  }

  getOpenTrades() {
    return this.trades;
  }

  modifyTradeStop(tradeId, newStop) {
    const trade = this.trades.find(t => t.id === tradeId);
    if(trade) trade.stopLoss = newStop;
  }

  closeTrade(tradeId) {
    this.trades = this.trades.filter(t => t.id !== tradeId);
  }
}

module.exports = Simulator;
