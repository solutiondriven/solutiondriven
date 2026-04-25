/**
 * MetaApi Integration - Bridge to MetaTrader 5 via MetaApi cloud
 * Handles: order placement, position modification, account syncing
 * Replaces direct MT5 terminal connection with REST API
 */

const axios = require('axios');
const EventEmitter = require('events');

class MetaApiClient extends EventEmitter {
  constructor(apiKey) {
    super();
    this.apiKey = apiKey;
    this.baseUrl = 'https://api.metaapi.cloud/v1';
    this.accounts = {}; // Cache of connected accounts
    this.positionTracking = {}; // Track open positions
    this.logger = console;
  }

  /**
   * Connect to a MetaApi account (MT5)
   * 
   * @param {Object} credentials - {account, password, server}
   * @returns {Promise<Object>} Account connection details
   */
  async connectAccount(credentials) {
    const { account, password, server } = credentials;

    try {
      // GET list of accounts to find matching one
      const accountsResp = await this._apiCall('GET', '/accounts', null, {
        login: account,
        server: server
      });

      if (!accountsResp.accounts || accountsResp.accounts.length === 0) {
        throw new Error(`Account ${account} not found on server ${server}`);
      }

      const accountInfo = accountsResp.accounts[0];
      const accountId = accountInfo.id;

      // Deploy account if not deployed
      if (accountInfo.state !== 'DEPLOYED') {
        await this._apiCall('POST', `/accounts/${accountId}/deploy`);
      }

      // Store account info
      this.accounts[accountId] = {
        id: accountId,
        login: account,
        server: server,
        status: 'CONNECTED',
        connectedAt: new Date().toISOString()
      };

      this.emit('account:connected', {
        accountId,
        login: account,
        server: server
      });

      return {
        success: true,
        accountId,
        login: account,
        server: server,
        balance: accountInfo.balance,
        equity: accountInfo.equity,
        currency: accountInfo.currency
      };
    } catch (error) {
      this.emit('account:error', {
        error: error.message,
        credentials: { account }
      });
      throw error;
    }
  }

  /**
   * Place a market order on MT5
   * 
   * @param {string} accountId - MetaApi account ID
   * @param {Object} order - {symbol, side, volume, stopLoss, takeProfit}
   * @returns {Promise<Object>} Order result {ticketNumber, executionPrice, etc}
   */
  async placeOrder(accountId, order) {
    const { symbol, side, volume, stopLoss, takeProfit } = order;

    try {
      // Validate symbol exists on account
      await this._validateSymbol(accountId, symbol);

      // Get current market price for reference
      const price = await this._getSymbolPrice(accountId, symbol);

      const orderPayload = {
        actionType: 'ORDER_TYPE_BUY_BY_MARKET',
        symbol: symbol,
        volume: volume,
        stopLoss: stopLoss || null,
        takeProfit: takeProfit || null,
        comment: 'CopyTrading_Execution'
      };

      // Adjust action type based on side
      if (side === 'sell' || side === 'SELL') {
        orderPayload.actionType = 'ORDER_TYPE_SELL_BY_MARKET';
      }

      // Place the order
      const response = await this._apiCall(
        'POST',
        `/accounts/${accountId}/orders`,
        orderPayload
      );

      if (!response.orderId) {
        throw new Error('No order ID returned from MetaApi');
      }

      // Track position
      this._trackPosition(accountId, {
        symbol,
        side,
        volume,
        orderId: response.orderId,
        executionPrice: response.executionPrice || price,
        openedAt: new Date().toISOString()
      });

      this.emit('order:placed', {
        accountId,
        symbol,
        side,
        volume,
        orderId: response.orderId,
        executionPrice: response.executionPrice
      });

      return {
        success: true,
        orderId: response.orderId,
        ticketNumber: response.orderId,
        executionPrice: response.executionPrice || price,
        commission: response.commission || 0,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      this.emit('order:error', {
        accountId,
        symbol,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Modify stop loss and take profit for open position
   * 
   * @param {string} accountId - MetaApi account ID
   * @param {string} ticketNumber - Position ticket
   * @param {number} stopLoss - New SL level
   * @param {number} takeProfit - New TP level
   * @returns {Promise<Object>} Modification result
   */
  async modifyPosition(accountId, ticketNumber, stopLoss, takeProfit) {
    try {
      const payload = {
        stopLoss: stopLoss,
        takeProfit: takeProfit
      };

      const response = await this._apiCall(
        'PUT',
        `/accounts/${accountId}/orders/${ticketNumber}`,
        payload
      );

      this.emit('position:modified', {
        accountId,
        ticketNumber,
        stopLoss,
        takeProfit
      });

      return {
        success: true,
        positionTicket: ticketNumber,
        newStopLoss: stopLoss,
        newTakeProfit: takeProfit,
        modifiedAt: new Date().toISOString()
      };
    } catch (error) {
      this.emit('position:error', {
        accountId,
        ticketNumber,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Close a position
   * 
   * @param {string} accountId - MetaApi account ID
   * @param {string} symbol - Symbol to close
   * @param {string} ticketNumber - Specific position to close (optional)
   * @returns {Promise<Object>} Close result
   */
  async closePosition(accountId, symbol, ticketNumber = null) {
    try {
      // Get positions for this symbol
      const positions = await this._getPositions(accountId, symbol);

      if (positions.length === 0) {
        return {
          success: false,
          error: `No open positions for ${symbol}`,
          symbol
        };
      }

      const position = ticketNumber
        ? positions.find(p => p.ticketNumber === ticketNumber)
        : positions[0];

      if (!position) {
        throw new Error(`Position ${ticketNumber} not found`);
      }

      // Create close order
      const closePayload = {
        actionType: position.side === 'BUY' ? 'ORDER_TYPE_SELL_BY_MARKET' : 'ORDER_TYPE_BUY_BY_MARKET',
        symbol: symbol,
        volume: position.volume,
        positionId: position.ticketNumber,
        comment: 'CopyTrading_Close'
      };

      const response = await this._apiCall(
        'POST',
        `/accounts/${accountId}/orders`,
        closePayload
      );

      // Remove from tracking
      this._untrackPosition(accountId, symbol, ticketNumber);

      this.emit('position:closed', {
        accountId,
        symbol,
        ticketNumber,
        closingPrice: response.executionPrice,
        pnl: position.profitLoss
      });

      return {
        success: true,
        symbol,
        ticketNumber,
        closingPrice: response.executionPrice,
        pnl: position.profitLoss || 0,
        closedAt: new Date().toISOString()
      };
    } catch (error) {
      this.emit('position:closeError', {
        accountId,
        symbol,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get open positions for a symbol
   * @private
   */
  async _getPositions(accountId, symbol) {
    try {
      const response = await this._apiCall(
        'GET',
        `/accounts/${accountId}/positions`,
        null,
        { symbol }
      );

      return response.positions || [];
    } catch (error) {
      this.logger.error(`Failed to fetch positions: ${error.message}`);
      return [];
    }
  }

  /**
   * Get current price for a symbol
   * @private
   */
  async _getSymbolPrice(accountId, symbol) {
    try {
      const response = await this._apiCall(
        'GET',
        `/accounts/${accountId}/symbols/${symbol}`,
      );

      return response.bid || response.ask || 0;
    } catch (error) {
      this.logger.warn(`Failed to get symbol price: ${error.message}`);
      return 0;
    }
  }

  /**
   * Validate symbol exists on account
   * @private
   */
  async _validateSymbol(accountId, symbol) {
    try {
      const response = await this._apiCall(
        'GET',
        `/accounts/${accountId}/symbols`,
        null,
        { name: symbol }
      );

      if (!response.symbols || response.symbols.length === 0) {
        throw new Error(`Symbol ${symbol} not available on this account`);
      }

      return true;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Make authenticated API call to MetaApi
   * @private
   */
  async _apiCall(method, path, data = null, params = null) {
    try {
      const config = {
        method,
        url: `${this.baseUrl}${path}`,
        headers: {
          'auth-token': this.apiKey,
          'Content-Type': 'application/json'
        }
      };

      if (data) {
        config.data = data;
      }

      if (params) {
        config.params = params;
      }

      const response = await axios(config);
      return response.data;
    } catch (error) {
      this.logger.error(`MetaApi call failed [${method} ${path}]: ${error.message}`);

      if (error.response?.status === 401) {
        throw new Error('Invalid MetaApi token');
      }
      if (error.response?.status === 404) {
        throw new Error(`Resource not found: ${path}`);
      }

      throw error;
    }
  }

  /**
   * Track open position
   * @private
   */
  _trackPosition(accountId, position) {
    if (!this.positionTracking[accountId]) {
      this.positionTracking[accountId] = [];
    }
    this.positionTracking[accountId].push(position);
  }

  /**
   * Remove position from tracking
   * @private
   */
  _untrackPosition(accountId, symbol, ticketNumber) {
    if (!this.positionTracking[accountId]) return;
    this.positionTracking[accountId] = this.positionTracking[accountId].filter(
      p => !(p.symbol === symbol && p.ticketNumber === ticketNumber)
    );
  }

  /**
   * Get all tracked positions for an account
   */
  getTrackedPositions(accountId) {
    return this.positionTracking[accountId] || [];
  }

  /**
   * Get account status
   */
  getAccountStatus(accountId) {
    return this.accounts[accountId] || null;
  }

  /**
   * List all connected accounts
   */
  getConnectedAccounts() {
    return Object.values(this.accounts);
  }
}

module.exports = MetaApiClient;
