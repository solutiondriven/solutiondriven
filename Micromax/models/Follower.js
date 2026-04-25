/**
 * Follower Model - Represents a user copying trades
 * Tracks: broker type, credentials, execution settings, performance
 */

class Follower {
  constructor(followerId, brokerType, credentials, volumeFactor = 1.0) {
    this.id = followerId;
    this.broker_type = brokerType; // 'mt5', 'binance', 'bitget'
    this.credentials = credentials; // {account, password, server} or {api_key, api_secret}
    this.volume_factor = volumeFactor; // 1.0 = same as master, 0.5 = half
    this.active = true;
    this.created_at = new Date().toISOString();
    
    // Performance
    this.total_trades = 0;
    this.successful_trades = 0;
    this.failed_trades = 0;
    this.total_pnl = 0;
    this.win_rate = 0;
  }

  // Update trade statistics
  recordTrade(success, pnl = 0) {
    this.total_trades++;
    if (success) {
      this.successful_trades++;
    } else {
      this.failed_trades++;
    }
    this.total_pnl += pnl;
    this.calculateWinRate();
  }

  // Calculate win rate
  calculateWinRate() {
    if (this.total_trades === 0) return;
    this.win_rate = (this.successful_trades / this.total_trades) * 100;
  }

  // Get follower stats
  getStats() {
    return {
      id: this.id,
      broker_type: this.broker_type,
      active: this.active,
      total_trades: this.total_trades,
      successful_trades: this.successful_trades,
      failed_trades: this.failed_trades,
      win_rate: this.win_rate.toFixed(2) + '%',
      total_pnl: this.total_pnl.toFixed(2),
      volume_factor: this.volume_factor,
      created_at: this.created_at
    };
  }

  // Toggle active status
  setActive(active) {
    this.active = active;
  }
}

module.exports = Follower;
