/**
 * Trade Model - Represents a single execution of a signal
 * Tracks: entry, exit, P&L for each follower
 */

class Trade {
  constructor(signalId, followerId, symbol, action, volume, entryPrice = null) {
    this.id = Math.random().toString(36).substring(7);
    this.signal_id = signalId;
    this.follower_id = followerId;
    this.symbol = symbol;
    this.action = action; // 'BUY' or 'SELL'
    this.volume = volume;
    this.entry_price = entryPrice;
    this.exit_price = null;
    this.status = 'OPEN'; // OPEN, CLOSED
    
    // P&L
    this.pnl = 0; // Profit/loss in units
    this.pnl_percent = 0; // Profit/loss in percentage
    
    // Timing
    this.entry_time = new Date().toISOString();
    this.exit_time = null;
    
    // Risk management
    this.stop_loss = null;
    this.take_profit = null;
    this.close_reason = null; // 'SL', 'TP', 'MANUAL', 'SIGNAL_CLOSED'
  }

  // Close the trade
  close(exitPrice, reason = 'MANUAL') {
    this.exit_price = exitPrice;
    this.status = 'CLOSED';
    this.exit_time = new Date().toISOString();
    this.close_reason = reason;
    this.calculatePnL();
  }

  // Calculate profit and loss
  calculatePnL() {
    if (!this.entry_price || !this.exit_price) return;

    const difference = this.exit_price - this.entry_price;
    
    if (this.action.toUpperCase() === 'BUY') {
      this.pnl = difference * this.volume;
      this.pnl_percent = ((difference / this.entry_price) * 100);
    } else { // SELL
      this.pnl = -difference * this.volume;
      this.pnl_percent = ((-difference / this.entry_price) * 100);
    }
  }

  // Get trade summary
  getSummary() {
    return {
      id: this.id,
      signal_id: this.signal_id,
      follower_id: this.follower_id,
      symbol: this.symbol,
      action: this.action,
      volume: this.volume,
      status: this.status,
      entry_price: this.entry_price,
      exit_price: this.exit_price,
      pnl: this.pnl.toFixed(2),
      pnl_percent: this.pnl_percent.toFixed(2) + '%',
      entry_time: this.entry_time,
      exit_time: this.exit_time,
      close_reason: this.close_reason
    };
  }
}

module.exports = Trade;
