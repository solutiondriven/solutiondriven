import { useState } from 'react';
import { X, ArrowLeft, User, Bell, Shield, LogOut, Lock, Sparkles, Copy, Check } from 'lucide-react';
import { AuthUser } from '../services/supabaseAuth';
import { TelegramNotificationManager } from './TelegramNotificationManager';
import { aiService } from '../services/aiService';

interface UserSettingsPageProps {
  isOpen: boolean;
  onClose: () => void;
  isDark: boolean;
  user: AuthUser | null;
  onSignOut: () => void | Promise<void>;
}

type SettingsTab = 'overview' | 'notifications' | 'strategies' | 'profile';

export function UserSettingsPage({
  isOpen,
  onClose,
  isDark,
  user,
  onSignOut,
}: UserSettingsPageProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>('overview');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  
  // Strategy Builder State
  const [strategyDescription, setStrategyDescription] = useState('');
  const [strategyName, setStrategyName] = useState('');
  const [isParsingStrategy, setIsParsingStrategy] = useState(false);
  const [parsedStrategy, setParsedStrategy] = useState<any>(null);
  const [savedStrategies, setSavedStrategies] = useState<any[]>([]);
  const [copiedCode, setCopiedCode] = useState(false);

  if (!isOpen || !user) return null;

  const handleChangePassword = async () => {
    setPasswordError('');
    setPasswordSuccess('');

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError('All fields are required');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match');
      return;
    }

    if (newPassword.length < 6) {
      setPasswordError('Password must be at least 6 characters');
      return;
    }

    if (newPassword === currentPassword) {
      setPasswordError('New password must be different from current password');
      return;
    }

    try {
      console.log('Attempting password change...');
      // Password changes are handled through Supabase's built-in reset flow
      // User would need to use "Forgot Password" for security reasons
      setPasswordError('To change your password, please use "Forgot Password" for security.');
      setIsChangingPassword(false);
    } catch (error: any) {
      setPasswordError(error.message || 'Failed to change password');
    }
  };

  // Parse strategy with AI
  const handleParseStrategy = async () => {
    if (!strategyDescription.trim()) {
      alert('Please describe your trading strategy');
      return;
    }

    setIsParsingStrategy(true);
    try {
      const strategy = await aiService.parseStrategyDescription(
        strategyDescription,
        strategyName || undefined
      );
      setParsedStrategy(strategy);
    } catch (error) {
      console.error('Failed to parse strategy:', error);
      alert('Failed to parse strategy. Please try again.');
    } finally {
      setIsParsingStrategy(false);
    }
  };

  // Save strategy to backend
  const handleSaveStrategy = async () => {
    if (!parsedStrategy) return;

    try {
      // Save to Supabase via API
      const response = await fetch('/api/strategies/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user?.id,
          ...parsedStrategy,
        }),
      });

      if (!response.ok) throw new Error('Failed to save strategy');

      const saved = await response.json();
      setSavedStrategies([saved, ...savedStrategies]);
      setParsedStrategy(null);
      setStrategyDescription('');
      setStrategyName('');
      alert('Strategy saved successfully!');
    } catch (error) {
      console.error('Failed to save strategy:', error);
      alert('Failed to save strategy');
    }
  };

  const handleCopyCode = () => {
    if (parsedStrategy?.code) {
      navigator.clipboard.writeText(parsedStrategy.code);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  const userInitials = (user?.fullName?.trim() || user?.email || 'IH')
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('');
  const panelClassName = isDark ? 'bg-[#2a2a2a] border-[#3a3a3a]' : 'bg-[#f5f5f0] border-[#d0d0d0]';
  const insetPanelClassName = isDark ? 'bg-[#232323] border-[#3a3a3a]' : 'bg-white border-[#d0d0d0]';

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50"
        onClick={onClose}
      />

      {/* Settings Modal */}
        <div
          className={`fixed inset-4 z-50 rounded-2xl overflow-hidden flex flex-col ${
          isDark ? 'bg-[#1a1a1a] border border-[#3a3a3a]' : 'bg-white border border-[#d0d0d0]'
        }`}
      >
        <div
          className={`flex items-center justify-between p-6 border-b ${
            isDark ? 'border-[#3a3a3a]' : 'border-[#d0d0d0]'
          }`}
        >
          <div className="flex items-center gap-3">
            {activeTab !== 'overview' && (
              <button
                onClick={() => setActiveTab('overview')}
                className={`p-2 rounded-lg transition-colors ${
                  isDark
                    ? 'hover:bg-[#2a2a2a] text-[#9a9a9a] hover:text-[#e8e8e8]'
                    : 'hover:bg-[#f5f5f0] text-[#6a6a6a] hover:text-[#2a2a2a]'
                }`}
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <h1
              className={`text-2xl font-bold ${
                isDark ? 'text-[#e8e8e8]' : 'text-[#2a2a2a]'
              }`}
            >
              {activeTab === 'overview' && 'Settings'}
              {activeTab === 'notifications' && 'Telegram Notifications'}
              {activeTab === 'strategies' && 'My Trading Strategy'}
              {activeTab === 'profile' && 'Profile Settings'}
            </h1>
          </div>
          <button
            onClick={onClose}
            className={`p-2 rounded-lg transition-colors ${
              isDark
                ? 'hover:bg-[#2a2a2a] text-[#9a9a9a]'
                : 'hover:bg-[#f5f5f0] text-[#6a6a6a]'
            }`}
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content - Overview Tab */}
        {activeTab === 'overview' && (
          <div className="flex-1 overflow-y-auto p-6">
            {/* User Profile Card */}
            <div
              className={`p-6 rounded-xl mb-6 border ${
                isDark
                  ? 'bg-[#2a2a2a] border-[#3a3a3a]'
                : 'bg-[#f5f5f0] border-[#d0d0d0]'
              }`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-4">
                  <div
                    className={`w-16 h-16 rounded-full ${
                      isDark ? 'bg-gray-700' : 'bg-gray-600'
                    } flex items-center justify-center text-white text-xl font-bold`}
                  >
                    {userInitials}
                  </div>
                  <div>
                    <h2
                      className={`text-lg font-semibold ${
                        isDark ? 'text-[#e8e8e8]' : 'text-[#2a2a2a]'
                      }`}
                    >
                      {user.fullName || 'Impulse Hub User'}
                    </h2>
                    <p
                      className={`text-sm ${
                        isDark ? 'text-[#9a9a9a]' : 'text-[#6a6a6a]'
                      }`}
                    >
                      {user.email}
                    </p>
                  </div>
                </div>
              </div>

              {user.phone && (
                <p
                  className={`text-sm ${
                    isDark ? 'text-[#9a9a9a]' : 'text-[#6a6a6a]'
                  }`}
                >
                  {user.phone}
                </p>
              )}
            </div>

            {/* Settings Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              {/* Notifications */}
              <button
                onClick={() => setActiveTab('notifications')}
                className={`p-4 rounded-xl border text-left transition-colors ${
                  isDark
                    ? 'bg-[#2a2a2a] border-[#3a3a3a] hover:bg-[#3a3a3a]'
                    : 'bg-white border-[#d0d0d0] hover:bg-[#f5f5f0]'
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <Bell
                    className={`w-5 h-5 ${
                      isDark ? 'text-gray-400' : 'text-gray-600'
                    }`}
                  />
                  {user.telegramId && (
                    <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-500/20 text-green-600 dark:text-green-400">
                      Active
                    </span>
                  )}
                </div>
                <h3
                  className={`font-semibold text-sm mb-1 ${
                    isDark ? 'text-[#e8e8e8]' : 'text-[#2a2a2a]'
                  }`}
                >
                  Telegram Notifications
                </h3>
                <p
                  className={`text-xs ${
                    isDark ? 'text-[#9a9a9a]' : 'text-[#6a6a6a]'
                  }`}
                >
                  {user.telegramId
                    ? 'Notifications enabled'
                    : 'Set up Telegram alerts'}
                </p>
              </button>

              {/* Trading Strategy */}
              <button
                onClick={() => setActiveTab('strategies')}
                className={`p-4 rounded-xl border text-left transition-colors ${
                  isDark
                    ? 'bg-[#2a2a2a] border-[#3a3a3a] hover:bg-[#3a3a3a]'
                    : 'bg-white border-[#d0d0d0] hover:bg-[#f5f5f0]'
                }`}
              >
                <div className="flex items-start gap-2 mb-2">
                  <span className="text-xl"></span>
                </div>
                <h3
                  className={`font-semibold text-sm mb-1 ${
                    isDark ? 'text-[#e8e8e8]' : 'text-[#2a2a2a]'
                  }`}
                >
                  My Trading Strategy
                </h3>
                <p
                  className={`text-xs ${
                    isDark ? 'text-[#9a9a9a]' : 'text-[#6a6a6a]'
                  }`}
                >
                  Manage strategies & risk rules
                </p>
              </button>

              {/* Profile */}
              <button
                onClick={() => setActiveTab('profile')}
                className={`p-4 rounded-xl border text-left transition-colors ${
                  isDark
                    ? 'bg-[#2a2a2a] border-[#3a3a3a] hover:bg-[#3a3a3a]'
                    : 'bg-white border-[#d0d0d0] hover:bg-[#f5f5f0]'
                }`}
              >
                <div className="flex items-start gap-2 mb-2">
                  <User
                    className={`w-5 h-5 ${
                      isDark ? 'text-gray-400' : 'text-gray-600'
                    }`}
                  />
                </div>
                <h3
                  className={`font-semibold text-sm mb-1 ${
                    isDark ? 'text-[#e8e8e8]' : 'text-[#2a2a2a]'
                  }`}
                >
                  Profile Info
                </h3>
                <p
                  className={`text-xs ${
                    isDark ? 'text-[#9a9a9a]' : 'text-[#6a6a6a]'
                  }`}
                >
                  Update personal details
                </p>
              </button>
            </div>

            {/* Account Info */}
            <div
              className={`p-4 rounded-xl border text-sm ${
                isDark
                  ? 'bg-[#2a2a2a] border-[#3a3a3a] text-[#9a9a9a]'
                  : 'bg-[#f5f5f0] border-[#d0d0d0] text-[#6a6a6a]'
              }`}
            >
              <p className="mb-2">
                <strong>Account ID:</strong> {user.id?.slice(0, 8)}...
              </p>
              <p>
                <strong>Status:</strong> <span className="text-green-500">Active</span>
              </p>
            </div>
          </div>
        )}

        {/* Content - Notifications Tab */}
        {activeTab === 'notifications' && user && (
          <div className="flex-1 overflow-y-auto p-6">
            <TelegramNotificationManager
              user={user}
              isDark={isDark}
              onUpdate={() => {
                console.log('✅ Telegram setup updated');
              }}
            />
          </div>
        )}

        {/* Content - Security Tab */}
        {activeTab === 'strategies' && (
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* AI Strategy Builder */}
            <div className={`p-6 rounded-xl border ${panelClassName}`}>
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className={`w-5 h-5 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
                <h3 className={`text-lg font-semibold ${isDark ? 'text-[#e8e8e8]' : 'text-[#2a2a2a]'}`}>
                  AI Strategy Builder
                </h3>
              </div>
              <p className={`text-sm mb-4 ${isDark ? 'text-[#9a9a9a]' : 'text-[#6a6a6a]'}`}>
                Describe your trading strategy in plain English, and AI will convert it to code logic and save it.
              </p>

              <div className="space-y-4">
                <div>
                  <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-[#d6d6d6]' : 'text-[#4a4a4a]'}`}>
                    Strategy Name (Optional)
                  </label>
                  <input
                    type="text"
                    value={strategyName}
                    onChange={(e) => setStrategyName(e.target.value)}
                    placeholder="e.g., Breakout Strategy, RSI Divergence"
                    className={`w-full px-4 py-2 rounded-lg border transition-colors ${
                      isDark ? 'bg-[#1f1f1f] border-[#3a3a3a] text-[#e8e8e8] placeholder-[#6a6a6a]' : 'bg-white border-[#d0d0d0] text-[#2a2a2a] placeholder-[#9a9a9a]'
                    } focus:outline-none focus:border-gray-500`}
                  />
                </div>

                <div>
                  <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-[#d6d6d6]' : 'text-[#4a4a4a]'}`}>
                    Strategy Description
                  </label>
                  <textarea
                    value={strategyDescription}
                    onChange={(e) => setStrategyDescription(e.target.value)}
                    placeholder="Describe your strategy: entry rules, exit rules, risk management... e.g., 'Buy when RSI crosses above 50 with volume spike, exit when RSI hits 80 or after 4 hours, max 2% risk per trade'"
                    rows={4}
                    className={`w-full px-4 py-2 rounded-lg border transition-colors resize-none ${
                      isDark ? 'bg-[#1f1f1f] border-[#3a3a3a] text-[#e8e8e8] placeholder-[#6a6a6a]' : 'bg-white border-[#d0d0d0] text-[#2a2a2a] placeholder-[#9a9a9a]'
                    } focus:outline-none focus:border-gray-500`}
                  />
                </div>

                <button
                  onClick={handleParseStrategy}
                  disabled={isParsingStrategy || !strategyDescription.trim()}
                  className={`w-full px-4 py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${
                    isParsingStrategy || !strategyDescription.trim()
                      ? isDark ? 'bg-[#3a3a3a] text-[#6a6a6a] cursor-not-allowed' : 'bg-[#e8e8e8] text-[#9a9a9a] cursor-not-allowed'
                      : isDark ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'
                  }`}
                >
                  <Sparkles className="w-4 h-4" />
                  {isParsingStrategy ? 'Analyzing...' : 'Parse with AI'}
                </button>
              </div>
            </div>

            {/* Parsed Strategy Result */}
            {parsedStrategy && (
              <div className={`p-6 rounded-xl border ${panelClassName}`}>
                <h3 className={`text-lg font-semibold mb-4 ${isDark ? 'text-[#e8e8e8]' : 'text-[#2a2a2a]'}`}>
                  {parsedStrategy.name}
                </h3>

                {/* Entry Rules */}
                <div className="mb-4">
                  <h4 className={`text-sm font-semibold mb-2 ${isDark ? 'text-[#e8e8e8]' : 'text-[#2a2a2a]'}`}>
                    Entry Rules
                  </h4>
                  <ul className={`text-sm space-y-1 ${isDark ? 'text-[#c6c6c6]' : 'text-[#4a4a4a]'}`}>
                    {parsedStrategy.entryRules?.map((rule: string, i: number) => (
                      <li key={i}>• {rule}</li>
                    ))}
                  </ul>
                </div>

                {/* Exit Rules */}
                <div className="mb-4">
                  <h4 className={`text-sm font-semibold mb-2 ${isDark ? 'text-[#e8e8e8]' : 'text-[#2a2a2a]'}`}>
                    Exit Rules
                  </h4>
                  <ul className={`text-sm space-y-1 ${isDark ? 'text-[#c6c6c6]' : 'text-[#4a4a4a]'}`}>
                    {parsedStrategy.exitRules?.map((rule: string, i: number) => (
                      <li key={i}>• {rule}</li>
                    ))}
                  </ul>
                </div>

                {/* Risk Rules */}
                <div className="mb-4">
                  <h4 className={`text-sm font-semibold mb-2 ${isDark ? 'text-[#e8e8e8]' : 'text-[#2a2a2a]'}`}>
                    Risk Management
                  </h4>
                  <ul className={`text-sm space-y-1 ${isDark ? 'text-[#c6c6c6]' : 'text-[#4a4a4a]'}`}>
                    {parsedStrategy.riskRules?.map((rule: string, i: number) => (
                      <li key={i}>• {rule}</li>
                    ))}
                  </ul>
                </div>

                {/* Code */}
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className={`text-sm font-semibold ${isDark ? 'text-[#e8e8e8]' : 'text-[#2a2a2a]'}`}>
                      Generated Code
                    </h4>
                    <button
                      onClick={handleCopyCode}
                      className={`p-1 rounded transition-colors ${
                        copiedCode
                          ? isDark ? 'bg-green-600 text-white' : 'bg-green-600 text-white'
                          : isDark ? 'hover:bg-[#3a3a3a]' : 'hover:bg-[#f5f5f0]'
                      }`}
                    >
                      {copiedCode ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                  <pre className={`p-3 rounded-lg text-xs overflow-x-auto ${isDark ? 'bg-[#1f1f1f] border border-[#3a3a3a] text-[#a8e6a8]' : 'bg-[#f5f5f0] border border-[#d0d0d0] text-[#2a2a2a]'}`}>
                    {parsedStrategy.code}
                  </pre>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveStrategy}
                    className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                      isDark ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-green-600 hover:bg-green-700 text-white'
                    }`}
                  >
                    Save Strategy
                  </button>
                  <button
                    onClick={() => setParsedStrategy(null)}
                    className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                      isDark ? 'bg-[#3a3a3a] hover:bg-[#4a4a4a] text-[#e8e8e8]' : 'bg-gray-200 hover:bg-gray-300 text-[#2a2a2a]'
                    }`}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Saved Strategies */}
            <div className={`p-6 rounded-xl border ${panelClassName}`}>
              <h3 className={`text-lg font-semibold mb-4 ${isDark ? 'text-[#e8e8e8]' : 'text-[#2a2a2a]'}`}>
                Saved Strategies
              </h3>
              {savedStrategies.length === 0 ? (
                <div className={`p-4 rounded-lg border ${insetPanelClassName}`}>
                  <p className={`text-sm ${isDark ? 'text-[#c6c6c6]' : 'text-[#4a4a4a]'}`}>
                    No strategies saved yet. Create one using the AI Strategy Builder above.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {savedStrategies.map((strategy, index) => (
                    <div key={index} className={`p-3 rounded-lg border ${insetPanelClassName}`}>
                      <p className={`font-medium text-sm ${isDark ? 'text-[#e8e8e8]' : 'text-[#2a2a2a]'}`}>
                        {strategy.name}
                      </p>
                      <p className={`text-xs mt-1 ${isDark ? 'text-[#9a9a9a]' : 'text-[#6a6a6a]'}`}>
                        {strategy.description.substring(0, 100)}...
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className={`p-6 rounded-xl border ${panelClassName}`}>
              <h3 className={`text-lg font-semibold mb-4 ${isDark ? 'text-[#e8e8e8]' : 'text-[#2a2a2a]'}`}>
                Risk Management Rules
              </h3>
              <p className={`text-sm mb-4 ${isDark ? 'text-[#9a9a9a]' : 'text-[#6a6a6a]'}`}>
                Set your risk management parameters to protect your trading capital.
              </p>
              <div className="space-y-3">
                <div>
                  <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-[#d6d6d6]' : 'text-[#4a4a4a]'}`}>
                    Max Risk per Trade (%)
                  </label>
                  <input
                    type="number"
                    defaultValue="2"
                    min="0.1"
                    max="10"
                    step="0.1"
                    className={`w-full px-4 py-2 rounded-lg border transition-colors ${
                      isDark ? 'bg-[#1f1f1f] border-[#3a3a3a] text-[#e8e8e8]' : 'bg-white border-[#d0d0d0] text-[#2a2a2a]'
                    } focus:outline-none focus:border-gray-500`}
                  />
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-[#d6d6d6]' : 'text-[#4a4a4a]'}`}>
                    Max Daily Loss (%)
                  </label>
                  <input
                    type="number"
                    defaultValue="5"
                    min="1"
                    max="50"
                    step="1"
                    className={`w-full px-4 py-2 rounded-lg border transition-colors ${
                      isDark ? 'bg-[#1f1f1f] border-[#3a3a3a] text-[#e8e8e8]' : 'bg-white border-[#d0d0d0] text-[#2a2a2a]'
                    } focus:outline-none focus:border-gray-500`}
                  />
                </div>
                <button className={`w-full px-4 py-2 rounded-lg font-medium transition-colors ${isDark ? 'bg-[#1f1f1f] hover:bg-[#2a2a2a] text-[#e8e8e8] border border-[#3a3a3a]' : 'bg-white hover:bg-[#f5f5f0] text-[#2a2a2a] border border-[#d0d0d0]'}`}>
                  Save Risk Rules
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Content - Profile Tab */}
        {activeTab === 'profile' && (
          <div className="flex-1 overflow-y-auto p-6">
            <div className="space-y-4">
              <div>
                <label
                  className={`block text-sm font-medium mb-2 ${
                    isDark ? 'text-[#d6d6d6]' : 'text-[#4a4a4a]'
                  }`}
                >
                  Full Name
                </label>
                <input
                  type="text"
                  defaultValue={user.fullName}
                  disabled
                  className={`w-full px-4 py-2 rounded-lg border opacity-50 cursor-not-allowed ${
                    isDark
                      ? 'bg-[#232323] border-[#3a3a3a] text-[#e8e8e8]'
                      : 'bg-[#f5f5f0] border-[#d0d0d0] text-[#2a2a2a]'
                  }`}
                />
                <p className={`text-xs mt-1 ${isDark ? 'text-[#9a9a9a]' : 'text-[#6a6a6a]'}`}>
                  Name cannot be changed at this time
                </p>
              </div>

              <div>
                <label
                  className={`block text-sm font-medium mb-2 ${
                    isDark ? 'text-[#d6d6d6]' : 'text-[#4a4a4a]'
                  }`}
                >
                  Email Address
                </label>
                <input
                  type="email"
                  defaultValue={user.email}
                  disabled
                  className={`w-full px-4 py-2 rounded-lg border opacity-50 cursor-not-allowed ${
                    isDark
                      ? 'bg-[#232323] border-[#3a3a3a] text-[#e8e8e8]'
                      : 'bg-[#f5f5f0] border-[#d0d0d0] text-[#2a2a2a]'
                  }`}
                />
              </div>

              <div>
                <label
                  className={`block text-sm font-medium mb-2 ${
                    isDark ? 'text-[#d6d6d6]' : 'text-[#4a4a4a]'
                  }`}
                >
                  Phone Number
                </label>
                <input
                  type="tel"
                  defaultValue={user.phone}
                  disabled
                  className={`w-full px-4 py-2 rounded-lg border opacity-50 cursor-not-allowed ${
                    isDark
                      ? 'bg-[#232323] border-[#3a3a3a] text-[#e8e8e8]'
                      : 'bg-[#f5f5f0] border-[#d0d0d0] text-[#2a2a2a]'
                  }`}
                />
                <p className={`text-xs mt-1 ${isDark ? 'text-[#9a9a9a]' : 'text-[#6a6a6a]'}`}>
                  Profile information cannot be changed at this time. Please contact support for updates.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div
          className={`p-4 border-t ${
            isDark ? 'border-[#3a3a3a]' : 'border-[#d0d0d0]'
          } flex gap-3`}
        >
          <button
            onClick={onClose}
            className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
              isDark
                ? 'bg-[#2a2a2a] hover:bg-[#3a3a3a] text-[#e8e8e8]'
                : 'bg-[#f5f5f0] hover:bg-[#ece8df] text-[#2a2a2a] border border-[#d0d0d0]'
            }`}
          >
            Close
          </button>
          <button
            onClick={onSignOut}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
              isDark
                ? 'bg-red-900/20 hover:bg-red-900/30 text-red-300 border border-red-500/30'
                : 'bg-red-50 hover:bg-red-100 text-red-700 border border-red-200'
            }`}
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </div>
    </>
  );
}
