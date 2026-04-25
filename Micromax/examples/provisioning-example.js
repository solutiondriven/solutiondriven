/**
 * Account Provisioning - Complete Example
 * Shows how to use the provisioning system end-to-end
 * 
 * Run this to test:
 * METAAPI_TOKEN=your_token node examples/provisioning-example.js
 */

const { MetaApiProvisioning } = require('../brokers/MetaApiProvisioning');

// ============================================
// SCENARIO 1: Direct Method (Quick)
// ============================================

async function scenario1_DirectMethod() {
  console.log('\n🎯 SCENARIO 1: Direct Method (User enters password)');
  console.log('='.repeat(60));

  const provisioning = new MetaApiProvisioning(process.env.METAAPI_TOKEN);

  try {
    // Step 1: Create account with password
    console.log('\n📝 Step 1: Creating account with user credentials...');
    const createResult = await provisioning.createAccountDirect({
      name: 'John Trader Account',
      login: '123456', // User's MT5 login
      password: 'password123', // User's MT5 password
      server: 'ICMarketsSC-Demo',
      platform: 'mt5'
    });

    if (!createResult.success) {
      console.error(`❌ Failed: ${createResult.error}`);
      return;
    }

    const accountId = createResult.accountId;
    console.log(`✅ Account created: ${accountId}`);
    console.log(`   Status: ${createResult.status}`);

    // Step 2: Wait for deployment
    console.log('\n📤 Step 2: Waiting for deployment...');
    const deployStatus = await provisioning.waitForDeployment(accountId);

    if (deployStatus.status === 'DEPLOYED') {
      console.log(`✅ Deployment complete!`);
      console.log(`   Account: ${accountId}`);
      console.log(`   Status: DEPLOYED`);
    } else {
      console.error(`❌ Deployment failed: ${deployStatus.error}`);
    }

    // Step 3: Get account stats
    console.log('\n💰 Step 3: Getting account stats...');
    const stats = await provisioning.getAccountStats(accountId);

    if (stats.success) {
      console.log(`✅ Account Stats:`);
      console.log(`   Balance: $${stats.balance}`);
      console.log(`   Equity: $${stats.equity}`);
      console.log(`   Currency: ${stats.currency}`);
      console.log(`   Leverage: 1:${stats.leverage}`);
    }

  } catch (error) {
    console.error(`💥 Error: ${error.message}`);
  }
}

// ============================================
// SCENARIO 2: Draft Mode (Secure)
// ============================================

async function scenario2_DraftMode() {
  console.log('\n🎯 SCENARIO 2: Draft Mode (Password on MetaApi\'s site)');
  console.log('='.repeat(60));

  const provisioning = new MetaApiProvisioning(process.env.METAAPI_TOKEN);

  try {
    // Step 1: Create account WITHOUT password
    console.log('\n📝 Step 1: Creating account (no password yet)...');
    const createResult = await provisioning.createAccountDraftMode({
      name: 'Secure Account',
      server: 'ICMarketsSC-Demo',
      platform: 'mt5'
    });

    if (!createResult.success) {
      console.error(`❌ Failed: ${createResult.error}`);
      return;
    }

    const accountId = createResult.accountId;
    const configLink = createResult.configurationLink;

    console.log(`✅ Account created: ${accountId}`);
    console.log(`   Status: DRAFT (waiting for password)`);
    console.log(`   Configuration Link:\n   ${configLink}`);
    console.log(`\n   👉 User should click this link and enter their password on MetaApi's site`);

    // Step 2: Simulate user completing on MetaApi's site
    console.log('\n⏳ Simulating user entering password on MetaApi...');
    await new Promise(r => setTimeout(r, 3000)); // Wait 3 seconds

    // Step 3: Check status (will be deploying now)
    console.log('\n📤 Step 3: Checking if account is deploying...');
    const statusCheck = await provisioning.getAccountStatus(accountId);
    console.log(`   Current status: ${statusCheck.status}`);

    if (statusCheck.status === 'DEPLOYING') {
      console.log(`   ✅ Account is deploying! Waiting...`);
      const deployStatus = await provisioning.waitForDeployment(accountId);

      if (deployStatus.status === 'DEPLOYED') {
        console.log(`   ✅ Deployment complete!`);
      }
    }

  } catch (error) {
    console.error(`💥 Error: ${error.message}`);
  }
}

// ============================================
// SCENARIO 3: Monitor Multiple Accounts
// ============================================

async function scenario3_MonitorMultiple() {
  console.log('\n🎯 SCENARIO 3: Monitor Multiple Accounts');
  console.log('='.repeat(60));

  const provisioning = new MetaApiProvisioning(process.env.METAAPI_TOKEN);

  try {
    console.log('\n📋 Fetching all accounts...');
    const listResult = await provisioning.listAccounts();

    if (!listResult.success) {
      console.error(`❌ Failed to list accounts: ${listResult.error}`);
      return;
    }

    const accounts = listResult.accounts;
    console.log(`✅ Found ${accounts.length} accounts:\n`);

    for (const account of accounts) {
      console.log(`📊 Account: ${account.name}`);
      console.log(`   ID: ${account.id}`);
      console.log(`   Login: ${account.login}`);
      console.log(`   Server: ${account.server}`);
      console.log(`   Status: ${account.state}`);

      // Get detailed stats if deployed
      if (account.state === 'DEPLOYED') {
        const stats = await provisioning.getAccountStats(account.id);
        if (stats.success) {
          console.log(`   Balance: $${stats.balance}`);
          console.log(`   Equity: $${stats.equity}`);
        }
      }
      console.log();
    }

  } catch (error) {
    console.error(`💥 Error: ${error.message}`);
  }
}

// ============================================
// SCENARIO 4: Verify Connection
// ============================================

async function scenario4_VerifyConnection() {
  console.log('\n🎯 SCENARIO 4: Verify Account Connection');
  console.log('='.repeat(60));

  const provisioning = new MetaApiProvisioning(process.env.METAAPI_TOKEN);

  try {
    // Use a known account ID from your system
    const accountId = process.env.TEST_ACCOUNT_ID || 'test_account_id_here';

    console.log(`\n🔍 Verifying account: ${accountId}`);
    const verifyResult = await provisioning.verifyConnection(accountId);

    if (verifyResult.connected) {
      console.log(`✅ Account is connected and ready!`);
      console.log(`   Status: ${verifyResult.status}`);
    } else {
      console.log(`⚠️  Account not ready`);
      console.log(`   Status: ${verifyResult.status}`);
      console.log(`   Message: ${verifyResult.message}`);
    }

  } catch (error) {
    console.error(`💥 Error: ${error.message}`);
  }
}

// ============================================
// MAIN: Run Selected Scenario
// ============================================

async function main() {
  // Check for token
  if (!process.env.METAAPI_TOKEN) {
    console.error('❌ METAAPI_TOKEN environment variable not set');
    console.error('   Set it: export METAAPI_TOKEN=your_token_here');
    process.exit(1);
  }

  console.log('🚀 Account Provisioning Examples');
  console.log('='.repeat(60));

  // Run scenarios
  const scenario = process.argv[2] || 'list';

  switch (scenario) {
    case '1':
    case 'direct':
      await scenario1_DirectMethod();
      break;

    case '2':
    case 'draft':
      await scenario2_DraftMode();
      break;

    case '3':
    case 'multiple':
      await scenario3_MonitorMultiple();
      break;

    case '4':
    case 'verify':
      await scenario4_VerifyConnection();
      break;

    case 'list':
    default:
      console.log('\n📚 Available Scenarios:\n');
      console.log('  1. Direct Method     - User enters password');
      console.log('  2. Draft Mode        - Secure link (recommended)');
      console.log('  3. Monitor Multiple  - List and check all accounts');
      console.log('  4. Verify Connection - Test if account is ready\n');
      console.log('Usage: node examples/provisioning-example.js [scenario]\n');
      console.log('Example:');
      console.log('  node examples/provisioning-example.js 1');
      console.log('  node examples/provisioning-example.js draft\n');
  }

  console.log('\n✅ Done!');
}

// Run
main().catch(error => {
  console.error(`💥 Fatal error: ${error.message}`);
  process.exit(1);
});
