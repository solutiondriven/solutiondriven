/**
 * AccountProvisioningForm Component
 * Frontend form for connecting MT5/MT4 accounts to Impulse Hub
 * 
 * Features:
 * - Direct Mode: User enters password directly (faster)
 * - Draft Mode: Secure link, password on MetaApi's site (more secure)
 * - Real-time deployment status
 * - Latency badge
 * - Error handling
 */

import React, { useState, useEffect } from 'react';
import { 
  AlertCircle, 
  CheckCircle, 
  Loader2, 
  Eye, 
  EyeOff,
  ExternalLink,
  Zap
} from 'lucide-react';
import { getAccountProvisioningService } from '../services/accountProvisioning';

type ProvisioningMode = 'direct' | 'draft';
type DeploymentPhase = 'idle' | 'creating' | 'deploying' | 'success' | 'error';

interface AccountProvisioningFormProps {
  isDark: boolean;
  onSuccess?: (accountId: string) => void;
  onError?: (error: string) => void;
  onClose?: () => void;
}

interface DeploymentStatus {
  phase: DeploymentPhase;
  progress: number; // 0-100
  message: string;
  accountId?: string;
  dataCenter?: string;
  latency?: number;
  configurationLink?: string;
  error?: string;
}

export function AccountProvisioningForm({
  isDark,
  onSuccess,
  onError,
  onClose
}: AccountProvisioningFormProps) {
  // Form states
  const [mode, setMode] = useState<ProvisioningMode>('direct');
  const [fullName, setFullName] = useState('');
  const [mt5Login, setMt5Login] = useState('');
  const [mt5Password, setMt5Password] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [mt5Server, setMt5Server] = useState('ICMarketsSC-Demo');
  
  // Deployment states
  const [isProvisioning, setIsProvisioning] = useState(false);
  const [deploymentStatus, setDeploymentStatus] = useState<DeploymentStatus>({
    phase: 'idle',
    progress: 0,
    message: ''
  });

  // Common MT5 servers
  const mt5Servers = [
    { value: 'ICMarketsSC-Demo', label: 'IC Markets Demo' },
    { value: 'ICMarketsSC-Live', label: 'IC Markets Live' },
    { value: 'MetaQuotes-Demo', label: 'MetaQuotes Demo' },
    { value: 'Pepperstone-Demo', label: 'Pepperstone Demo' },
    { value: 'Pepperstone-Live', label: 'Pepperstone Live' }
  ];

  const handleProvisionDirect = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!fullName.trim() || !mt5Login.trim() || !mt5Password.trim()) {
      setDeploymentStatus({
        phase: 'error',
        progress: 0,
        message: 'Please fill in all fields',
        error: 'Missing required information'
      });
      onError?.('Missing required information');
      return;
    }

    try {
      setIsProvisioning(true);
      const provisioning = getAccountProvisioningService();

      // Phase 1: Creating account
      setDeploymentStatus({
        phase: 'creating',
        progress: 20,
        message: 'Creating your MT5 account...'
      });

      const createResult = await provisioning.createAccountDirect({
        fullName: fullName.trim(),
        mt5Login: mt5Login.trim(),
        mt5Password: mt5Password.trim(),
        mt5Server
      });

      if (!createResult.success || !createResult.accountId) {
        throw new Error(createResult.error || 'Failed to create account');
      }

      const accountId = createResult.accountId;

      // Phase 2: Deploying to cloud
      setDeploymentStatus({
        phase: 'deploying',
        progress: 40,
        message: 'Deploying to cloud servers...',
        accountId
      });

      // Monitor deployment with callbacks
      const finalStatus = await provisioning.monitorDeployment(
        accountId,
        (status) => {
          const progressMap = {
            UNDEPLOYED: 50,
            DEPLOYING: 70,
            DEPLOYED: 95,
            DISCONNECTED: 50,
            ERROR: 100
          };

          setDeploymentStatus(prev => ({
            ...prev,
            progress: progressMap[status.status] || 70,
            dataCenter: status.dataCenter,
            latency: status.estimatedLatency
          }));
        }
      );

      if (finalStatus.status === 'ERROR') {
        throw new Error(finalStatus.error || 'Deployment failed');
      }

      // Success!
      setDeploymentStatus({
        phase: 'success',
        progress: 100,
        message: 'Connected to London (LD4) Data Center',
        accountId,
        dataCenter: 'London (LD4)',
        latency: finalStatus.estimatedLatency || 22
      });

      onSuccess?.(accountId);

      // Clear form after 2 seconds
      setTimeout(() => {
        setFullName('');
        setMt5Login('');
        setMt5Password('');
      }, 2000);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      
      setDeploymentStatus({
        phase: 'error',
        progress: 0,
        message: 'Connection failed',
        error: errorMessage
      });

      onError?.(errorMessage);
    } finally {
      setIsProvisioning(false);
    }
  };

  const handleProvisionDraft = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!fullName.trim() || !mt5Server.trim()) {
      setDeploymentStatus({
        phase: 'error',
        progress: 0,
        message: 'Please fill in all fields',
        error: 'Missing name or server'
      });
      onError?.('Missing required information');
      return;
    }

    try {
      setIsProvisioning(true);
      const provisioning = getAccountProvisioningService();

      // Phase 1: Creating draft account (no password yet)
      setDeploymentStatus({
        phase: 'creating',
        progress: 30,
        message: 'Creating secure account...'
      });

      const createResult = await provisioning.createAccountDraftMode({
        fullName: fullName.trim(),
        mt5Server
      });

      if (!createResult.success || !createResult.accountId) {
        throw new Error(createResult.error || 'Failed to create account');
      }

      const accountId = createResult.accountId;
      const configLink = createResult.configurationLink;

      // Phase 2: Ready for user to complete on MetaApi's site
      setDeploymentStatus({
        phase: 'success',
        progress: 100,
        message: 'Account created! Click the button below to securely connect.',
        accountId,
        configurationLink: configLink,
        dataCenter: 'London (LD4)',
        latency: 22
      });

      onSuccess?.(accountId);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      
      setDeploymentStatus({
        phase: 'error',
        progress: 0,
        message: 'Account creation failed',
        error: errorMessage
      });

      onError?.(errorMessage);
    } finally {
      setIsProvisioning(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    if (mode === 'direct') {
      handleProvisionDirect(e);
    } else {
      handleProvisionDraft(e);
    }
  };

  // ============ RENDER ============

  return (
    <div className={`w-full max-w-2xl mx-auto p-6 rounded-2xl ${isDark ? 'bg-[#1a1a1a]' : 'bg-white'}`}>
      {/* Header */}
      <div className="mb-6">
        <h2 className={`text-2xl font-bold mb-2 ${isDark ? 'text-[#e8e8e8]' : 'text-[#2a2a2a]'}`}>
          Connect MT5 Account
        </h2>
        <p className={`text-sm ${isDark ? 'text-[#9a9a9a]' : 'text-[#6a6a6a]'}`}>
          Securely connect your MetaTrader 5 account to Impulse Hub
        </p>
      </div>

      {/* Deployment Status UI */}
      {deploymentStatus.phase !== 'idle' && (
        <div className="mb-6 p-4 rounded-xl bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/20">
          {/* Progress Bar */}
          <div className="mb-3">
            <div className={`w-full h-2 rounded-full overflow-hidden ${isDark ? 'bg-[#2a2a2a]' : 'bg-[#e8e8e8]'}`}>
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-300"
                style={{ width: `${deploymentStatus.progress}%` }}
              />
            </div>
          </div>

          {/* Status Message */}
          <div className="flex items-center gap-3">
            {deploymentStatus.phase === 'success' && (
              <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
            )}
            {deploymentStatus.phase === 'error' && (
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
            )}
            {(deploymentStatus.phase === 'creating' || deploymentStatus.phase === 'deploying') && (
              <Loader2 className="w-5 h-5 text-blue-500 animate-spin flex-shrink-0" />
            )}

            <div className="flex-1">
              <p className={`font-medium ${
                deploymentStatus.phase === 'success' ? 'text-green-600' :
                deploymentStatus.phase === 'error' ? 'text-red-600' :
                'text-blue-600'
              }`}>
                {deploymentStatus.message}
              </p>
              {deploymentStatus.error && (
                <p className="text-sm text-red-500 mt-1">{deploymentStatus.error}</p>
              )}
            </div>
          </div>

          {/* Success State: Data Center & Latency */}
          {deploymentStatus.phase === 'success' && deploymentStatus.dataCenter && (
            <div className="mt-3 pt-3 border-t border-blue-500/20 flex flex-wrap gap-4">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500" />
                <span className={`text-sm font-medium ${isDark ? 'text-[#9a9a9a]' : 'text-[#6a6a6a]'}`}>
                  {deploymentStatus.dataCenter}
                </span>
              </div>
              {deploymentStatus.latency && (
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-yellow-500" />
                  <span className={`text-sm font-medium ${isDark ? 'text-[#9a9a9a]' : 'text-[#6a6a6a]'}`}>
                    Latency: {deploymentStatus.latency}ms
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Draft Mode: Secure Link */}
          {deploymentStatus.phase === 'success' && deploymentStatus.configurationLink && (
            <div className="mt-4">
              <a
                href={deploymentStatus.configurationLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors font-medium"
              >
                Securely Connect to Impulse Hub
                <ExternalLink className="w-4 h-4" />
              </a>
              <p className={`text-xs mt-2 ${isDark ? 'text-[#7a7a7a]' : 'text-[#8a8a8a]'}`}>
                You'll enter your password on MetaApi's secure site
              </p>
            </div>
          )}
        </div>
      )}

      {/* Mode Selection */}
      {deploymentStatus.phase === 'idle' && (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3">
            <button
              onClick={() => setMode('direct')}
              className={`p-3 rounded-xl border transition-colors ${
                mode === 'direct'
                  ? isDark
                    ? 'border-blue-500 bg-blue-500/10'
                    : 'border-blue-400 bg-blue-50'
                  : isDark
                  ? 'border-[#3a3a3a] hover:border-[#5a5a5a]'
                  : 'border-[#d0d0d0] hover:border-[#b0b0b0]'
              }`}
            >
              <p className={`font-medium text-sm ${isDark ? 'text-[#e8e8e8]' : 'text-[#2a2a2a]'}`}>
                Direct Method
              </p>
              <p className={`text-xs mt-1 ${isDark ? 'text-[#9a9a9a]' : 'text-[#6a6a6a]'}`}>
                Enter password here
              </p>
            </button>

            <button
              onClick={() => setMode('draft')}
              className={`p-3 rounded-xl border transition-colors ${
                mode === 'draft'
                  ? isDark
                    ? 'border-green-500 bg-green-500/10'
                    : 'border-green-400 bg-green-50'
                  : isDark
                  ? 'border-[#3a3a3a] hover:border-[#5a5a5a]'
                  : 'border-[#d0d0d0] hover:border-[#b0b0b0]'
              }`}
            >
              <p className={`font-medium text-sm ${isDark ? 'text-[#e8e8e8]' : 'text-[#2a2a2a]'}`}>
                Draft Mode
              </p>
              <p className={`text-xs mt-1 ${isDark ? 'text-[#9a9a9a]' : 'text-[#6a6a6a]'}`}>
                Secure link (recommended)
              </p>
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Full Name */}
            <div>
              <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-[#e8e8e8]' : 'text-[#2a2a2a]'}`}>
                Full Name
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Your name"
                disabled={isProvisioning}
                className={`w-full px-3 py-2 rounded-lg border transition-colors ${
                  isDark
                    ? 'bg-[#2a2a2a] border-[#3a3a3a] text-[#e8e8e8] placeholder-[#7a7a7a]'
                    : 'bg-white border-[#d0d0d0] text-[#2a2a2a] placeholder-[#9a9a9a]'
                } disabled:opacity-50`}
              />
            </div>

            {/* MT5 Server */}
            <div>
              <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-[#e8e8e8]' : 'text-[#2a2a2a]'}`}>
                MT5 Server
              </label>
              <select
                value={mt5Server}
                onChange={(e) => setMt5Server(e.target.value)}
                disabled={isProvisioning}
                className={`w-full px-3 py-2 rounded-lg border transition-colors ${
                  isDark
                    ? 'bg-[#2a2a2a] border-[#3a3a3a] text-[#e8e8e8]'
                    : 'bg-white border-[#d0d0d0] text-[#2a2a2a]'
                } disabled:opacity-50`}
              >
                {mt5Servers.map(server => (
                  <option key={server.value} value={server.value}>
                    {server.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Direct Mode Fields */}
            {mode === 'direct' && (
              <>
                {/* MT5 Login */}
                <div>
                  <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-[#e8e8e8]' : 'text-[#2a2a2a]'}`}>
                    MT5 Login
                  </label>
                  <input
                    type="text"
                    value={mt5Login}
                    onChange={(e) => setMt5Login(e.target.value)}
                    placeholder="Your MT5 account number"
                    disabled={isProvisioning}
                    className={`w-full px-3 py-2 rounded-lg border transition-colors ${
                      isDark
                        ? 'bg-[#2a2a2a] border-[#3a3a3a] text-[#e8e8e8] placeholder-[#7a7a7a]'
                        : 'bg-white border-[#d0d0d0] text-[#2a2a2a] placeholder-[#9a9a9a]'
                    } disabled:opacity-50`}
                  />
                </div>

                {/* MT5 Password */}
                <div>
                  <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-[#e8e8e8]' : 'text-[#2a2a2a]'}`}>
                    MT5 Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={mt5Password}
                      onChange={(e) => setMt5Password(e.target.value)}
                      placeholder="Your MT5 password"
                      disabled={isProvisioning}
                      className={`w-full px-3 py-2 pr-10 rounded-lg border transition-colors ${
                        isDark
                          ? 'bg-[#2a2a2a] border-[#3a3a3a] text-[#e8e8e8] placeholder-[#7a7a7a]'
                          : 'bg-white border-[#d0d0d0] text-[#2a2a2a] placeholder-[#9a9a9a]'
                      } disabled:opacity-50`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      disabled={isProvisioning}
                      className={`absolute right-3 top-1/2 -translate-y-1/2 ${isDark ? 'text-[#7a7a7a]' : 'text-[#9a9a9a]'} hover:text-blue-500 transition-colors disabled:opacity-50`}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className={`p-3 rounded-lg ${isDark ? 'bg-yellow-500/10 border border-yellow-500/20' : 'bg-yellow-50 border border-yellow-200'}`}>
                  <p className={`text-xs ${isDark ? 'text-yellow-400' : 'text-yellow-700'}`}>
                    ⚠️ Your password is sent securely to MetaApi, then deleted from our servers
                  </p>
                </div>
              </>
            )}

            {/* Draft Mode Info */}
            {mode === 'draft' && (
              <div className={`p-3 rounded-lg ${isDark ? 'bg-green-500/10 border border-green-500/20' : 'bg-green-50 border border-green-200'}`}>
                <p className={`text-xs font-medium ${isDark ? 'text-green-400' : 'text-green-700'}`}>
                  ✅ More Secure: You'll enter your password on MetaApi's official site
                </p>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isProvisioning || !fullName.trim() || (mode === 'direct' && (!mt5Login.trim() || !mt5Password.trim()))}
              className={`w-full py-2 px-4 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${
                isProvisioning || !fullName.trim() || (mode === 'direct' && (!mt5Login.trim() || !mt5Password.trim()))
                  ? isDark
                    ? 'bg-[#3a3a3a] text-[#7a7a7a] cursor-not-allowed'
                    : 'bg-[#e8e8e8] text-[#9a9a9a] cursor-not-allowed'
                  : isDark
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-blue-500 text-white hover:bg-blue-600'
              }`}
            >
              {isProvisioning && <Loader2 className="w-4 h-4 animate-spin" />}
              {isProvisioning ? 'Connecting...' : mode === 'direct' ? 'Connect Account' : 'Create Secure Link'}
            </button>
          </form>
        </>
      )}

      {/* Close Button */}
      {deploymentStatus.phase !== 'idle' && (
        <button
          onClick={() => {
            setDeploymentStatus({ phase: 'idle', progress: 0, message: '' });
            onClose?.();
          }}
          className={`w-full mt-4 py-2 px-4 rounded-lg font-medium transition-colors ${
            isDark
              ? 'bg-[#2a2a2a] text-[#e8e8e8] hover:bg-[#3a3a3a]'
              : 'bg-[#f0f0f0] text-[#2a2a2a] hover:bg-[#e0e0e0]'
          }`}
        >
          Done
        </button>
      )}
    </div>
  );
}
