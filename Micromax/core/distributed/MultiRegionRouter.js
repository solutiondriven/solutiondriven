/**
 * MultiRegionRouter
 * 
 * Intelligently routes trade signals and data ingestion requests to the
 * geographically closest regional cluster based on:
 * 1. Target exchange location
 * 2. Network latency metrics
 * 3. Previous regional performance
 * 
 * The "Speed of Light" Problem: Trading at light speed requires physical 
 * proximity to exchanges. Being 100ms closer can be the difference between 
 * a winning and losing trade.
 * 
 * Solution: Deploy regional adapters in US, EU, and APAC. Route each request
 * to the cluster closest to the target exchange.
 */

const axios = require('axios');
const { EventEmitter } = require('events');

class MultiRegionRouter extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.regions = {
      primary: {
        name: 'us-east-1',
        endpoint: process.env.MICROMAX_PRIMARY_ENDPOINT || 'https://primary.micromax.local',
        exchanges: ['NYSE', 'NASDAQ', 'BITMEX', 'BINANCE_US'],
        avgLatency: 0,
        healthStatus: 'healthy',
        lastCheck: Date.now()
      },
      europe: {
        name: 'eu-west-1',
        endpoint: process.env.MICROMAX_EUROPE_ENDPOINT || 'https://europe.micromax.local',
        exchanges: ['LSE', 'EUREX', 'BINANCE_EU', 'CRYPTO_EXCHANGES'],
        avgLatency: 0,
        healthStatus: 'healthy',
        lastCheck: Date.now()
      },
      apac: {
        name: 'ap-southeast-1',
        endpoint: process.env.MICROMAX_APAC_ENDPOINT || 'https://apac.micromax.local',
        exchanges: ['NSE', 'BINANCE_APAC', 'CRYPTO_ASIA', 'NIKKEI'],
        avgLatency: 0,
        healthStatus: 'healthy',
        lastCheck: Date.now()
      }
    };

    this.metrics = {
      requestsPerRegion: { primary: 0, europe: 0, apac: 0 },
      successPerRegion: { primary: 0, europe: 0, apac: 0 },
      failurePerRegion: { primary: 0, europe: 0, apac: 0 },
      latencyHistory: { primary: [], europe: [], apac: [] }
    };

    this.config = {
      latencyThreshold: config.latencyThreshold || 50,
      healthCheckInterval: config.healthCheckInterval || 30000,
      maxRetries: config.maxRetries || 2,
      circuitBreakerThreshold: config.circuitBreakerThreshold || 0.5, // 50% failure rate
      ...config
    };

    this.circuitBreakers = {
      primary: { open: false, failureCount: 0, successCount: 0 },
      europe: { open: false, failureCount: 0, successCount: 0 },
      apac: { open: false, failureCount: 0, successCount: 0 }
    };

    // Start health checks
    this.startHealthChecks();
  }

  /**
   * Route a request to the best available region
   * 
   * @param {string} exchange - Target exchange (e.g., 'BINANCE_US', 'NYSE')
   * @param {string} servicePath - API path (e.g., '/api/v1/signals')
   * @param {object} data - Request payload
   * @returns {Promise<object>} Response from regional service
   */
  async route(exchange, servicePath, data = {}) {
    const selectedRegion = this.selectRegion(exchange);
    
    const startTime = Date.now();
    
    try {
      const response = await this.executeRequest(
        selectedRegion,
        servicePath,
        data,
        0 // retry count
      );
      
      const latency = Date.now() - startTime;
      this.recordSuccess(selectedRegion, latency);
      
      this.emit('request-success', {
        region: selectedRegion,
        exchange,
        latency,
        timestamp: new Date().toISOString()
      });
      
      return response;
    } catch (error) {
      this.recordFailure(selectedRegion);
      
      this.emit('request-failure', {
        region: selectedRegion,
        exchange,
        error: error.message,
        timestamp: new Date().toISOString()
      });
      
      throw new Error(`Failed to reach ${exchange} via ${selectedRegion}: ${error.message}`);
    }
  }

  /**
   * Select the best region based on:
   * 1. Exchange location proximity
   * 2. Network latency
   * 3. Regional health status
   * 4. Circuit breaker state
   */
  selectRegion(exchange) {
    const candidates = this.getRegionCandidates(exchange);
    
    if (candidates.length === 0) {
      throw new Error(`No region available for exchange: ${exchange}`);
    }

    // Filter by circuit breaker state
    const healthyCandidates = candidates.filter(
      region => !this.circuitBreakers[region].open
    );

    if (healthyCandidates.length === 0) {
      console.warn('⚠️ All regions have circuit breakers open. Using candidate with lowest failure rate.');
      return candidates[0];
    }

    // Select region with lowest latency
    const selected = healthyCandidates.reduce((best, region) => {
      return this.regions[region].avgLatency < this.regions[best].avgLatency 
        ? region 
        : best;
    });

    return selected;
  }

  /**
   * Get candidate regions for an exchange
   * 
   * Example: BINANCE_US → [primary, europe, apac] (sorted by relevance)
   */
  getRegionCandidates(exchange) {
    const candidates = Object.entries(this.regions)
      .map(([key, region]) => ({
        key,
        relevance: region.exchanges.includes(exchange) ? 0 : 1,
        latency: this.regions[key].avgLatency
      }))
      .sort((a, b) => {
        // Primary sort: exchanges that handle this symbol (relevance 0 first)
        if (a.relevance !== b.relevance) return a.relevance - b.relevance;
        // Secondary sort: latency (lower is better)
        return a.latency - b.latency;
      })
      .map(item => item.key);

    return candidates;
  }

  /**
   * Execute request with automatic retry on failure
   */
  async executeRequest(region, servicePath, data, retryCount) {
    const regionConfig = this.regions[region];
    
    try {
      const response = await axios.post(
        `${regionConfig.endpoint}${servicePath}`,
        data,
        {
          timeout: 5000,
          headers: {
            'X-Region': region,
            'X-Request-ID': this.generateRequestId(),
            'Authorization': `Bearer ${process.env.MICROMAX_SERVICE_TOKEN}`,
            'Content-Type': 'application/json'
          }
        }
      );

      // Circuit breaker: record success
      this.resetCircuitBreaker(region);
      
      return response.data;
    } catch (error) {
      if (retryCount < this.config.maxRetries) {
        console.log(`⚠️  Retrying ${region} (attempt ${retryCount + 1}/${this.config.maxRetries})`);
        
        // Try next best region
        const nextRegion = this.getFailoverRegion(region);
        if (nextRegion) {
          return this.executeRequest(nextRegion, servicePath, data, retryCount + 1);
        }
      }

      throw error;
    }
  }

  /**
   * Get failover region if primary region fails
   */
  getFailoverRegion(failedRegion) {
    return Object.keys(this.regions)
      .filter(r => r !== failedRegion && !this.circuitBreakers[r].open)
      .sort((a, b) => this.regions[a].avgLatency - this.regions[b].avgLatency)[0];
  }

  /**
   * Circuit Breaker Pattern
   * If a region fails too often, stop sending requests to it temporarily
   */
  recordFailure(region) {
    this.metrics.failurePerRegion[region]++;
    this.metrics.requestsPerRegion[region]++;

    const cb = this.circuitBreakers[region];
    cb.failureCount++;
    cb.successCount = 0;

    const failureRate = cb.failureCount / (cb.failureCount + cb.successCount || 1);
    
    if (failureRate > this.config.circuitBreakerThreshold) {
      cb.open = true;
      console.error(`❌ Circuit breaker OPEN for ${region}. Failure rate: ${(failureRate * 100).toFixed(1)}%`);
      
      this.emit('circuit-breaker-open', { region, failureRate });
      
      // Auto-recover after 60 seconds
      setTimeout(() => {
        cb.failureCount = 0;
        cb.successCount = 0;
        cb.open = false;
        console.log(`✅ Circuit breaker CLOSED for ${region}. Attempting recovery.`);
      }, 60000);
    }
  }

  recordSuccess(region, latency) {
    this.metrics.successPerRegion[region]++;
    this.metrics.requestsPerRegion[region]++;
    
    // Update rolling average latency
    const history = this.metrics.latencyHistory[region];
    history.push(latency);
    if (history.length > 100) history.shift(); // Keep last 100 measurements
    
    this.regions[region].avgLatency = 
      history.reduce((a, b) => a + b, 0) / history.length;

    // Reset circuit breaker on success
    this.resetCircuitBreaker(region);
  }

  resetCircuitBreaker(region) {
    const cb = this.circuitBreakers[region];
    cb.successCount++;
    
    if (cb.successCount > 5) {
      cb.failureCount = 0;
      cb.successCount = 0;
    }
  }

  /**
   * Health Check: Verify regional endpoints are responding
   */
  startHealthChecks() {
    this.healthCheckInterval = setInterval(() => {
      this.checkRegionalHealth();
    }, this.config.healthCheckInterval);
  }

  async checkRegionalHealth() {
    for (const [region, config] of Object.entries(this.regions)) {
      try {
        const startTime = Date.now();
        const response = await axios.get(
          `${config.endpoint}/health`,
          { timeout: 3000 }
        );
        
        const latency = Date.now() - startTime;
        
        if (response.status === 200) {
          config.healthStatus = 'healthy';
          config.lastCheck = Date.now();
          
          // Update latency from health check
          this.metrics.latencyHistory[region].push(latency);
          if (this.metrics.latencyHistory[region].length > 100) {
            this.metrics.latencyHistory[region].shift();
          }
          
          if (this.metrics.latencyHistory[region].length > 0) {
            config.avgLatency = 
              this.metrics.latencyHistory[region].reduce((a, b) => a + b, 0) / 
              this.metrics.latencyHistory[region].length;
          }
          
          this.emit('region-healthy', { region, latency });
        }
      } catch (error) {
        config.healthStatus = 'unhealthy';
        config.lastCheck = Date.now();
        
        this.emit('region-unhealthy', { 
          region, 
          error: error.message 
        });
      }
    }
  }

  /**
   * Get routing metrics for monitoring
   */
  getMetrics() {
    return {
      timestamp: new Date().toISOString(),
      regions: Object.entries(this.regions).map(([key, region]) => ({
        name: key,
        endpoint: region.endpoint,
        health: region.healthStatus,
        avgLatency: Math.round(region.avgLatency * 100) / 100,
        lastCheck: new Date(region.lastCheck).toISOString(),
        exchanges: region.exchanges
      })),
      traffic: {
        total: Object.values(this.metrics.requestsPerRegion).reduce((a, b) => a + b, 0),
        byRegion: this.metrics.requestsPerRegion
      },
      success: {
        byRegion: this.metrics.successPerRegion,
        successRate: this.calculateSuccessRate()
      },
      circuitBreakers: Object.entries(this.circuitBreakers).reduce((acc, [key, cb]) => {
        acc[key] = { open: cb.open };
        return acc;
      }, {})
    };
  }

  calculateSuccessRate() {
    const total = Object.values(this.metrics.successPerRegion).reduce((a, b) => a + b, 0) +
                  Object.values(this.metrics.failurePerRegion).reduce((a, b) => a + b, 0);
    
    if (total === 0) return 100;
    
    const successes = Object.values(this.metrics.successPerRegion).reduce((a, b) => a + b, 0);
    return Math.round((successes / total) * 10000) / 100;
  }

  generateRequestId() {
    return `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Clean up resources
   */
  destroy() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    this.removeAllListeners();
  }
}

module.exports = MultiRegionRouter;
