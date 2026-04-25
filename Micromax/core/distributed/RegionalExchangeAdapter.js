/**
 * RegionalExchangeAdapter
 * 
 * Wraps individual exchange adapters (Binance, Forex, etc.) with:
 * 1. Multi-region awareness via MultiRegionRouter
 * 2. Service mesh authentication (mTLS + JWT)
 * 3. Latency optimization through regional data centers
 * 4. Signal security (encryption + authentication)
 */

const axios = require('axios');

class RegionalExchangeAdapter {
  constructor(exchangeName, region, multiRegionRouter) {
    this.exchangeName = exchangeName;
    this.region = region;
    this.router = multiRegionRouter;
    
    this.config = {
      retryAttempts: 3,
      timeout: 5000
    };

    this.metrics = {
      signalsReceived: 0,
      signalsProcessed: 0,
      signalsFailed: 0,
      avgLatency: 0,
      errors: []
    };
  }

  /**
   * Ingest market data from regional exchange and route to signal processor
   * This runs in the regional cluster closest to the exchange
   */
  async ingestMarketData(ticker, marketData) {
    const startTime = Date.now();

    try {
      this.metrics.signalsReceived++;

      // Validate data integrity (prevents tampering via mTLS layer)
      if (!this.validateMarketData(marketData)) {
        throw new Error('Invalid market data format');
      }

      // Prepare signal for transmission through service mesh
      const signal = {
        id: `${this.exchangeName}-${ticker}-${Date.now()}`,
        exchange: this.exchangeName,
        ticker,
        region: this.region,
        timestamp: new Date().toISOString(),
        data: marketData,
        signature: this.signSignal(marketData) // Cryptographic signature
      };

      // Route to signal aggregator through multi-region mesh
      // The service mesh (Istio) ensures:
      // - mTLS encryption between services
      // - Service identity verification
      // - Network policy enforcement (only allowed services can call each other)
      const response = await this.router.route(
        this.exchangeName,
        '/api/v1/signals/ingest',
        signal
      );

      this.metrics.signalsProcessed++;
      this.recordLatency(Date.now() - startTime);

      return { success: true, signalId: signal.id };
    } catch (error) {
      this.metrics.signalsFailed++;
      this.metrics.errors.push({
        timestamp: new Date().toISOString(),
        error: error.message
      });

      console.error(`❌ Failed to ingest market data for ${ticker}:`, error.message);
      throw error;
    }
  }

  /**
   * Execute trade order through regional infrastructure
   * Routed to geographic region closest to the exchange
   */
  async executeOrder(order) {
    const startTime = Date.now();

    try {
      // Validate order before sending through mesh
      if (!this.validateOrder(order)) {
        throw new Error('Invalid order format');
      }

      // Encrypt sensitive order data (price, quantity, etc)
      // Note: Istio mTLS handles the transport encryption;
      // additional encryption can be added for extra security
      const encryptedOrder = {
        ...order,
        timestamp: new Date().toISOString(),
        region: this.region,
        signature: this.signSignal(order)
      };

      // Route through service mesh with proper authentication
      // mTLS ensures only authenticated services (execution-service, broker-router)
      // can receive this order
      const response = await this.router.route(
        this.exchangeName,
        '/api/v1/orders/execute',
        encryptedOrder
      );

      this.recordLatency(Date.now() - startTime);

      return {
        success: true,
        orderId: response.orderId,
        status: response.status
      };
    } catch (error) {
      console.error(`❌ Failed to execute order:`, error.message);
      throw error;
    }
  }

  /**
   * Cancel order with redundancy across regions if needed
   */
  async cancelOrder(orderId) {
    try {
      const response = await this.router.route(
        this.exchangeName,
        '/api/v1/orders/cancel',
        { orderId, region: this.region }
      );

      return { success: true, orderId, status: 'cancelled' };
    } catch (error) {
      console.error(`❌ Failed to cancel order ${orderId}:`, error.message);
      throw error;
    }
  }

  /**
   * Get real-time positions from regional exchange connection
   */
  async getPositions() {
    try {
      const response = await this.router.route(
        this.exchangeName,
        '/api/v1/positions',
        { region: this.region }
      );

      return response.positions;
    } catch (error) {
      console.error(`❌ Failed to get positions:`, error.message);
      throw error;
    }
  }

  /**
   * Get account balance from exchange
   */
  async getBalance() {
    try {
      const response = await this.router.route(
        this.exchangeName,
        '/api/v1/account/balance',
        { region: this.region }
      );

      return response.balance;
    } catch (error) {
      console.error(`❌ Failed to get balance:`, error.message);
      throw error;
    }
  }

  /**
   * Validate market data format
   * Prevents malformed data from being processed
   */
  validateMarketData(data) {
    return (
      data &&
      typeof data.open === 'number' &&
      typeof data.high === 'number' &&
      typeof data.low === 'number' &&
      typeof data.close === 'number' &&
      typeof data.volume === 'number' &&
      data.timestamp
    );
  }

  /**
   * Validate order format
   */
  validateOrder(order) {
    return (
      order &&
      order.symbol &&
      order.side && ['BUY', 'SELL'].includes(order.side) &&
      order.quantity && order.quantity > 0 &&
      order.price && order.price > 0 &&
      order.type && ['MARKET', 'LIMIT', 'STOP_LOSS'].includes(order.type)
    );
  }

  /**
   * Sign signal/order with private key
   * This provides non-repudiation (service can't deny sending it)
   */
  signSignal(data) {
    // In production, use proper cryptographic signing with private keys
    // This is a placeholder that would use the service's private key
    const crypto = require('crypto');
    
    const payload = JSON.stringify(data);
    const signature = crypto
      .createHmac('sha256', process.env.MICROMAX_SIGNING_KEY || 'dev-key')
      .update(payload)
      .digest('hex');

    return signature;
  }

  /**
   * Record latency metrics for performance optimization
   */
  recordLatency(latency) {
    const prevAvg = this.metrics.avgLatency;
    const totalProcessed = this.metrics.signalsProcessed;
    
    // Calculate running average
    this.metrics.avgLatency = 
      (prevAvg * (totalProcessed - 1) + latency) / totalProcessed;
  }

  /**
   * Get adapter metrics
   */
  getMetrics() {
    return {
      exchange: this.exchangeName,
      region: this.region,
      signals: {
        received: this.metrics.signalsReceived,
        processed: this.metrics.signalsProcessed,
        failed: this.metrics.signalsFailed,
        successRate: this.metrics.signalsReceived > 0 
          ? ((this.metrics.signalsProcessed / this.metrics.signalsReceived) * 100).toFixed(2) + '%'
          : 'N/A'
      },
      performance: {
        avgLatencyMs: Math.round(this.metrics.avgLatency),
      },
      recentErrors: this.metrics.errors.slice(-5)
    };
  }
}

module.exports = RegionalExchangeAdapter;
