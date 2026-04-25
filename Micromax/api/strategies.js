/**
 * Strategy Management API
 * Handles saving, loading, and managing user trading strategies
 */

const fs = require('fs');
const path = require('path');

const STRATEGIES_DIR = path.join(__dirname, '..', 'strategies', 'user_strategies');

// Ensure directory exists
if (!fs.existsSync(STRATEGIES_DIR)) {
  fs.mkdirSync(STRATEGIES_DIR, { recursive: true });
}

/**
 * Save strategy to file and potentially to database
 * @param {Object} strategy - Strategy object with name, code, rules, etc.
 * @param {string} userId - User ID
 * @returns {Object} Saved strategy with metadata
 */
function saveStrategy(strategy, userId) {
  try {
    const strategyId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const fileName = `${userId}_${strategy.name.replace(/\s+/g, '_')}_${strategyId}.json`;
    const filePath = path.join(STRATEGIES_DIR, fileName);

    const strategyData = {
      id: strategyId,
      userId,
      name: strategy.name,
      description: strategy.description,
      code: strategy.code,
      entryRules: strategy.entryRules || [],
      exitRules: strategy.exitRules || [],
      riskRules: strategy.riskRules || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'active',
    };

    fs.writeFileSync(filePath, JSON.stringify(strategyData, null, 2));

    console.log(`✅ Strategy saved: ${filePath}`);
    return strategyData;
  } catch (error) {
    console.error('Failed to save strategy:', error);
    throw new Error(`Failed to save strategy: ${error.message}`);
  }
}

/**
 * Load all strategies for a user
 * @param {string} userId - User ID
 * @returns {Array} Array of user strategies
 */
function loadUserStrategies(userId) {
  try {
    const files = fs.readdirSync(STRATEGIES_DIR);
    const userFiles = files.filter(f => f.startsWith(userId));

    const strategies = userFiles.map(fileName => {
      const filePath = path.join(STRATEGIES_DIR, fileName);
      const content = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(content);
    });

    return strategies;
  } catch (error) {
    console.error('Failed to load strategies:', error);
    return [];
  }
}

/**
 * Load a specific strategy
 * @param {string} strategyId - Strategy ID
 * @param {string} userId - User ID
 * @returns {Object} Strategy object
 */
function loadStrategy(strategyId, userId) {
  try {
    const files = fs.readdirSync(STRATEGIES_DIR);
    const strategyFile = files.find(f => f.includes(userId) && f.includes(strategyId));

    if (!strategyFile) {
      throw new Error('Strategy not found');
    }

    const filePath = path.join(STRATEGIES_DIR, strategyFile);
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    console.error('Failed to load strategy:', error);
    throw error;
  }
}

/**
 * Delete a strategy
 * @param {string} strategyId - Strategy ID
 * @param {string} userId - User ID
 * @returns {boolean} Success status
 */
function deleteStrategy(strategyId, userId) {
  try {
    const files = fs.readdirSync(STRATEGIES_DIR);
    const strategyFile = files.find(f => f.includes(userId) && f.includes(strategyId));

    if (!strategyFile) {
      throw new Error('Strategy not found');
    }

    const filePath = path.join(STRATEGIES_DIR, strategyFile);
    fs.unlinkSync(filePath);

    console.log(`✅ Strategy deleted: ${filePath}`);
    return true;
  } catch (error) {
    console.error('Failed to delete strategy:', error);
    throw error;
  }
}

/**
 * Update strategy
 * @param {string} strategyId - Strategy ID
 * @param {string} userId - User ID
 * @param {Object} updates - Fields to update
 * @returns {Object} Updated strategy
 */
function updateStrategy(strategyId, userId, updates) {
  try {
    let strategy = loadStrategy(strategyId, userId);

    strategy = {
      ...strategy,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    const fileName = Object.keys(fs.readdirSync(STRATEGIES_DIR)).find(
      f => f.includes(userId) && f.includes(strategyId)
    );

    const filePath = path.join(STRATEGIES_DIR, fileName);
    fs.writeFileSync(filePath, JSON.stringify(strategy, null, 2));

    console.log(`✅ Strategy updated: ${filePath}`);
    return strategy;
  } catch (error) {
    console.error('Failed to update strategy:', error);
    throw error;
  }
}

/**
 * Export strategy as JavaScript file
 * @param {Object} strategy - Strategy object
 * @returns {string} JavaScript code
 */
function generateStrategyCode(strategy) {
  return `// ${strategy.name}
// Generated: ${strategy.createdAt}
// Entry Rules: ${strategy.entryRules.join(', ')}
// Exit Rules: ${strategy.exitRules.join(', ')}
// Risk Rules: ${strategy.riskRules.join(', ')}

module.exports = {
  name: "${strategy.name}",
  description: "${strategy.description}",
  entryRules: ${JSON.stringify(strategy.entryRules, null, 2)},
  exitRules: ${JSON.stringify(strategy.exitRules, null, 2)},
  riskRules: ${JSON.stringify(strategy.riskRules, null, 2)},
  
  onTick(symbol, price, indicators, account) {
    // User-defined strategy logic
${strategy.code}
  },
  
  onEvent(event, data) {
    // Handle strategy events (trade executed, error, etc.)
    console.log(\`Strategy Event: \${event}\`, data);
  }
};
`;
}

module.exports = {
  saveStrategy,
  loadUserStrategies,
  loadStrategy,
  deleteStrategy,
  updateStrategy,
  generateStrategyCode,
  STRATEGIES_DIR,
};
