/**
 * Revenue Tracker Module
 * Tracks all trades and calculates revenue share for the platform
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const REVENUE_LOG_PATH = path.join(DATA_DIR, 'revenue_log.json');
const USER_REVENUE_PATH = path.join(DATA_DIR, 'user_revenue.json');

class RevenueTracker {
  constructor() {
    this.ensureDataDirExists();
    this.loadRevenueLogs();
  }

  ensureDataDirExists() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(REVENUE_LOG_PATH)) {
      fs.writeFileSync(REVENUE_LOG_PATH, JSON.stringify([], null, 2));
    }
    if (!fs.existsSync(USER_REVENUE_PATH)) {
      fs.writeFileSync(USER_REVENUE_PATH, JSON.stringify({}, null, 2));
    }
  }

  loadRevenueLogs() {
    try {
      this.trades = JSON.parse(fs.readFileSync(REVENUE_LOG_PATH, 'utf8'));
      this.userRevenue = JSON.parse(fs.readFileSync(USER_REVENUE_PATH, 'utf8'));
    } catch (error) {
      this.trades = [];
      this.userRevenue = {};
    }
  }

  /**
   * Record a completed trade and calculate revenue
   * @param {string} userId - User ID
   * @param {string} signalId - Signal ID
   * @param {string} brokerType - Broker type (mt5, binance, bitget)
   * @param {Object} tradeDetails - { symbol, entry_price, exit_price, volume, position_type }
   * @param {number} profitLoss - Actual profit/loss in USD
   * @param {number} profitSharePercent - Percentage Micromax takes (default 20%)
   * @returns {Object} Trade record with revenue calculations
   */
  recordTrade(userId, signalId, brokerType, tradeDetails, profitLoss, profitSharePercent = 0.20) {
    try {
      const tradeRecord = {
        id: `trade_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date().toISOString(),
        user_id: userId,
        signal_id: signalId,
        broker_type: brokerType,
        symbol: tradeDetails.symbol,
        position_type: tradeDetails.position_type,
        entry_price: tradeDetails.entry_price,
        exit_price: tradeDetails.exit_price,
        volume: tradeDetails.volume,
        profit_loss: profitLoss,
        profit_loss_type: profitLoss > 0 ? 'PROFIT' : profitLoss < 0 ? 'LOSS' : 'BREAKEVEN',
        micromax_share_percent: profitSharePercent,
        micromax_share_amount: Math.max(0, profitLoss * profitSharePercent),
        trader_net_amount: profitLoss * (1 - profitSharePercent),
      };

      // Add to trades log
      this.trades.push(tradeRecord);
      fs.writeFileSync(REVENUE_LOG_PATH, JSON.stringify(this.trades, null, 2));

      // Update user revenue
      if (!this.userRevenue[userId]) {
        this.userRevenue[userId] = {
          user_id: userId,
          total_trades: 0,
          total_profit_loss: 0,
          micromax_earned: 0,
          trades: [],
        };
      }

      this.userRevenue[userId].total_trades += 1;
      this.userRevenue[userId].total_profit_loss += profitLoss;
      this.userRevenue[userId].micromax_earned += tradeRecord.micromax_share_amount;
      this.userRevenue[userId].trades.push(tradeRecord.id);

      fs.writeFileSync(USER_REVENUE_PATH, JSON.stringify(this.userRevenue, null, 2));

      console.log(`✅ Trade recorded: ${tradeRecord.id} | P/L: $${profitLoss.toFixed(2)} | Micromax: $${tradeRecord.micromax_share_amount.toFixed(2)}`);

      return tradeRecord;
    } catch (error) {
      console.error('Failed to record trade:', error);
      return null;
    }
  }

  /**
   * Get overall platform statistics
   * @returns {Object} Platform-wide metrics
   */
  getPlatformStats() {
    try {
      const totalTrades = this.trades.length;
      const totalProfits = this.trades.reduce((sum, t) => sum + (t.profit_loss > 0 ? t.profit_loss : 0), 0);
      const totalLosses = this.trades.reduce((sum, t) => sum + (t.profit_loss < 0 ? t.profit_loss : 0), 0);
      const netProfit = totalProfits + totalLosses;
      const micromaxRevenue = this.trades.reduce((sum, t) => sum + t.micromax_share_amount, 0);
      const winningTrades = this.trades.filter(t => t.profit_loss > 0).length;
      const losingTrades = this.trades.filter(t => t.profit_loss < 0).length;
      const winRate = totalTrades > 0 ? (winningTrades / totalTrades * 100).toFixed(2) : 0;
      const profitFactor = totalLosses !== 0 ? (totalProfits / Math.abs(totalLosses)).toFixed(2) : 'N/A';

      return {
        platform_stats: {
          total_trades: totalTrades,
          winning_trades: winningTrades,
          losing_trades: losingTrades,
          win_rate: `${winRate}%`,
          total_profit_loss: netProfit.toFixed(2),
          total_user_profits: totalProfits.toFixed(2),
          total_user_losses: totalLosses.toFixed(2),
          profit_factor: profitFactor,
          micromax_revenue: micromaxRevenue.toFixed(2),
          avg_profit_per_trade: (netProfit / (totalTrades || 1)).toFixed(2),
          last_updated: new Date().toISOString(),
        },
      };
    } catch (error) {
      console.error('Failed to get platform stats:', error);
      return { error: error.message };
    }
  }

  /**
   * Get statistics for a specific user
   * @param {string} userId - User ID
   * @returns {Object} User-specific metrics
   */
  getUserStats(userId) {
    if (!this.userRevenue[userId]) {
      return {
        user_id: userId,
        total_trades: 0,
        total_profit_loss: 0,
        micromax_earned: 0,
        win_rate: '0%',
        message: 'No trades yet',
      };
    }

    const userData = this.userRevenue[userId];
    const userTrades = this.trades.filter(t => t.user_id === userId);
    const winningTrades = userTrades.filter(t => t.profit_loss > 0).length;
    const winRate = userData.total_trades > 0 ? (winningTrades / userData.total_trades * 100).toFixed(2) : 0;

    return {
      user_id: userId,
      total_trades: userData.total_trades,
      total_profit_loss: userData.total_profit_loss.toFixed(2),
      micromax_earned: userData.micromax_earned.toFixed(2),
      trader_net: (userData.total_profit_loss - userData.micromax_earned).toFixed(2),
      win_rate: `${winRate}%`,
      avg_profit_per_trade: (userData.total_profit_loss / (userData.total_trades || 1)).toFixed(2),
    };
  }

  /**
   * Get revenue statistics by broker
   * @returns {Object} Breakdown by broker
   */
  getRevenueByBroker() {
    const byBroker = {};

    this.trades.forEach(trade => {
      const broker = trade.broker_type;
      if (!byBroker[broker]) {
        byBroker[broker] = {
          broker_type: broker,
          trades: 0,
          profit_loss: 0,
          micromax_earned: 0,
        };
      }
      byBroker[broker].trades += 1;
      byBroker[broker].profit_loss += trade.profit_loss;
      byBroker[broker].micromax_earned += trade.micromax_share_amount;
    });

    return {
      revenue_by_broker: Object.values(byBroker),
    };
  }

  /**
   * Get top performing users
   * @param {number} limit - Number of users to return
   * @returns {Array} Top users by revenue
   */
  getTopUsers(limit = 10) {
    const sorted = Object.values(this.userRevenue)
      .sort((a, b) => b.micromax_earned - a.micromax_earned)
      .slice(0, limit);

    return {
      top_users: sorted.map(u => ({
        user_id: u.user_id,
        total_trades: u.total_trades,
        total_profit_loss: u.total_profit_loss.toFixed(2),
        micromax_earned: u.micromax_earned.toFixed(2),
      })),
    };
  }

  /**
   * Export revenue report
   * @param {string} format - 'json' or 'csv'
   * @returns {string} Formatted report
   */
  exportReport(format = 'json') {
    if (format === 'csv') {
      let csv = 'Timestamp,UserID,SignalID,Broker,Symbol,ProfitLoss,MicromaxShare\n';
      this.trades.forEach(t => {
        csv += `${t.timestamp},${t.user_id},${t.signal_id},${t.broker_type},${t.symbol},${t.profit_loss},${t.micromax_share_amount}\n`;
      });
      return csv;
    }

    return JSON.stringify({
      platform_stats: this.getPlatformStats(),
      trades: this.trades,
      user_revenue: this.userRevenue,
    }, null, 2);
  }
}

module.exports = RevenueTracker;
