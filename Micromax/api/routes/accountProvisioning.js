/**
 * Account Provisioning API Routes
 * Express endpoints for MT5/MT4 account automation
 * 
 * Endpoints:
 * - POST /api/accounts/provision/direct
 * - POST /api/accounts/provision/draft
 * - GET /api/accounts/:accountId/status
 * - POST /api/accounts/:accountId/deploy
 * - GET /api/accounts/list
 */

const express = require('express');
const router = express.Router();

// Initialize MetaApi provisioning
const { MetaApiProvisioning } = require('../../brokers/MetaApiProvisioning');

let provisioning = null;

/**
 * Initialize provisioning service
 * Call this in your server startup
 */
function initializeMetaApiProvisioning(apiToken) {
  provisioning = new MetaApiProvisioning({ apiToken });
  console.log('✅ MetaApi provisioning initialized');
}

/**
 * Middleware to ensure provisioning is initialized
 */
function requireProvisioning(req, res, next) {
  if (!provisioning) {
    return res.status(503).json({
      success: false,
      error: 'Provisioning service not initialized'
    });
  }
  next();
}

// ============================================
// DIRECT METHOD - User enters password
// ============================================

/**
 * POST /api/accounts/provision/direct
 * Create account with direct password entry
 * 
 * Request body:
 * {
 *   fullName: string,
 *   mt5Login: string,
 *   mt5Password: string,
 *   mt5Server: string,
 *   userId?: string (for record-keeping)
 * }
 */
router.post('/provision/direct', requireProvisioning, async (req, res) => {
  try {
    const { fullName, mt5Login, mt5Password, mt5Server, userId } = req.body;

    // Validate inputs
    if (!fullName || !mt5Login || !mt5Password || !mt5Server) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: fullName, mt5Login, mt5Password, mt5Server'
      });
    }

    console.log(`📝 [${userId || 'anonymous'}] Provisioning direct account: ${fullName}`);

    // Create account via MetaApi
    const createResult = await provisioning.createAccountDirect({
      fullName,
      mt5Login,
      mt5Password,
      mt5Server
    });

    if (!createResult.success) {
      return res.status(400).json({
        success: false,
        error: createResult.error
      });
    }

    const accountId = createResult.accountId;

    // Store in database if you have one
    // await saveAccountToDatabase({
    //   accountId,
    //   userId,
    //   fullName,
    //   mt5Login,
    //   mt5Server,
    //   createdAt: new Date(),
    //   method: 'direct'
    // });

    res.status(201).json({
      success: true,
      accountId,
      status: 'DEPLOYING',
      message: 'Account created and deploying. Check status with GET /api/accounts/:accountId/status'
    });
  } catch (error) {
    console.error('❌ Direct provisioning error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Account provisioning failed'
    });
  }
});

// ============================================
// DRAFT MODE - Secure link (recommended)
// ============================================

/**
 * POST /api/accounts/provision/draft
 * Create account without password, return secure configuration link
 * 
 * Request body:
 * {
 *   fullName: string,
 *   mt5Server: string,
 *   userId?: string (for record-keeping)
 * }
 */
router.post('/provision/draft', requireProvisioning, async (req, res) => {
  try {
    const { fullName, mt5Server, userId } = req.body;

    if (!fullName || !mt5Server) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: fullName, mt5Server'
      });
    }

    console.log(`📝 [${userId || 'anonymous'}] Creating draft account: ${fullName}`);

    const createResult = await provisioning.createAccountDraftMode({
      fullName,
      mt5Server
    });

    if (!createResult.success) {
      return res.status(400).json({
        success: false,
        error: createResult.error
      });
    }

    const accountId = createResult.accountId;

    // Store draft account info
    // await saveAccountToDatabase({
    //   accountId,
    //   userId,
    //   fullName,
    //   mt5Server,
    //   createdAt: new Date(),
    //   method: 'draft',
    //   configurationLink: createResult.configurationLink
    // });

    res.status(201).json({
      success: true,
      accountId,
      configurationLink: createResult.configurationLink,
      message: 'Draft account created. User should click configurationLink to set password.',
      instructions: {
        step1: 'User opens the configurationLink',
        step2: 'User enters their MT5 login and password on MetaApi\'s secure site',
        step3: 'Account automatically deploys after password is set'
      }
    });
  } catch (error) {
    console.error('❌ Draft provisioning error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Draft account creation failed'
    });
  }
});

// ============================================
// GET ACCOUNT STATUS
// ============================================

/**
 * GET /api/accounts/:accountId/status
 * Check deployment status of an account
 * 
 * Returns:
 * {
 *   accountId: string,
 *   status: 'UNDEPLOYED' | 'DEPLOYING' | 'DEPLOYED' | 'ERROR',
 *   dataCenter?: string,
 *   estimatedLatency?: number,
 *   error?: string
 * }
 */
router.get('/:accountId/status', requireProvisioning, async (req, res) => {
  try {
    const { accountId } = req.params;

    const status = await provisioning.getAccountStatus(accountId);

    res.json({
      success: true,
      ...status
    });
  } catch (error) {
    console.error(`❌ Status check error for ${req.params.accountId}:`, error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================
// DEPLOY ACCOUNT
// ============================================

/**
 * POST /api/accounts/:accountId/deploy
 * Manually deploy an account (usually done automatically)
 */
router.post('/:accountId/deploy', requireProvisioning, async (req, res) => {
  try {
    const { accountId } = req.params;

    const deployResult = await provisioning.deployAccount(accountId);

    if (!deployResult.success) {
      return res.status(400).json({
        success: false,
        error: deployResult.error
      });
    }

    res.json({
      success: true,
      message: 'Account deployment initiated',
      status: 'DEPLOYING'
    });
  } catch (error) {
    console.error(`❌ Deploy error for ${req.params.accountId}:`, error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================
// VERIFY CONNECTION
// ============================================

/**
 * GET /api/accounts/:accountId/verify
 * Test if account is properly connected
 */
router.get('/:accountId/verify', requireProvisioning, async (req, res) => {
  try {
    const { accountId } = req.params;

    const verifyResult = await provisioning.verifyAccountConnection(accountId);

    res.json({
      success: verifyResult.success,
      connected: verifyResult.connected,
      error: verifyResult.error
    });
  } catch (error) {
    console.error(`❌ Verify error for ${req.params.accountId}:`, error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================
// GET ACCOUNT STATS
// ============================================

/**
 * GET /api/accounts/:accountId/stats
 * Get balance, equity, and other account info
 */
router.get('/:accountId/stats', requireProvisioning, async (req, res) => {
  try {
    const { accountId } = req.params;

    const stats = await provisioning.getAccountStats(accountId);

    res.json({
      success: stats.success,
      balance: stats.balance,
      equity: stats.equity,
      currency: stats.currency,
      error: stats.error
    });
  } catch (error) {
    console.error(`❌ Stats error for ${req.params.accountId}:`, error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================
// LIST ACCOUNTS
// ============================================

/**
 * GET /api/accounts/list
 * List all provisioned accounts
 */
router.get('/list', requireProvisioning, async (req, res) => {
  try {
    const listResult = await provisioning.listAccounts();

    if (!listResult.success) {
      return res.status(400).json({
        success: false,
        error: listResult.error
      });
    }

    res.json({
      success: true,
      accounts: listResult.accounts,
      count: listResult.accounts?.length || 0
    });
  } catch (error) {
    console.error('❌ List accounts error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================
// HEALTH CHECK
// ============================================

/**
 * GET /api/accounts/health
 * Check if provisioning service is available
 */
router.get('/health', (req, res) => {
  res.json({
    success: true,
    status: provisioning ? 'operational' : 'not_initialized',
    message: 'Account provisioning service'
  });
});

// Export router and initialization function
module.exports = {
  router,
  initializeMetaApiProvisioning
};
