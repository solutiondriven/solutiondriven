/**
 * Account Provisioning Service (Frontend)
 * Calls the backend API to provision MT5 accounts
 * 
 * The backend handles all MetaApi communication
 */

const API_BASE = 'http://localhost:3000/api/accounts';

interface ProvisionRequest {
  fullName: string;
  mt5Server: string;
  mt5Login?: string;
  mt5Password?: string;
}

interface ProvisionResponse {
  success: boolean;
  accountId?: string;
  configurationLink?: string;
  status?: string;
  dataCenter?: string;
  estimatedLatency?: number;
  error?: string;
}

class AccountProvisioningService {
  private formatProvisioningError(error: string | undefined): string {
    const message = error || 'Failed to create account';

    if (/certificate|tls|ssl/i.test(message)) {
      return 'Secure connection to the broker service failed on this machine. Restart the backend and try again.';
    }

    if (/missing required fields/i.test(message)) {
      return 'Please fill in your MT5 account name, login, password, and server.';
    }

    return message;
  }

  /**
   * Provision account using Draft Mode (secure)
   * Returns a configuration link for user to complete on MetaApi's site
   */
  async createAccountDraftMode(data: {
    fullName: string;
    mt5Server: string;
  }): Promise<ProvisionResponse> {
    try {
      const response = await fetch(`${API_BASE}/provision/draft`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      const result = await response.json();
      
      if (!response.ok) {
        return {
          success: false,
          error: this.formatProvisioningError(result.error)
        };
      }

      return {
        success: true,
        accountId: result.accountId,
        configurationLink: result.configurationLink,
        status: result.status
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error'
      };
    }
  }

  /**
   * Provision account using Direct Mode
   * User enters password (handle with care)
   */
  async createAccountDirect(data: {
    fullName: string;
    mt5Login: string;
    mt5Password: string;
    mt5Server: string;
  }): Promise<ProvisionResponse> {
    try {
      const response = await fetch(`${API_BASE}/provision/direct`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      const result = await response.json();
      
      if (!response.ok) {
        return {
          success: false,
          error: this.formatProvisioningError(result.error)
        };
      }

      return {
        success: true,
        accountId: result.accountId,
        status: result.status
      };
    } catch (error) {
      return {
        success: false,
        error: this.formatProvisioningError(
          error instanceof Error ? error.message : 'Network error'
        )
      };
    }
  }

  /**
   * Get account deployment status
   */
  async getAccountStatus(accountId: string): Promise<ProvisionResponse> {
    try {
      const response = await fetch(`${API_BASE}/${accountId}/status`);
      const result = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: result.error || 'Failed to get status'
        };
      }

      return {
        success: true,
        ...result
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error'
      };
    }
  }

  /**
   * Monitor deployment with polling
   */
  async monitorDeployment(
    accountId: string,
    onStatusChange?: (status: any) => void,
    maxAttempts: number = 30
  ): Promise<ProvisionResponse> {
    let attempts = 0;

    while (attempts < maxAttempts) {
      const status = await this.getAccountStatus(accountId);

      if (onStatusChange) {
        onStatusChange(status);
      }

      // Check if deployed
      if (status.status === 'DEPLOYED') {
        return status;
      }

      // Check for error
      if (status.status === 'ERROR' || !status.success) {
        return {
          success: false,
          error: status.error || 'Deployment failed'
        };
      }

      // Wait before next attempt
      await new Promise(resolve => setTimeout(resolve, 3000));
      attempts++;
    }

    return {
      success: false,
      error: 'Deployment timeout'
    };
  }
}

// Export singleton
let serviceInstance: AccountProvisioningService | null = null;

export function getAccountProvisioningService(): AccountProvisioningService {
  if (!serviceInstance) {
    serviceInstance = new AccountProvisioningService();
  }
  return serviceInstance;
}
