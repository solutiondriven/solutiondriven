/**
 * Execution Monitoring & Latency Tracker
 * Real-time performance metrics, latency analysis, and alerting
 * Measures: order-to-fill time, slippage, execution rate, failures
 */

const EventEmitter = require('events');

class ExecutionMonitor extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.metricsWindow = options.metricsWindow || 3600000; // 1 hour
    this.alertThresholds = options.alertThresholds || {
      latencyP95: 500, // ms
      latencyP99: 1000, // ms
      failureRate: 0.05, // 5%
      slippageBps: 50 // 50 basis points
    };

    this.executions = []; // Raw execution data
    this.latencies = {}; // Latencies per broker
    this.slippages = {}; // Slippages per broker
    this.failures = [];
    this.alerts = [];
    
    this.startTime = Date.now();
  }

  /**
   * Record an execution with full context
   * Called by ExecutionWrapper after each trade
   * 
   * @param {Object} execution - {executionId, signal_id, follower_id, broker, status, latency, details}
   */
  recordExecution(execution) {
    // Add timestamp if not present
    if (!execution.timestamp) {
      execution.timestamp = new Date().toISOString();
    }

    this.executions.push(execution);

    // Track latency
    if (execution.latency) {
      this._recordLatency(execution.broker, execution.latency);
    }

    // Track slippage if available
    if (execution.details && execution.details.slippage !== undefined) {
      this._recordSlippage(execution.broker, execution.details.slippage);
    }

    // Track failures
    if (execution.status !== 'SUCCESS') {
      this.failures.push(execution);
    }

    // Check thresholds and generate alerts
    this._checkThresholds(execution);

    this.emit('execution:recorded', execution);
  }

  /**
   * Get real-time metrics dashboard
   * @returns {Object} Current performance metrics
   */
  getMetrics() {
    const recentExecutions = this._getRecentExecutions();
    const totalExecutions = recentExecutions.length;
    
    if (totalExecutions === 0) {
      return {
        uptime: this._getUptime(),
        executions: 0,
        message: 'No executions in the current window'
      };
    }

    const successful = recentExecutions.filter(e => e.status === 'SUCCESS').length;
    const failed = recentExecutions.filter(e => e.status !== 'SUCCESS').length;

    return {
      uptime: this._getUptime(),
      period: `Last ${this.metricsWindow / 1000 / 60} minutes`,
      
      // Execution stats
      total_executions: totalExecutions,
      successful_executions: successful,
      failed_executions: failed,
      success_rate: ((successful / totalExecutions) * 100).toFixed(2) + '%',
      
      // Latency stats
      latency: this._getLatencyStats(recentExecutions),
      
      // Slippage stats
      slippage: this._getSlippageStats(recentExecutions),
      
      // Per-broker breakdown
      broker_breakdown: this._getBrokerBreakdown(recentExecutions),
      
      // Alerts
      active_alerts: this.alerts.length,
      recent_alerts: this.alerts.slice(-5)
    };
  }

  /**
   * Get detailed latency analysis
   * @returns {Object} Latency breakdown by percentile
   */
  getLatencyAnalysis() {
    const recentExecutions = this._getRecentExecutions();
    const latencies = recentExecutions
      .filter(e => e.latency !== undefined)
      .map(e => e.latency)
      .sort((a, b) => a - b);

    if (latencies.length === 0) {
      return { executions: 0, message: 'No latency data available' };
    }

    return {
      sample_size: latencies.length,
      min: latencies[0].toFixed(2),
      max: latencies[latencies.length - 1].toFixed(2),
      mean: (latencies.reduce((a, b) => a + b, 0) / latencies.length).toFixed(2),
      median: this._percentile(latencies, 50).toFixed(2),
      p75: this._percentile(latencies, 75).toFixed(2),
      p95: this._percentile(latencies, 95).toFixed(2),
      p99: this._percentile(latencies, 99).toFixed(2),
      p999: this._percentile(latencies, 99.9).toFixed(2),
      stddev: this._standardDeviation(latencies).toFixed(2),
      
      // Alert level
      p95_alert: this._percentile(latencies, 95) > this.alertThresholds.latencyP95
        ? '⚠️ EXCEEDS THRESHOLD'
        : '✅ OK'
    };
  }

  /**
   * Get slippage analysis
   * Critical for measuring execution quality
   * @returns {Object} Slippage breakdown
   */
  getSlippageAnalysis() {
    const recentExecutions = this._getRecentExecutions();
    const slippages = recentExecutions
      .filter(e => e.details && e.details.slippage !== undefined)
      .map(e => e.details.slippage)
      .sort((a, b) => a - b);

    if (slippages.length === 0) {
      return { 
        samples: 0,
        message: 'No slippage data available (add slippage calculation in ExecutionWrapper)' 
      };
    }

    return {
      sample_size: slippages.length,
      min_bps: slippages[0].toFixed(2),
      max_bps: slippages[slippages.length - 1].toFixed(2),
      avg_bps: (slippages.reduce((a, b) => a + b, 0) / slippages.length).toFixed(2),
      median_bps: this._percentile(slippages, 50).toFixed(2),
      p95_bps: this._percentile(slippages, 95).toFixed(2),
      
      threshold_bps: this.alertThresholds.slippageBps,
      alert: this._percentile(slippages, 95) > this.alertThresholds.slippageBps
        ? '⚠️ Slippage exceeds target'
        : '✅ Slippage within target'
    };
  }

  /**
   * Get broker-specific performance
   * @param {string} broker - Broker name (optional, get all if not specified)
   */
  getBrokerPerformance(broker = null) {
    const recentExecutions = this._getRecentExecutions();
    const filtered = broker
      ? recentExecutions.filter(e => e.broker === broker)
      : recentExecutions;

    if (filtered.length === 0) {
      return { 
        message: broker 
          ? `No executions for ${broker}` 
          : 'No executions in window'
      };
    }

    const brokerGroups = {};
    filtered.forEach(exec => {
      const b = exec.broker;
      if (!brokerGroups[b]) {
        brokerGroups[b] = [];
      }
      brokerGroups[b].push(exec);
    });

    return Object.entries(brokerGroups).reduce((acc, [brokerName, executions]) => {
      const successful = executions.filter(e => e.status === 'SUCCESS').length;
      const latencies = executions
        .filter(e => e.latency)
        .map(e => e.latency)
        .sort((a, b) => a - b);

      acc[brokerName] = {
        executions: executions.length,
        successful: successful,
        failed: executions.length - successful,
        success_rate: ((successful / executions.length) * 100).toFixed(2) + '%',
        avg_latency_ms: latencies.length > 0
          ? (latencies.reduce((a, b) => a + b, 0) / latencies.length).toFixed(2)
          : 'N/A',
        p95_latency_ms: latencies.length > 0
          ? this._percentile(latencies, 95).toFixed(2)
          : 'N/A',
        last_execution: executions[executions.length - 1].timestamp
      };

      return acc;
    }, {});
  }

  /**
   * Get failure details for debugging
   */
  getFailureAnalysis(limit = 10) {
    const recentFailures = this.failures
      .filter(f => this._isInWindow(new Date(f.timestamp).getTime()))
      .slice(-limit);

    return {
      total_failures_in_window: recentFailures.length,
      failure_rate: ((recentFailures.length / this.executions.length) * 100).toFixed(2) + '%',
      recent_failures: recentFailures.map(f => ({
        executionId: f.executionId,
        signal_id: f.signal_id,
        follower_id: f.follower_id,
        broker: f.broker,
        error: f.error || f.details?.error,
        timestamp: f.timestamp
      }))
    };
  }

  /**
   * Get current active alerts
   */
  getAlerts() {
    const currentTime = Date.now();
    // Keep alerts from last 30 minutes
    this.alerts = this.alerts.filter(a => currentTime - a.timestamp < 1800000);

    return {
      total_active: this.alerts.length,
      alerts: this.alerts.map(a => ({
        type: a.type,
        severity: a.severity,
        message: a.message,
        details: a.details,
        timestamp: new Date(a.timestamp).toISOString()
      }))
    };
  }

  /**
   * Stream real-time execution events
   * Useful for dashboards
   */
  onRealTimeUpdate(callback) {
    this.on('execution:recorded', callback);
  }

  /**
   * Export metrics to JSON
   */
  exportMetrics() {
    return {
      timestamp: new Date().toISOString(),
      uptime_minutes: (Date.now() - this.startTime) / 1000 / 60,
      summary: this.getMetrics(),
      latency_analysis: this.getLatencyAnalysis(),
      slippage_analysis: this.getSlippageAnalysis(),
      broker_performance: this.getBrokerPerformance(),
      failures: this.getFailureAnalysis(),
      alerts: this.getAlerts(),
      total_executions: this.executions.length,
      total_failures: this.failures.length
    };
  }

  // ============ PRIVATE HELPERS ============

  _recordLatency(broker, latency) {
    if (!this.latencies[broker]) {
      this.latencies[broker] = [];
    }
    this.latencies[broker].push(latency);
  }

  _recordSlippage(broker, slippage) {
    if (!this.slippages[broker]) {
      this.slippages[broker] = [];
    }
    this.slippages[broker].push(slippage);
  }

  _getRecentExecutions() {
    const now = Date.now();
    return this.executions.filter(e => 
      now - new Date(e.timestamp).getTime() < this.metricsWindow
    );
  }

  _isInWindow(timestamp) {
    return Date.now() - timestamp < this.metricsWindow;
  }

  _checkThresholds(execution) {
    const alerts = [];

    // Latency threshold
    if (execution.latency > this.alertThresholds.latencyP95) {
      alerts.push({
        type: 'LATENCY_HIGH',
        severity: 'warning',
        message: `High latency: ${execution.latency}ms (threshold: ${this.alertThresholds.latencyP95}ms)`,
        details: { broker: execution.broker, latency: execution.latency }
      });
    }

    // Failure threshold check
    const recent = this._getRecentExecutions();
    const failureRate = recent.filter(e => e.status !== 'SUCCESS').length / recent.length;
    if (failureRate > this.alertThresholds.failureRate) {
      alerts.push({
        type: 'FAILURE_RATE_HIGH',
        severity: 'error',
        message: `High failure rate: ${(failureRate * 100).toFixed(2)}% (threshold: ${(this.alertThresholds.failureRate * 100).toFixed(2)}%)`,
        details: { failureRate }
      });
    }

    // Slippage threshold
    if (execution.details && execution.details.slippage > this.alertThresholds.slippageBps) {
      alerts.push({
        type: 'SLIPPAGE_HIGH',
        severity: 'warning',
        message: `High slippage: ${execution.details.slippage.toFixed(2)} bps (threshold: ${this.alertThresholds.slippageBps} bps)`,
        details: { slippage: execution.details.slippage }
      });
    }

    alerts.forEach(alert => {
      alert.timestamp = Date.now();
      this.alerts.push(alert);
      this.emit('alert', alert);
    });
  }

  _getLatencyStats(executions) {
    const latencies = executions
      .filter(e => e.latency !== undefined)
      .map(e => e.latency)
      .sort((a, b) => a - b);

    if (latencies.length === 0) return { message: 'No latency data' };

    return {
      p50_ms: this._percentile(latencies, 50).toFixed(2),
      p95_ms: this._percentile(latencies, 95).toFixed(2),
      p99_ms: this._percentile(latencies, 99).toFixed(2),
      avg_ms: (latencies.reduce((a, b) => a + b, 0) / latencies.length).toFixed(2)
    };
  }

  _getSlippageStats(executions) {
    const slippages = executions
      .filter(e => e.details && e.details.slippage !== undefined)
      .map(e => e.details.slippage)
      .sort((a, b) => a - b);

    if (slippages.length === 0) return { message: 'No slippage data' };

    return {
      avg_bps: (slippages.reduce((a, b) => a + b, 0) / slippages.length).toFixed(2),
      p95_bps: this._percentile(slippages, 95).toFixed(2)
    };
  }

  _getBrokerBreakdown(executions) {
    const breakdown = {};

    executions.forEach(exec => {
      if (!breakdown[exec.broker]) {
        breakdown[exec.broker] = { successful: 0, failed: 0 };
      }
      if (exec.status === 'SUCCESS') {
        breakdown[exec.broker].successful++;
      } else {
        breakdown[exec.broker].failed++;
      }
    });

    return Object.entries(breakdown).reduce((acc, [broker, counts]) => {
      const total = counts.successful + counts.failed;
      acc[broker] = {
        total: total,
        successful: counts.successful,
        failed: counts.failed,
        success_rate: ((counts.successful / total) * 100).toFixed(2) + '%'
      };
      return acc;
    }, {});
  }

  _percentile(sortedArray, p) {
    const index = Math.ceil((p / 100) * sortedArray.length) - 1;
    return sortedArray[Math.max(0, index)];
  }

  _standardDeviation(values) {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
    const variance = squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
    return Math.sqrt(variance);
  }

  _getUptime() {
    const uptimeMs = Date.now() - this.startTime;
    const hours = Math.floor(uptimeMs / 3600000);
    const minutes = Math.floor((uptimeMs % 3600000) / 60000);
    return `${hours}h ${minutes}m`;
  }
}

module.exports = ExecutionMonitor;
