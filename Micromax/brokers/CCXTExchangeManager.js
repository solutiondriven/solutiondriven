/**
 * CCXT Integration Layer - Unified crypto exchange interface
 * Wraps CCXT library for Binance, Bitget, Bybit, KuCoin, etc.
 * Handles: initialization, order placement, position management, fees
 */

const ccxt = require('ccxt');
const EventEmitter = require('events');

class CCXTExchangeManager extends EventEmitter {
  constructor() {
    super();
    this.exchanges = {}; // Cache of initialized exchange instances
    this.tradeHistory = {}; // Track trades per exchange
    this.logger = console;
  }

  /**
   * Initialize a CCXT exchange
   * 
   * @param {string} exchangeName - 'binance', 'bitget', 'bybit', 'kucoin'
   * @param {Object} credentials - {apiKey, apiSecret, passphrase (for bitget)}
   * @param {Object} options - {sandbox: false, enableRateLimit: true, etc}
   * @returns {Promise<Object>} Exchange status
   */
  async initExchange(exchangeName, credentials, options = {}) {
    exchangeName = exchangeName.toLowerCase();

    try {
      // Validate exchange is supported by CCXT
      if (!this._isValidExchange(exchangeName)) {
        throw new Error(`Exchange ${exchangeName} not supported by CCXT`);
      }

      // Create exchange instance
      const ExchangeClass = ccxt[exchangeName];
      const exchangeConfig = {
        apiKey: credentials.apiKey,
        secret: credentials.apiSecret,
        enableRateLimit: true,
        ...options
      };

      // Add passphrase for exchanges that require it (e.g., Bitget, OKX)
      if (credentials.passphrase) {
        exchangeConfig.password = credentials.passphrase;
      }

      const exchange = new ExchangeClass(exchangeConfig);

      // Test connection
      const balance = await exchange.fetchBalance();

      this.exchanges[exchangeName] = {
        instance: exchange,
        name: exchangeName,
        initialized: true,
        initializedAt: new Date().toISOString(),
        balance: balance.free,
        markets: await exchange.loadMarkets()
      };

      this.emit('exchange:initialized', {
        exchange: exchangeName,
        balance: balance.free
      });

      return {
        success: true,
        exchange: exchangeName,
        balance: balance.free,
        markets: Object.keys(this.exchanges[exchangeName].markets).length
      };
    } catch (error) {
      this.emit('exchange:error', {
        exchange: exchangeName,
        error: error.message
      });
      throw new Error(`Failed to initialize ${exchangeName}: ${error.message}`);
    }
  }

  /**
   * Place a market order on crypto exchange
   * 
   * @param {string} exchangeName - Exchange to trade on
   * @param {string} symbol - Trading pair (e.g., 'BTC/USDT')
   * @param {string} side - 'buy' or 'sell'
   * @param {number} amount - Amount in base currency
   * @param {Object} params - Additional CCXT params
   * @returns {Promise<Object>} Order result
   */
  async placeMarketOrder(exchangeName, symbol, side, amount, params = {}) {
    exchangeName = exchangeName.toLowerCase();

    try {
      const exchange = this._getExchange(exchangeName);

      // Validate symbol is supported
      if (!exchange.instance.symbols.includes(symbol)) {
        throw new Error(`Symbol ${symbol} not supported on ${exchangeName}`);
      }

      // Validate amount meets minimum
      const market = exchange.instance.markets[symbol];
      if (market.limits && market.limits.amount && amount < market.limits.amount.min) {
        throw new Error(
          `Amount ${amount} below minimum ${market.limits.amount.min} for ${symbol}`
        );
      }

      // Place market order
      const order = await exchange.instance.createMarketOrder(
        symbol,
        side,
        amount,
        undefined,
        params
      );

      // Track order
      this._trackTrade(exchangeName, symbol, side, order);

      this.emit('order:placed', {
        exchange: exchangeName,
        symbol,
        side,
        amount,
        orderId: order.id,
        status: order.status
      });

      return {
        success: true,
        orderId: order.id,
        symbol: symbol,
        side: side,
        amount: amount,
        average: order.average || this._calculateAveragePrice(order),
        filled: order.filled,
        cost: order.cost,
        fee: order.fee?.cost || 0,
        feeCurrency: order.fee?.currency || 'USDT',
        status: order.status,
        timestamp: new Date(order.timestamp).toISOString()
      };
    } catch (error) {
      this.emit('order:error', {
        exchange: exchangeName,
        symbol,
        error: error.message
      });
      throw new Error(`Order placement failed on ${exchangeName}: ${error.message}`);
    }
  }

  /**
   * Place a limit order
   * 
   * @param {string} exchangeName - Exchange to trade on
   * @param {string} symbol - Trading pair (e.g., 'ETH/USDT')
   * @param {string} side - 'buy' or 'sell'
   * @param {number} amount - Amount to trade
   * @param {number} price - Limit price
   * @param {Object} params - Additional CCXT params
   * @returns {Promise<Object>} Order result
   */
  async placeLimitOrder(exchangeName, symbol, side, amount, price, params = {}) {
    exchangeName = exchangeName.toLowerCase();

    try {
      const exchange = this._getExchange(exchangeName);

      if (!exchange.instance.symbols.includes(symbol)) {
        throw new Error(`Symbol ${symbol} not supported on ${exchangeName}`);
      }

      const order = await exchange.instance.createLimitOrder(
        symbol,
        side,
        amount,
        price,
        params
      );

      this._trackTrade(exchangeName, symbol, side, order);

      this.emit('order:placed', {
        exchange: exchangeName,
        symbol,
        side,
        amount,
        price,
        orderId: order.id,
        status: order.status
      });

      return {
        success: true,
        orderId: order.id,
        symbol: symbol,
        side: side,
        amount: amount,
        price: price,
        filled: order.filled,
        remaining: order.remaining,
        status: order.status,
        timestamp: new Date(order.timestamp).toISOString()
      };
    } catch (error) {
      this.emit('order:error', {
        exchange: exchangeName,
        symbol,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Close a position on crypto exchange
   * For most exchanges, this means selling/buying back the full amount
   * 
   * @param {string} exchangeName - Exchange
   * @param {string} symbol - Symbol to close (e.g., 'BTC/USDT')
   * @param {Object} params - Additional params
   * @returns {Promise<Object>} Close result
   */
  async closePosition(exchangeName, symbol, params = {}) {
    exchangeName = exchangeName.toLowerCase();

    try {
      const exchange = this._getExchange(exchangeName);

      // Fetch open orders for this symbol
      const openOrders = await exchange.instance.fetchOpenOrders(symbol);

      if (openOrders.length === 0) {
        return {
          success: false,
          symbol,
          message: 'No open positions found'
        };
      }

      // Close all open orders by creating opposite orders
      const results = [];
      for (const order of openOrders) {
        try {
          const closeOrder = await exchange.instance.createMarketOrder(
            symbol,
            order.side === 'buy' ? 'sell' : 'buy',
            order.amount,
            undefined,
            params
          );

          results.push({
            originalOrderId: order.id,
            closeOrderId: closeOrder.id,
            average: closeOrder.average,
            cost: closeOrder.cost
          });
        } catch (err) {
          results.push({
            originalOrderId: order.id,
            error: err.message
          });
        }
      }

      this.emit('position:closed', {
        exchange: exchangeName,
        symbol,
        closedOrdersCount: results.filter(r => !r.error).length
      });

      return {
        success: results.some(r => !r.error),
        symbol,
        closedOrders: results,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      this.emit('position:error', {
        exchange: exchangeName,
        symbol,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get balance for an exchange
   */
  async getBalance(exchangeName) {
    exchangeName = exchangeName.toLowerCase();

    try {
      const exchange = this._getExchange(exchangeName);
      const balance = await exchange.instance.fetchBalance();

      return {
        exchange: exchangeName,
        total: balance.total,
        free: balance.free,
        used: balance.used,
        currencies: Object.keys(balance.free).filter(k => balance.free[k] > 0)
      };
    } catch (error) {
      throw new Error(`Failed to fetch balance from ${exchangeName}: ${error.message}`);
    }
  }

  /**
   * Get current price for a symbol
   */
  async getCurrentPrice(exchangeName, symbol) {
    exchangeName = exchangeName.toLowerCase();

    try {
      const exchange = this._getExchange(exchangeName);
      const ticker = await exchange.instance.fetchTicker(symbol);

      return {
        symbol,
        bid: ticker.bid,
        ask: ticker.ask,
        last: ticker.last,
        timestamp: new Date(ticker.timestamp).toISOString()
      };
    } catch (error) {
      throw new Error(`Failed to fetch price for ${symbol} on ${exchangeName}: ${error.message}`);
    }
  }

  /**
   * Get order status
   */
  async getOrderStatus(exchangeName, symbol, orderId) {
    exchangeName = exchangeName.toLowerCase();

    try {
      const exchange = this._getExchange(exchangeName);
      const order = await exchange.instance.fetchOrder(orderId, symbol);

      return {
        orderId: order.id,
        symbol: order.symbol,
        side: order.side,
        status: order.status,
        amount: order.amount,
        filled: order.filled,
        remaining: order.remaining,
        average: order.average,
        cost: order.cost,
        fee: order.fee
      };
    } catch (error) {
      throw new Error(`Failed to fetch order status: ${error.message}`);
    }
  }

  /**
   * Get trade fees
   */
  async getTradingFees(exchangeName, symbol = null) {
    exchangeName = exchangeName.toLowerCase();

    try {
      const exchange = this._getExchange(exchangeName);

      if (symbol) {
        const fees = await exchange.instance.fetchTradingFees(symbol);
        return {
          exchange: exchangeName,
          symbol,
          maker: fees.maker,
          taker: fees.taker
        };
      } else {
        const fees = await exchange.instance.fetchTradingFees();
        return {
          exchange: exchangeName,
          trading: fees.trading,
          maker: fees.maker,
          taker: fees.taker
        };
      }
    } catch (error) {
      throw new Error(`Failed to fetch trading fees: ${error.message}`);
    }
  }

  /**
   * Get all supported symbols on exchange
   */
  getAvailableSymbols(exchangeName) {
    exchangeName = exchangeName.toLowerCase();
    const exchange = this._getExchange(exchangeName);
    return exchange.instance.symbols;
  }

  /**
   * Get trade history
   */
  getTradeHistory(exchangeName, limit = 20) {
    exchangeName = exchangeName.toLowerCase();
    const history = this.tradeHistory[exchangeName] || [];
    return history.slice(-limit);
  }

  // ============ PRIVATE HELPERS ============

  _getExchange(exchangeName) {
    exchangeName = exchangeName.toLowerCase();
    if (!this.exchanges[exchangeName] || !this.exchanges[exchangeName].initialized) {
      throw new Error(`Exchange ${exchangeName} not initialized`);
    }
    return this.exchanges[exchangeName];
  }

  _isValidExchange(exchangeName) {
    const validExchanges = [
      'binance',
      'binanceus',
      'bitget',
      'bybit',
      'kucoin',
      'okx',
      'huobi',
      'ftx',
      'gateio'
    ];
    return validExchanges.includes(exchangeName.toLowerCase());
  }

  _trackTrade(exchangeName, symbol, side, order) {
    if (!this.tradeHistory[exchangeName]) {
      this.tradeHistory[exchangeName] = [];
    }

    this.tradeHistory[exchangeName].push({
      symbol,
      side,
      orderId: order.id,
      amount: order.amount,
      filled: order.filled,
      cost: order.cost,
      fee: order.fee,
      timestamp: new Date(order.timestamp).toISOString()
    });
  }

  _calculateAveragePrice(order) {
    if (order.filled === 0) return 0;
    return order.cost / order.filled;
  }

  /**
   * Get all initialized exchanges
   */
  getInitializedExchanges() {
    return Object.keys(this.exchanges).map(key => ({
      name: key,
      initialized: this.exchanges[key].initialized,
      initializedAt: this.exchanges[key].initializedAt
    }));
  }
}

module.exports = CCXTExchangeManager;
