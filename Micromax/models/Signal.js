/**
 * Signal Model - Represents a trading signal to be copied
 * Tracks: creation, broadcast, execution, status
 */

class Signal {
  constructor(strategy, symbol, action, volume, stopLoss = null, takeProfit = null, broker = 'mt5') {
    this.id = Math.random().toString(36).substring(7);
    this.strategy = strategy;
    this.symbol = symbol;
    this.action = action; // 'BUY' or 'SELL'
    this.volume = volume;
    this.stop_loss = stopLoss;
    this.take_profit = takeProfit;
    this.broker = broker;
    this.status = 'ACTIVE'; // ACTIVE, CLOSED, CANCELLED
    this.created_at = new Date().toISOString();
    this.closed_at = null;
    
    // Tracking
    this.broadcasts = []; // History of broadcasts
    this.followers_executed = [];
    this.followers_failed = [];
  }

  // Mark signal as closed
  close() {
    this.status = 'CLOSED';
    this.closed_at = new Date().toISOString();
  }

  // Get signal statistics
  getStats() {
    return {
      id: this.id,
      strategy: this.strategy,
      symbol: this.symbol,
      action: this.action,
      status: this.status,
      created_at: this.created_at,
      followers_succeeded: this.followers_executed.length,
      followers_failed: this.followers_failed.length,
      total_followers: this.followers_executed.length + this.followers_failed.length
    };
  }
}

module.exports = Signal;
