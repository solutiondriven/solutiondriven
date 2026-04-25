/**
 * MetaApi Account Provisioning Service
 * Frontend service that calls backend API to provision MT5 accounts
 * 
 * Calls our backend endpoints:
 * - POST /api/accounts/provision/draft
 * - POST /api/accounts/provision/direct
 * - GET /api/accounts/:id/status
 */

const API_BASE = 'http://localhost:3000/api/accounts';

export interface AccountStatus {
  accountId: string;
  status: 'UNDEPLOYED' | 'DEPLOYING' | 'DEPLOYED' | 'DISCONNECTED' | 'ERROR';
  dataCenter?: string;
  estimatedLatency?: number;
  error?: string;
}

export class MetaApiAccountProvisioning {
  constructor() {
    // No config needed - we just call the backend
  }

  /**
   * Create account using Draft Mode (RECOMMENDED)
   * - User only enters name + server
   * - Gets secure link to enter password on MetaApi's official site
   * - Maximum security, better trust
   */
  async createAccountDraftMode(userData: {
    fullName: string;
    mt5Server: string;
    userId?: string;
  }): Promise<{
    success: boolean;
    accountId?: string;
    configurationLink?: string;
    error?: string;
  }> {
    try {
      const response = await fetch(`${API_BASE}/provision/draft`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: userData.fullName,
          mt5Server: userData.mt5Server,
          userId: userData.userId || 'guest'
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create account');
      }

      return {
        success: true,
        accountId: data.accountId,
        configurationLink: data.configurationLink
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to create account'
      };
    }
  }

  /**
   * Create account using Direct Method
   * - User enters password in your form
   * - Your backend sends to MetaApi, then forgets password
   * - Faster, but requires trust
   */
  async createAccountDirect(userData: {
    fullName: string;
    mt5Login: string;
    mt5Password: string;
    mt5Server: string;
    userId?: string;
  }): Promise<{
    success: boolean;
    accountId?: string;
    error?: string;
  }> {
    try {
      const response = await fetch(`${API_BASE}/provision/direct`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: userData.fullName,
          mt5Login: userData.mt5Login,
          mt5Password: userData.mt5Password,
          mt5Server: userData.mt5Server,
          userId: userData.userId || 'guest'
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create account');
      }

      return {
        success: true,
        accountId: data.accountId
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to create account'
      };
    }
  }

  /**
   * Get account status
   */
  async getAccountStatus(accountId: string): Promise<AccountStatus> {
    try {
      const response = await fetch(`${API_BASE}/${accountId}/status`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to get status');
      }

      return {
        accountId: data.accountId,
        status: data.status,
        dataCenter: data.dataCenter,
        estimatedLatency: data.estimatedLatency,
        error: data.error
      };
    } catch (error: any) {
      return {
        accountId,
        status: 'ERROR' as const,
        error: error.message
      };
    }
  }

  /**
   * Wait for deployment
   */
  async waitForDeployment(
    accountId: string,
    maxWaitSeconds: number = 120,
    onProgress?: (status: AccountStatus) => void
  ): Promise<AccountStatus> {
    const startTime = Date.now();
    const maxWaitMs = maxWaitSeconds * 1000;

    while (Date.now() - startTime < maxWaitMs) {
      const status = await this.getAccountStatus(accountId);
      
      if (onProgress) {
        onProgress(status);
      }

      if (status.status === 'DEPLOYED') {
        return status;
      }

      if (status.status === 'ERROR') {
        throw new Error(status.error || 'Deployment failed');
      }

      // Wait 2 seconds before checking again
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    throw new Error('Deployment timeout');
  }

  /**
   * List all accounts
   */
  async listAccounts(): Promise<AccountStatus[]> {
    try {
      const response = await fetch(`${API_BASE}/list`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to list accounts');
      }

      return data.accounts || [];
    } catch (error: any) {
      console.error('Failed to list accounts:', error.message);
      return [];
    }
  }
}

// Singleton instance
let provisioning: MetaApiAccountProvisioning | null = null;

export function initializeProvisioning() {
  if (!provisioning) {
    provisioning = new MetaApiAccountProvisioning();
  }
  return provisioning;
}

export function getProvisioning(): MetaApiAccountProvisioning {
  if (!provisioning) {
    provisioning = new MetaApiAccountProvisioning();
  }
  return provisioning;
}

interface ProvisioningConfig {
  baseUrl?: string;
}

interface CreateAccountRequest {
  name: string;
  login: string;
  password?: string;
  server: string;
  platform: 'mt5' | 'mt4';
  type?: 'cloud';
  reliability?: 'high' | 'regular';
  quoteStreamingIntervalInSeconds?: number;
}

interface CreateAccountResponse {
  id: string;
  name: string;
  login: string;
  server: string;
  platform: string;
  state: 'UNDEPLOYED' | 'DEPLOYING' | 'DEPLOYED' | 'DISCONNECTED';
  type: string;
  configuration: {
    login: string;
    password: string;
    server: string;
    magic: number;
    quoteStreamingIntervalInSeconds: number;
  };
  configurationLink?: string; // For draft mode
  createdAt: string;
}

interface AccountStatus {
  accountId: string;
  status: 'UNDEPLOYED' | 'DEPLOYING' | 'DEPLOYED' | 'DISCONNECTED' | 'ERROR';
  dataCenter?: string;
  estimatedLatency?: number;
  lastSyncTime?: string;
  error?: string;
}

export class MetaApiAccountProvisioning {
  private apiToken: string;
  private baseUrl: string;
  private metatraderAccountApi: any;

  constructor(config: ProvisioningConfig) {
    this.apiToken = config.apiToken;
    this.baseUrl = config.baseUrl || 'https://api.metaapi.cloud/v1';
  }

  /**
   * Create account using Direct Method
   * User provides their MT5 password - you send it directly to MetaApi
   * ⚠️ Be cautious with password handling
   */
  async createAccountDirect(userData: {
    fullName: string;
    mt5Login: string;
    mt5Password: string;
    mt5Server: string;
  }): Promise<{ success: boolean; accountId?: string; error?: string }> {
    try {
      console.log(`📝 Creating account for ${userData.fullName}...`);

      const accountData: CreateAccountRequest = {
        name: userData.fullName,
        login: userData.mt5Login,
        password: userData.mt5Password,
        server: userData.mt5Server,
        platform: 'mt5',
        type: 'cloud',
        reliability: 'high',
        quoteStreamingIntervalInSeconds: 0, // Real-time
      };

      // POST to MetaApi
      const response = await this._apiCall('POST', '/accounts', accountData);

      if (!response.id) {
        return {
          success: false,
          error: 'No account ID returned from MetaApi'
        };
      }

      const accountId = response.id;
      console.log(`✅ Account created: ${accountId}`);

      // Deploy the account
      console.log(`📤 Deploying account to cloud...`);
      await this._apiCall('POST', `/accounts/${accountId}/deploy`);

      return {
        success: true,
        accountId
      };
    } catch (error: any) {
      console.error('❌ Account creation failed:', error.message);
      return {
        success: false,
        error: error.message || 'Failed to create account'
      };
    }
  }

  /**
   * Create account using Draft Mode
   * You create the account WITHOUT password
   * User gets a secure link to enter password on MetaApi's official site
   * Much more secure! Builds trust with users.
   */
  async createAccountDraftMode(userData: {
    fullName: string;
    mt5Server: string;
  }): Promise<{
    success: boolean;
    accountId?: string;
    configurationLink?: string;
    error?: string;
  }> {
    try {
      console.log(`📝 Creating draft account for ${userData.fullName}...`);

      // Create account WITHOUT password (can't login yet)
      const accountData = {
        name: userData.fullName,
        server: userData.mt5Server,
        platform: 'mt5',
        type: 'cloud',
        reliability: 'high',
        quoteStreamingIntervalInSeconds: 0,
        // NO PASSWORD - this is the key difference
      };

      const response = await this._apiCall('POST', '/accounts', accountData);

      if (!response.id) {
        return {
          success: false,
          error: 'No account ID returned'
        };
      }

      const accountId = response.id;
      console.log(`✅ Draft account created: ${accountId}`);

      // Get the configuration link (secure password entry URL)
      const configLink = response.configurationLink;

      if (!configLink) {
        console.warn('⚠️ No configuration link provided');
      }

      return {
        success: true,
        accountId,
        configurationLink: configLink
      };
    } catch (error: any) {
      console.error('❌ Draft account creation failed:', error.message);
      return {
        success: false,
        error: error.message || 'Failed to create draft account'
      };
    }
  }

  /**
   * Deploy an account (puts it into active state)
   */
  async deployAccount(accountId: string): Promise<{
    success: boolean;
    status?: string;
    error?: string;
  }> {
    try {
      console.log(`📤 Deploying account ${accountId}...`);

      await this._apiCall('POST', `/accounts/${accountId}/deploy`);

      return {
        success: true,
        status: 'Account is now deploying to cloud servers...'
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get account status (polling for deployment progress)
   */
  async getAccountStatus(accountId: string): Promise<AccountStatus> {
    try {
      const response = await this._apiCall('GET', `/accounts/${accountId}`);

      const status: AccountStatus = {
        accountId,
        status: response.state || 'ERROR'
      };

      // Map MetaApi states to our states
      if (response.state === 'DEPLOYED') {
        status.dataCenter = 'London (LD4)'; // Example
        status.estimatedLatency = 22; // Placeholder - would come from actual data
      }

      if (response.state === 'DEPLOYED' && response.lastSyncTime) {
        status.lastSyncTime = response.lastSyncTime;
      }

      return status;
    } catch (error: any) {
      return {
        accountId,
        status: 'ERROR',
        error: error.message
      };
    }
  }

  /**
   * Update account with password (for draft mode completion)
   */
  async updateAccountPassword(
    accountId: string,
    password: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await this._apiCall('PUT', `/accounts/${accountId}`, {
        password
      });

      return { success: true };
    } catch (error: any) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Verify account can connect (test the credentials)
   */
  async verifyAccountConnection(accountId: string): Promise<{
    success: boolean;
    connected: boolean;
    error?: string;
  }> {
    try {
      const status = await this.getAccountStatus(accountId);

      if (status.status === 'DEPLOYED') {
        return {
          success: true,
          connected: true
        };
      }

      return {
        success: true,
        connected: false,
        error: `Account status: ${status.status}`
      };
    } catch (error: any) {
      return {
        success: false,
        connected: false,
        error: error.message
      };
    }
  }

  /**
   * Get account trading statistics
   */
  async getAccountStats(accountId: string): Promise<{
    success: boolean;
    balance?: number;
    equity?: number;
    currency?: string;
    error?: string;
  }> {
    try {
      const response = await this._apiCall('GET', `/accounts/${accountId}/summary`);

      return {
        success: true,
        balance: response.balance,
        equity: response.equity,
        currency: response.currency
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Poll for deployment status (useful for UI loading state)
   * Returns when account reaches DEPLOYED or ERROR state
   */
  async waitForDeployment(
    accountId: string,
    maxWaitMs: number = 120000 // 2 minutes
  ): Promise<AccountStatus> {
    const startTime = Date.now();
    const pollInterval = 3000; // Check every 3 seconds

    while (Date.now() - startTime < maxWaitMs) {
      const status = await this.getAccountStatus(accountId);

      if (status.status === 'DEPLOYED') {
        console.log(`✅ Account deployed: ${accountId}`);
        return status;
      }

      if (status.status === 'ERROR') {
        console.error(`❌ Deployment failed: ${status.error}`);
        return status;
      }

      // Still deploying, wait and try again
      console.log(`⏳ Deploying... (${status.status})`);
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    // Timeout
    return {
      accountId,
      status: 'ERROR',
      error: 'Deployment timeout - took longer than 2 minutes'
    };
  }

  /**
   * Poll account status with callback for UI updates
   */
  async monitorDeployment(
    accountId: string,
    onStatusChange: (status: AccountStatus) => void,
    maxWaitMs: number = 120000
  ): Promise<AccountStatus> {
    const startTime = Date.now();
    const pollInterval = 2000; // Check every 2 seconds

    while (Date.now() - startTime < maxWaitMs) {
      const status = await this.getAccountStatus(accountId);
      onStatusChange(status);

      if (status.status === 'DEPLOYED' || status.status === 'ERROR') {
        return status;
      }

      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    const timeoutStatus: AccountStatus = {
      accountId,
      status: 'ERROR',
      error: 'Deployment timeout'
    };
    onStatusChange(timeoutStatus);
    return timeoutStatus;
  }

  /**
   * List all accounts for a user
   */
  async listAccounts(): Promise<{
    success: boolean;
    accounts?: Array<{
      id: string;
      name: string;
      state: string;
      login: string;
    }>;
    error?: string;
  }> {
    try {
      const response = await this._apiCall('GET', '/accounts');

      return {
        success: true,
        accounts: response.accounts || []
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  // ============ PRIVATE HELPERS ============

  private async _apiCall(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    path: string,
    data?: any
  ): Promise<any> {
    try {
      const config: any = {
        method,
        url: `${this.baseUrl}${path}`,
        headers: {
          'auth-token': this.apiToken,
          'Content-Type': 'application/json'
        }
      };

      if (data) {
        config.data = data;
      }

      const response = await axios(config);
      return response.data;
    } catch (error: any) {
      const message = error.response?.data?.message || error.message;

      if (error.response?.status === 401) {
        throw new Error('Invalid MetaApi token');
      }
      if (error.response?.status === 404) {
        throw new Error(`Resource not found: ${path}`);
      }
      if (error.response?.status === 400) {
        throw new Error(`Invalid request: ${message}`);
      }

      throw new Error(message || 'API call failed');
    }
  }
}

// Export singleton instance
let provisioningInstance: MetaApiAccountProvisioning | null = null;

export function initializeProvisioning(apiToken: string): MetaApiAccountProvisioning {
  provisioningInstance = new MetaApiAccountProvisioning({ apiToken });
  return provisioningInstance;
}

export function getProvisioning(): MetaApiAccountProvisioning {
  if (!provisioningInstance) {
    throw new Error('Provisioning service not initialized. Call initializeProvisioning() first.');
  }
  return provisioningInstance;
}
