/**
 * MetaApi Provisioning Service for Node.js Backend
 *
 * Server-side account provisioning wrapper with:
 * - consistent field mapping for router/frontend payloads
 * - optional retry for local TLS interception issues
 * - convenience aliases used by the API routes
 */

const axios = require('axios');
const https = require('https');
const crypto = require('crypto');

class MetaApiProvisioning {
  constructor(config) {
    const normalizedConfig =
      typeof config === 'string' ? { apiToken: config } : (config || {});
    const apiToken = normalizedConfig.apiToken;

    if (!apiToken) {
      throw new Error('MetaApi token is required');
    }

    this.apiToken = apiToken;
    this.baseUrl = 'https://mt-provisioning-api-v1.agiliumtrade.agiliumtrade.ai';
    this.allowSelfSignedCerts =
      normalizedConfig.allowSelfSignedCerts ??
      process.env.METAAPI_ALLOW_SELF_SIGNED_CERTS === 'true';

    this.client = this.createClient();
  }

  createClient(allowSelfSignedCerts = false) {
    const client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'auth-token': this.apiToken,
        'Content-Type': 'application/json'
      },
      httpsAgent: allowSelfSignedCerts
        ? new https.Agent({ rejectUnauthorized: false })
        : undefined
    });

    client.interceptors.response.use(
      response => response,
      error => {
        const message = error.response?.data?.message || error.message;
        console.error(`MetaApi Error: ${message}`);
        throw new Error(message);
      }
    );

    return client;
  }

  isRetryableTlsError(error) {
    const message = (error?.message || '').toLowerCase();

    return [
      'self-signed certificate',
      'certificate has expired',
      'unable to verify the first certificate',
      'unable to get local issuer certificate',
      'hostname/ip does not match certificate',
      'certificate signature failure',
      'ssl routines',
      'tls'
    ].some(fragment => message.includes(fragment));
  }

  async request(config) {
    const requestConfig = {
      ...config,
      headers: {
        ...(config.headers || {}),
      }
    };

    if (
      requestConfig.method &&
      requestConfig.method.toLowerCase() === 'post' &&
      !requestConfig.headers['transaction-id']
    ) {
      requestConfig.headers['transaction-id'] = crypto.randomUUID().replace(/-/g, '');
    }

    try {
      return await this.client.request(requestConfig);
    } catch (error) {
      const shouldRetryWithInsecureTls =
        this.allowSelfSignedCerts &&
        this.isRetryableTlsError(error);

      if (!shouldRetryWithInsecureTls) {
        throw error;
      }

      console.warn(
        `Retrying MetaApi request with TLS verification disabled due to certificate error: ${error.message}`
      );
      const insecureClient = this.createClient(true);
      return insecureClient.request(requestConfig);
    }
  }

  normalizeDirectOptions(options = {}) {
    return {
      name: options.name || options.fullName,
      login: options.login || options.mt5Login,
      password: options.password || options.mt5Password,
      server: options.server || options.mt5Server,
      platform: options.platform || 'mt5'
    };
  }

  normalizeDraftOptions(options = {}) {
    return {
      name: options.name || options.fullName,
      server: options.server || options.mt5Server,
      platform: options.platform || 'mt5'
    };
  }

  async createAccountDirect(options) {
    const { name, login, password, server, platform } =
      this.normalizeDirectOptions(options);

    if (!name || !login || !password || !server) {
      return {
        success: false,
        error: 'Missing required fields: fullName, mt5Login, mt5Password, mt5Server'
      };
    }

    console.log(`Creating ${platform} account: ${name}`);

    try {
      const response = await this.request({
        method: 'post',
        url: '/users/current/accounts',
        data: {
          name,
          type: 'cloud',
          login,
          password,
          server,
          platform,
          magic: 1000,
          reliability: 'high',
          quoteStreamingIntervalInSeconds: 0
        }
      });

      const accountId = response.data.id;
      console.log(`Account created: ${accountId}`);

      await this.request({
        method: 'post',
        url: `/users/current/accounts/${accountId}/deploy`
      });
      console.log(`Account ${accountId} is deploying`);

      return {
        success: true,
        accountId,
        status: 'DEPLOYING'
      };
    } catch (error) {
      console.error(`Direct provisioning failed: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async createAccountDraftMode(options) {
    const { name, server, platform } = this.normalizeDraftOptions(options);

    if (!name || !server) {
      return {
        success: false,
        error: 'Missing required fields: fullName, mt5Server'
      };
    }

    console.log(`Creating draft ${platform} account: ${name}`);

    try {
      const response = await this.request({
        method: 'post',
        url: '/users/current/accounts',
        data: {
          name,
          type: 'cloud',
          server,
          platform,
          magic: 1000,
          reliability: 'high',
          quoteStreamingIntervalInSeconds: 0
        }
      });

      const accountId = response.data.id;
      const configurationLink = response.data.configurationLink;

      console.log(`Draft account created: ${accountId}`);

      return {
        success: true,
        accountId,
        configurationLink,
        status: 'DRAFT'
      };
    } catch (error) {
      console.error(`Draft provisioning failed: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async getAccountStatus(accountId) {
    try {
      const response = await this.request({
        method: 'get',
        url: `/users/current/accounts/${accountId}`
      });
      const state = response.data.state;

      return {
        success: true,
        accountId,
        status: state,
        state,
        lastSyncTime: response.data.lastSyncTime,
        lastQuoteTime: response.data.lastQuoteTime,
        deployed: state === 'DEPLOYED'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        status: 'ERROR'
      };
    }
  }

  async waitForDeployment(accountId, timeoutMs = 120000) {
    const startTime = Date.now();
    const pollInterval = 3000;

    while (Date.now() - startTime < timeoutMs) {
      const status = await this.getAccountStatus(accountId);

      if (status.status === 'DEPLOYED') {
        return status;
      }

      if (status.status === 'ERROR') {
        return status;
      }

      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    return {
      success: false,
      error: 'Deployment timeout',
      status: 'ERROR'
    };
  }

  async getAccountStats(accountId) {
    try {
      const response = await this.request({
        method: 'get',
        url: `/users/current/accounts/${accountId}`
      });

      return {
        success: true,
        balance: response.data.balance,
        equity: response.data.equity,
        currency: response.data.currency,
        leverage: response.data.leverage,
        marginLevel: response.data.marginLevel
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async updateAccountPassword(accountId, password) {
    try {
      await this.request({
        method: 'put',
        url: `/users/current/accounts/${accountId}`,
        data: { password }
      });
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async verifyConnection(accountId) {
    const status = await this.getAccountStatus(accountId);

    return {
      success: status.deployed,
      connected: status.deployed,
      status: status.status,
      message: status.deployed ? 'Account connected' : `Account status: ${status.status}`
    };
  }

  async verifyAccountConnection(accountId) {
    return this.verifyConnection(accountId);
  }

  async listAccounts() {
    try {
      const response = await this.request({
        method: 'get',
        url: '/users/current/accounts'
      });
      const accounts = response.data.accounts || response.data || [];

      return {
        success: true,
        accounts,
        count: accounts.length || 0
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        accounts: []
      };
    }
  }

  async deployAccount(accountId) {
    try {
      await this.request({
        method: 'post',
        url: `/users/current/accounts/${accountId}/deploy`
      });
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async undeployAccount(accountId) {
    try {
      await this.request({
        method: 'post',
        url: `/users/current/accounts/${accountId}/undeploy`
      });
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async deleteAccount(accountId) {
    try {
      await this.request({
        method: 'delete',
        url: `/users/current/accounts/${accountId}`
      });
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

function createProvisioning(apiToken) {
  return new MetaApiProvisioning(apiToken);
}

module.exports = {
  MetaApiProvisioning,
  createProvisioning
};
