/**
 * ExecutionWrapper - Unified interface for executing trades across brokers
 * Routes signals to MetaApi (MT5) or CCXT (Crypto)
 * Handles validation, error recovery, and execution tracking
 */

const EventEmitter = require('events');

class ExecutionWrapper extends EventEmitter {
  constructor(metaApiClient, ccxtExchanges = {}) {
    super();
    this.metaApi = metaApiClient; // MetaApi instance for MT5
    this.ccxt = ccxtExchanges; // Map of exchange_name -> CCXT instance
    
    this.executionHistory = {}; // Track all executions
    this.failureLog = []; // Log failed executions for monitoring
  }

  /**
   * Execute a trade signal for a follower
   * Main entry point - routes to correct broker
   * 
   * @param {Object} signal - The trade signal {symbol, action, volume, stopLoss, takeProfit, broker}
   * @param {Object} follower - The follower {id, broker_type, credentials, volume_factor}
   * @returns {Promise<Object>} Execution result {success, executionId, details, latency, error}
   */
  async executeTrade(signal, follower) {
    const executionId = this._generateExecutionId();
    const startTime = Date.now();

    try {
      // Validate inputs
      this._validateSignal(signal);
      this._validateFollower(follower);

      // Adjust volume by follower's volume factor
      const adjustedVolume = signal.volume * follower.volume_factor;

      // Route to correct broker
      let result;
      if (follower.broker_type === 'mt5') {
        result = await this._executeOnMetaApi(
          executionId,
          signal,
          follower,
          adjustedVolume
        );
      } else if (['binance', 'bitget', 'bybit', 'kucoin'].includes(follower.broker_type)) {
        result = await this._executeOnCCXT(
          executionId,
          signal,
          follower,
          adjustedVolume
        );
      } else {
        throw new Error(`Unknown broker type: ${follower.broker_type}`);
      }

      // Measure latency
      const latency = Date.now() - startTime;

      // Record execution
      const execution = {
        executionId,
        signal_id: signal.id,
        follower_id: follower.id,
        broker: follower.broker_type,
        status: result.success ? 'SUCCESS' : 'FAILED',
        latency,
        timestamp: new Date().toISOString(),
        details: result
      };

      this.executionHistory[executionId] = execution;

      // Emit events for monitoring
      if (result.success) {
        this.emit('execution:success', execution);
      } else {
        this.emit('execution:failed', execution);
        this.failureLog.push(execution);
      }

      return {
        success: result.success,
        executionId,
        order_id: result.order_id,
        latency,
        timestamp: new Date().toISOString(),
        details: result
      };
    } catch (error) {
      const latency = Date.now() - startTime;
      const failedExecution = {
        executionId,
        signal_id: signal.id,
        follower_id: follower.id,
        broker: follower.broker_type,
        status: 'ERROR',
        error: error.message,
        latency,
        timestamp: new Date().toISOString()
      };

      this.executionHistory[executionId] = failedExecution;
      this.failureLog.push(failedExecution);
      this.emit('execution:error', failedExecution);

      return {
        success: false,
        executionId,
        error: error.message,
        latency,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Execute on MT5 via MetaApi
   * @private
   */
  async _executeOnMetaApi(executionId, signal, follower, adjustedVolume) {
    if (!this.metaApi) {
      throw new Error('MetaApi client not configured');
    }

    const order = {
      symbol: signal.symbol,
      type: 'MARKET',
      side: signal.action.toLowerCase(), // 'buy' or 'sell'
      volume: adjustedVolume,
      stopLoss: signal.stop_loss,
      takeProfit: signal.take_profit
    };

    try {
      const result = await this.metaApi.placeOrder(follower.credentials.account, order);

      return {
        success: true,
        order_id: result.ticketNumber || result.orderId,
        broker: 'metaapi',
        symbol: signal.symbol,
        action: signal.action,
        volume: adjustedVolume,
        executionPrice: result.executionPrice,
        commission: result.commission || 0
      };
    } catch (error) {
      throw new Error(`MetaApi execution failed: ${error.message}`);
    }
  }

  /**
   * Execute on Crypto via CCXT
   * @private
   */
  async _executeOnCCXT(executionId, signal, follower, adjustedVolume) {
    const exchange = follower.broker_type;

    if (!this.ccxt[exchange]) {
      throw new Error(`CCXT exchange not configured: ${exchange}`);
    }

    const ccxtExchange = this.ccxt[exchange];

    try {
      // CCXT standardized order
      const order = await ccxtExchange.createOrder(
        signal.symbol, // e.g., 'BTC/USDT'
        'market',
        signal.action.toLowerCase(), // 'buy' or 'sell'
        adjustedVolume
      );

      return {
        success: true,
        order_id: order.id,
        broker: exchange,
        symbol: signal.symbol,
        action: signal.action,
        volume: adjustedVolume,
        executionPrice: order.average || order.info?.fills?.[0]?.price,
        fee: order.fee?.cost || 0,
        timestamp: new Date(order.timestamp).toISOString()
      };
    } catch (error) {
      throw new Error(`CCXT execution failed on ${exchange}: ${error.message}`);
    }
  }

  /**
   * Modify SL/TP for an open position (MT5 only)
   */
  async modifyStopLossAndTakeProfit(follower, positionTicket, stopLoss, takeProfit) {
    if (follower.broker_type !== 'mt5') {
      throw new Error('SL/TP modification only supported for MT5');
    }

    try {
      const result = await this.metaApi.modifyPosition(
        follower.credentials.account,
        positionTicket,
        stopLoss,
        takeProfit
      );

      return {
        success: true,
        positionTicket,
        newStopLoss: stopLoss,
        newTakeProfit: takeProfit
      };
    } catch (error) {
      throw new Error(`Failed to modify position: ${error.message}`);
    }
  }

  /**
   * Close a position
   */
  async closePosition(follower, symbol, orderId = null) {
    try {
      if (follower.broker_type === 'mt5') {
        const result = await this.metaApi.closePosition(
          follower.credentials.account,
          symbol,
          orderId
        );

        return {
          success: true,
          symbol,
          closingPrice: result.closingPrice,
          pnl: result.pnl
        };
      } else {
        const ccxtExchange = this.ccxt[follower.broker_type];
        if (!ccxtExchange) {
          throw new Error(`Exchange not configured: ${follower.broker_type}`);
        }

        // For crypto, create a market sell to close position
        const positions = await ccxtExchange.fetchOpenOrders(symbol);
        if (positions.length === 0) {
          return { success: true, symbol, message: 'No open position found' };
        }

        const position = positions[0];
        const closeOrder = await ccxtExchange.createOrder(
          symbol,
          'market',
          'sell',
          position.amount
        );

        return {
          success: true,
          symbol,
          closeOrderId: closeOrder.id,
          closingPrice: closeOrder.average
        };
      }
    } catch (error) {
      throw new Error(`Failed to close position: ${error.message}`);
    }
  }

  /**
   * Get execution status and history
   */
  getExecutionHistory(executionId = null) {
    if (executionId) {
      return this.executionHistory[executionId] || null;
    }
    return this.executionHistory;
  }

  /**
   * Get recent failures for monitoring
   */
  getRecentFailures(limit = 10) {
    return this.failureLog.slice(-limit);
  }

  /**
   * Execution metrics
   */
  getMetrics() {
    const total = Object.keys(this.executionHistory).length;
    const successful = Object.values(this.executionHistory).filter(
      e => e.status === 'SUCCESS'
    ).length;
    const failed = Object.values(this.executionHistory).filter(
      e => e.status === 'FAILED' || e.status === 'ERROR'
    ).length;

    const latencies = Object.values(this.executionHistory)
      .map(e => e.latency)
      .filter(l => l !== undefined);

    return {
      total_executions: total,
      successful: successful,
      failed: failed,
      success_rate: total > 0 ? ((successful / total) * 100).toFixed(2) + '%' : 'N/A',
      avg_latency_ms: latencies.length > 0
        ? (latencies.reduce((a, b) => a + b, 0) / latencies.length).toFixed(2)
        : 'N/A',
      p95_latency_ms: this._calculatePercentile(latencies, 95),
      p99_latency_ms: this._calculatePercentile(latencies, 99)
    };
  }

  // ============ PRIVATE HELPERS ============

  _validateSignal(signal) {
    if (!signal.id || !signal.symbol || !signal.action || !signal.volume) {
      throw new Error('Invalid signal: missing required fields');
    }
    if (!['BUY', 'SELL', 'buy', 'sell'].includes(signal.action)) {
      throw new Error('Invalid signal action');
    }
    if (signal.volume <= 0) {
      throw new Error('Volume must be positive');
    }
  }

  _validateFollower(follower) {
    if (!follower.id || !follower.broker_type) {
      throw new Error('Invalid follower: missing required fields');
    }
    if (typeof follower.volume_factor !== 'number' || follower.volume_factor <= 0) {
      throw new Error('Invalid volume factor');
    }
  }

  _generateExecutionId() {
    return `exec_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }

  _calculatePercentile(values, p) {
    if (values.length === 0) return 'N/A';
    const sorted = values.sort((a, b) => a - b);
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)].toFixed(2);
  }
}

module.exports = ExecutionWrapper;
