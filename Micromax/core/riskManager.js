// core/riskManager.js
class RiskManager {
  evaluateTrade(trade, currentPrice) {
    const entry = trade.entryPrice;
    const tp = trade.takeProfit;
    const sl = trade.stopLoss;
    const side = trade.side;

    const profitProgress = side === "BUY" ? (currentPrice - entry) / (tp - entry) : (entry - currentPrice) / (entry - tp);

    // 50% to TP → break-even
    if (!trade.breakEvenSet && profitProgress >= 0.5) {
      trade.stopLoss = entry;
      trade.breakEvenSet = true;
      console.log(`🔹 Break-even set for ${trade.symbol} at ${entry}`);
    }

    // 50% past SL → force close
    const slDist = Math.abs(entry - sl);
    if (slDist > 0) {
      const trigger = side === "BUY" ? (sl - 0.5 * slDist) : (sl + 0.5 * slDist);
      if ((side === "BUY" && currentPrice <= trigger) || (side === "SELL" && currentPrice >= trigger)) {
        console.log(`❌ Trade ${trade.symbol} closed at ${currentPrice} (50% past SL)`);
        trade.closed = true;
      }
    }
  }
}

module.exports = RiskManager;
