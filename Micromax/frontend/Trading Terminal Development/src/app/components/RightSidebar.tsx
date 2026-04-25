import { X, Settings, User, CreditCard, Bell, TrendingUp, LogOut, Wallet, PieChart, Send } from 'lucide-react';
import { useEffect, useState } from 'react';
import { AuthUser, supabaseAuth } from '../services/supabaseAuth';
import { BillingPage } from './BillingPage';
import { UserSettingsPage } from './UserSettingsPage';
import { AccountProvisioningForm } from './AccountProvisioningForm';

interface RightSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  isDark: boolean;
  user: AuthUser | null;
  onUserUpdate: (user: AuthUser) => void;
  onSignOut: () => void | Promise<void>;
}

type BrokerType = 'mt5-web' | 'binance' | 'bitget';

interface BrokerConnection {
  id: string;
  broker: BrokerType;
  brokerLabel: string;
  accountId: string;
  serverName: string;
  secret: string;
  createdAt: string;
}

function TradingViewCalendarWidget({ isDark }: { isDark: boolean }) {
  useEffect(() => {
    const container = document.getElementById('tradingview-economic-calendar-widget');
    if (!container) return;

    container.innerHTML = '';

    const widgetWrapper = document.createElement('div');
    widgetWrapper.className = 'tradingview-widget-container';

    const widget = document.createElement('div');
    widget.className = 'tradingview-widget-container__widget';

    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.async = true;
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-events.js';
    script.text = JSON.stringify({
      colorTheme: isDark ? 'dark' : 'light',
      isTransparent: false,
      width: '100%',
      height: 520,
      locale: 'en',
      importanceFilter: '-1,0,1',
      countryFilter: 'us,eu,gb,ng,ca,au,jp,cn',
    });

    widgetWrapper.appendChild(widget);
    widgetWrapper.appendChild(script);
    container.appendChild(widgetWrapper);
  }, [isDark]);

  return <div id="tradingview-economic-calendar-widget" className="min-h-[520px] w-full" />;
}

export function RightSidebar({ isOpen, onClose, isDark, user, onUserUpdate, onSignOut }: RightSidebarProps) {
  const [telegramId, setTelegramId] = useState(user?.telegramId || '');
  const [statusMessage, setStatusMessage] = useState('');
  const [isSavingTelegram, setIsSavingTelegram] = useState(false);
  const [showBillingPage, setShowBillingPage] = useState(false);
  const [showSettingsPage, setShowSettingsPage] = useState(false);
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);
  const [showBrokerModal, setShowBrokerModal] = useState(false);
  const [showProvisioningForm, setShowProvisioningForm] = useState(false);
  const [provisioningMethod, setProvisioningMethod] = useState<'manual' | 'automated'>('manual');
  const [subscribeNews, setSubscribeNews] = useState(false);
  const [subscribeAlerts, setSubscribeAlerts] = useState(false);
  const [selectedBroker, setSelectedBroker] = useState<BrokerType>('mt5-web');
  const [brokerLabel, setBrokerLabel] = useState('MT5 Web');
  const [brokerAccountId, setBrokerAccountId] = useState('');
  const [brokerServerName, setBrokerServerName] = useState('');
  const [brokerSecret, setBrokerSecret] = useState('');
  const [brokerStatusMessage, setBrokerStatusMessage] = useState('');
  const [connectedBrokers, setConnectedBrokers] = useState<BrokerConnection[]>([]);
  const userInitials = (user?.fullName?.trim() || user?.email || 'IH')
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('');
  const brokerStorageKey = `micromax_brokers_${user?.id || 'guest'}`;
  const brokerOptions: Array<{ id: BrokerType; title: string; subtitle: string }> = [
    { id: 'mt5-web', title: 'MT5 Web', subtitle: 'MetaTrader 5 web terminal connection' },
    { id: 'binance', title: 'Binance', subtitle: 'Binance spot trading account connection' },
    { id: 'bitget', title: 'Bitget', subtitle: 'Bitget spot trading account connection' },
  ];

  useEffect(() => {
    setTelegramId(user?.telegramId || '');
  }, [user?.telegramId]);

  useEffect(() => {
    const stored = localStorage.getItem(brokerStorageKey);
    if (!stored) {
      setConnectedBrokers([]);
      return;
    }

    try {
      setConnectedBrokers(JSON.parse(stored) as BrokerConnection[]);
    } catch (error) {
      console.error('Failed to load broker connections:', error);
      setConnectedBrokers([]);
    }
  }, [brokerStorageKey]);

  useEffect(() => {
    localStorage.setItem(brokerStorageKey, JSON.stringify(connectedBrokers));
  }, [brokerStorageKey, connectedBrokers]);

  useEffect(() => {
    const selected = brokerOptions.find((option) => option.id === selectedBroker);
    if (selected) {
      setBrokerLabel(selected.title);
    }
  }, [selectedBroker]);

  if (!isOpen) return null;

  // Show Billing Page modal if requested
  if (showBillingPage) {
    return <BillingPage isDark={isDark} onClose={() => setShowBillingPage(false)} />;
  }

  // Show Settings Page modal if requested
  if (showSettingsPage) {
    return (
      <UserSettingsPage
        isOpen={showSettingsPage}
        onClose={() => setShowSettingsPage(false)}
        isDark={isDark}
        user={user}
        onSignOut={onSignOut}
      />
    );
  }

  const handleBrokerSave = () => {
    if (!brokerAccountId.trim() || !brokerServerName.trim() || !brokerSecret.trim()) {
      setBrokerStatusMessage('Enter your broker account ID, server, and password/token.');
      return;
    }

    const selected = brokerOptions.find((option) => option.id === selectedBroker);
    if (!selected) return;

    const connection: BrokerConnection = {
      id: `${selectedBroker}_${Date.now()}`,
      broker: selectedBroker,
      brokerLabel: brokerLabel.trim() || selected.title,
      accountId: brokerAccountId.trim(),
      serverName: brokerServerName.trim(),
      secret: brokerSecret.trim(),
      createdAt: new Date().toISOString(),
    };

    setConnectedBrokers((prev) => [connection, ...prev.filter((item) => !(item.broker === connection.broker && item.accountId === connection.accountId))]);
    setBrokerAccountId('');
    setBrokerServerName('');
    setBrokerSecret('');
    setBrokerStatusMessage(`${selected.title} connected successfully.`);
  };

  const handleBrokerDelete = (id: string) => {
    setConnectedBrokers((prev) => prev.filter((broker) => broker.id !== id));
  };

  if (showBrokerModal) {
    return (
      <>
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100]" onClick={() => setShowBrokerModal(false)} />
        <div className={`fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-[101] ${isDark ? 'bg-[#1a1a1a]' : 'bg-white'} rounded-2xl shadow-2xl w-full max-w-3xl max-h-[88vh] overflow-hidden flex flex-col`}>
          <div className={`flex items-center justify-between p-6 border-b ${isDark ? 'border-[#3a3a3a]' : 'border-[#d0d0d0]'}`}>
            <div>
              <h2 className={`text-xl font-semibold ${isDark ? 'text-[#e8e8e8]' : 'text-[#2a2a2a]'}`}>Connect Brokers</h2>
              <p className={`text-sm mt-1 ${isDark ? 'text-[#9a9a9a]' : 'text-[#6a6a6a]'}`}>Connect MT5, Binance, and Bitget accounts for review on your dashboard.</p>
            </div>
            <button
              onClick={() => setShowBrokerModal(false)}
              className={`w-8 h-8 rounded-lg ${isDark ? 'hover:bg-[#2a2a2a]' : 'hover:bg-[#f0f0f0]'} flex items-center justify-center transition-colors`}
            >
              <X className={`w-5 h-5 ${isDark ? 'text-[#9a9a9a]' : 'text-[#6a6a6a]'}`} />
            </button>
          </div>

          <div className="overflow-y-auto flex-1 p-6 space-y-6">
            {/* Method Selector */}
            <div className="flex gap-2 border-b" style={{ borderColor: isDark ? '#3a3a3a' : '#d0d0d0' }}>
              <button
                onClick={() => setProvisioningMethod('manual')}
                className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
                  provisioningMethod === 'manual'
                    ? `border-blue-500 ${isDark ? 'text-blue-400' : 'text-blue-600'}`
                    : `border-transparent ${isDark ? 'text-[#9a9a9a]' : 'text-[#6a6a6a]'}`
                }`}
              >
                Manual Entry
              </button>
              <button
                onClick={() => setProvisioningMethod('automated')}
                className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
                  provisioningMethod === 'automated'
                    ? `border-blue-500 ${isDark ? 'text-blue-400' : 'text-blue-600'}`
                    : `border-transparent ${isDark ? 'text-[#9a9a9a]' : 'text-[#6a6a6a]'}`
                }`}
              >
                🚀 Automated Provisioning
              </button>
            </div>

            {/* Automated Provisioning Form */}
            {provisioningMethod === 'automated' ? (
              <div className="py-4">
                <AccountProvisioningForm
                  isDark={isDark}
                  onSuccess={(accountId) => {
                    setBrokerStatusMessage(`Account ${accountId} provisioned successfully!`);
                    // Optionally add to connected brokers
                    setTimeout(() => setShowBrokerModal(false), 2000);
                  }}
                  onError={(error) => {
                    setBrokerStatusMessage(`Error: ${error}`);
                  }}
                  onClose={() => setShowBrokerModal(false)}
                />
              </div>
            ) : (
              /* Manual Entry Form */
              <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {brokerOptions.map((option) => (
                <button
                  key={option.id}
                  onClick={() => {
                    setSelectedBroker(option.id);
                    setBrokerStatusMessage('');
                  }}
                  className={`rounded-xl border p-4 text-left transition-colors ${
                    selectedBroker === option.id
                      ? isDark
                        ? 'bg-[#2a2a2a] border-[#6a6a6a] text-[#e8e8e8]'
                        : 'bg-[#f3f3f3] border-[#8a8a8a] text-[#2a2a2a]'
                      : isDark
                        ? 'bg-[#202020] border-[#3a3a3a] text-[#e8e8e8]'
                        : 'bg-white border-[#d0d0d0] text-[#2a2a2a]'
                  }`}
                >
                  <div className="font-semibold text-sm">{option.title}</div>
                  <div className={`text-xs mt-1 ${isDark ? 'text-[#9a9a9a]' : 'text-[#6a6a6a]'}`}>{option.subtitle}</div>
                </button>
              ))}
            </div>

            <div className={`rounded-xl border p-4 space-y-4 ${isDark ? 'bg-[#202020] border-[#3a3a3a]' : 'bg-[#fafafa] border-[#d0d0d0]'}`}>
              <div>
                <label className={`block text-xs font-medium mb-2 ${isDark ? 'text-[#e8e8e8]' : 'text-[#2a2a2a]'}`}>Broker Label</label>
                <input
                  type="text"
                  value={brokerLabel}
                  onChange={(e) => setBrokerLabel(e.target.value)}
                  className={`w-full px-3 py-2 rounded-lg border text-sm transition-colors ${
                    isDark
                      ? 'bg-[#1a1a1a] border-[#3a3a3a] text-[#e8e8e8] placeholder-[#6a6a6a]'
                      : 'bg-white border-[#d0d0d0] text-[#2a2a2a] placeholder-[#9a9a9a]'
                  } focus:outline-none`}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={`block text-xs font-medium mb-2 ${isDark ? 'text-[#e8e8e8]' : 'text-[#2a2a2a]'}`}>Account ID</label>
                  <input
                    type="text"
                    value={brokerAccountId}
                    onChange={(e) => setBrokerAccountId(e.target.value)}
                    placeholder="Enter account number"
                    className={`w-full px-3 py-2 rounded-lg border text-sm transition-colors ${
                      isDark
                        ? 'bg-[#1a1a1a] border-[#3a3a3a] text-[#e8e8e8] placeholder-[#6a6a6a]'
                        : 'bg-white border-[#d0d0d0] text-[#2a2a2a] placeholder-[#9a9a9a]'
                    } focus:outline-none`}
                  />
                </div>
                <div>
                  <label className={`block text-xs font-medium mb-2 ${isDark ? 'text-[#e8e8e8]' : 'text-[#2a2a2a]'}`}>Server / Workspace</label>
                  <input
                    type="text"
                    value={brokerServerName}
                    onChange={(e) => setBrokerServerName(e.target.value)}
                    placeholder="Enter broker server name"
                    className={`w-full px-3 py-2 rounded-lg border text-sm transition-colors ${
                      isDark
                        ? 'bg-[#1a1a1a] border-[#3a3a3a] text-[#e8e8e8] placeholder-[#6a6a6a]'
                        : 'bg-white border-[#d0d0d0] text-[#2a2a2a] placeholder-[#9a9a9a]'
                    } focus:outline-none`}
                  />
                </div>
              </div>

              <div>
                <label className={`block text-xs font-medium mb-2 ${isDark ? 'text-[#e8e8e8]' : 'text-[#2a2a2a]'}`}>Password / Access Token</label>
                <input
                  type="password"
                  value={brokerSecret}
                  onChange={(e) => setBrokerSecret(e.target.value)}
                  placeholder={selectedBroker === 'mt5-web' ? 'Enter broker password' : 'Enter API Secret or Token'}
                  className={`w-full px-3 py-2 rounded-lg border text-sm transition-colors ${
                    isDark
                      ? 'bg-[#1a1a1a] border-[#3a3a3a] text-[#e8e8e8] placeholder-[#6a6a6a]'
                      : 'bg-white border-[#d0d0d0] text-[#2a2a2a] placeholder-[#9a9a9a]'
                  } focus:outline-none`}
                />
              </div>

              {brokerStatusMessage && (
                <div className={`text-xs ${isDark ? 'text-[#bcbcbc]' : 'text-[#4a4a4a]'}`}>{brokerStatusMessage}</div>
              )}

              <button
                onClick={handleBrokerSave}
                className={`px-4 py-2.5 rounded-lg transition-colors text-sm font-medium ${isDark ? 'bg-[#e8e8e8] text-[#1a1a1a] hover:bg-[#d8d8d8]' : 'bg-[#2a2a2a] text-white hover:bg-[#3a3a3a]'}`}
              >
                Connect {brokerOptions.find((option) => option.id === selectedBroker)?.title}
              </button>
            </div>

            <div className="space-y-3">
              <div className={`text-sm font-semibold ${isDark ? 'text-[#e8e8e8]' : 'text-[#2a2a2a]'}`}>Connected Brokers</div>
              {connectedBrokers.length === 0 ? (
                <div className={`rounded-xl border p-4 text-sm ${isDark ? 'bg-[#202020] border-[#3a3a3a] text-[#9a9a9a]' : 'bg-[#fafafa] border-[#d0d0d0] text-[#6a6a6a]'}`}>
                  No brokers connected yet.
                </div>
              ) : (
                connectedBrokers.map((broker) => (
                  <div
                    key={broker.id}
                    className={`rounded-xl border p-4 flex items-start justify-between gap-4 ${isDark ? 'bg-[#202020] border-[#3a3a3a]' : 'bg-[#fafafa] border-[#d0d0d0]'}`}
                  >
                    <div>
                      <div className={`font-medium text-sm ${isDark ? 'text-[#e8e8e8]' : 'text-[#2a2a2a]'}`}>{broker.brokerLabel}</div>
                      <div className={`text-xs mt-1 ${isDark ? 'text-[#9a9a9a]' : 'text-[#6a6a6a]'}`}>
                        {broker.accountId} • {broker.serverName}
                      </div>
                      <div className={`text-[10px] mt-1 ${isDark ? 'text-[#7f7f7f]' : 'text-[#8a8a8a]'}`}>
                        Connected {new Date(broker.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                    <button
                      onClick={() => handleBrokerDelete(broker.id)}
                      className={`text-xs px-3 py-1.5 rounded-lg ${isDark ? 'bg-[#2a2a2a] text-[#e8e8e8] hover:bg-[#333333]' : 'bg-white text-[#2a2a2a] hover:bg-[#f0f0f0] border border-[#d0d0d0]'}`}
                    >
                      Remove
                    </button>
                  </div>
                ))
              )}
            </div>
              </>
            )}
          </div>
        </div>
      </>
    );
  }

  const handleTelegramConnect = () => {
    // Generate a unique token for this user session to link Telegram account
    // In production, this should be a secure token from your backend
    const userId = 'user_' + Math.random().toString(36).substr(2, 9);
    const timestamp = Date.now();
    const connectionToken = btoa(`${userId}_${timestamp}`); // Base64 encode for URL safety
    
    // Open Telegram bot with start parameter containing the connection token
    // When user clicks "START" in Telegram, bot receives: /start {connectionToken}
    // The bot can then use this token to link the Telegram ID with the Glass-IDE account
    window.open(`https://t.me/impulsehub_bot?start=${connectionToken}`, '_blank');
    
    console.log('Connection token generated:', connectionToken);
    // Store token in localStorage to verify connection later
    localStorage.setItem('telegram_connection_token', connectionToken);
    localStorage.setItem('telegram_connection_pending', 'true');
  };

  const handleTelegramSave = async () => {
    setIsSavingTelegram(true);
    setStatusMessage('');

    try {
      const updatedUser = await supabaseAuth.updateProfile({ telegramId });
      onUserUpdate(updatedUser);
      setStatusMessage('Telegram verified successfully.');
    } catch (error: any) {
      setStatusMessage(error.message || 'Unable to verify Telegram ID.');
    } finally {
      setIsSavingTelegram(false);
    }
  };

  // Show Notifications modal if requested
  if (showNotificationsModal) {
    return (
      <>
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100]" onClick={() => setShowNotificationsModal(false)} />
        <div className={`fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-[101] ${isDark ? 'bg-[#1a1a1a]' : 'bg-white'} rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col`}>
          {/* Header */}
          <div className={`flex items-center justify-between p-6 border-b ${isDark ? 'border-[#3a3a3a]' : 'border-[#d0d0d0]'}`}>
            <h2 className={`text-xl font-semibold ${isDark ? 'text-[#e8e8e8]' : 'text-[#2a2a2a]'}`}>
              Economic Calendar & Alerts
            </h2>
            <button
              onClick={() => setShowNotificationsModal(false)}
              className={`w-8 h-8 rounded-lg ${isDark ? 'hover:bg-[#2a2a2a]' : 'hover:bg-[#f0f0f0]'} flex items-center justify-center transition-colors`}
            >
              <X className={`w-5 h-5 ${isDark ? 'text-[#9a9a9a]' : 'text-[#6a6a6a]'}`} />
            </button>
          </div>
          
          {/* Content */}
          <div className="overflow-y-auto flex-1 p-6 space-y-6">
            {/* Subscription Toggle */}
            <div className={`p-4 rounded-lg border ${isDark ? 'border-[#3a3a3a] bg-[#2a2a2a]' : 'border-[#d0d0d0] bg-[#f8f8f8]'}`}>
              <h3 className={`font-semibold mb-4 ${isDark ? 'text-[#e8e8e8]' : 'text-[#2a2a2a]'}`}>
                Notification Preferences
              </h3>
              
              <div className="space-y-3">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={subscribeNews}
                    onChange={(e) => setSubscribeNews(e.target.checked)}
                    className="w-4 h-4 rounded"
                  />
                  <div>
                    <div className={`font-medium text-sm ${isDark ? 'text-[#e8e8e8]' : 'text-[#2a2a2a]'}`}>
                      Calendar Event Alerts
                    </div>
                    <div className={`text-xs ${isDark ? 'text-[#9a9a9a]' : 'text-[#6a6a6a]'}`}>
                      Get notified about upcoming economic events
                    </div>
                  </div>
                </label>
                
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={subscribeAlerts}
                    onChange={(e) => setSubscribeAlerts(e.target.checked)}
                    className="w-4 h-4 rounded"
                  />
                  <div>
                    <div className={`font-medium text-sm ${isDark ? 'text-[#e8e8e8]' : 'text-[#2a2a2a]'}`}>
                      Breaking News Alerts
                    </div>
                    <div className={`text-xs ${isDark ? 'text-[#9a9a9a]' : 'text-[#6a6a6a]'}`}>
                      Get notified about market-moving news
                    </div>
                  </div>
                </label>
              </div>
            </div>

            {/* Live Calendar */}
            <div>
              <h3 className={`font-semibold mb-3 ${isDark ? 'text-[#e8e8e8]' : 'text-[#2a2a2a]'}`}>
                Live Economic Calendar
              </h3>

              <div className={`rounded-xl border p-4 ${isDark ? 'border-[#3a3a3a] bg-[#2a2a2a]' : 'border-[#d0d0d0] bg-[#f8f8f8]'}`}>
                <div className={`mb-4 flex items-center justify-between text-sm ${isDark ? 'text-[#e8e8e8]' : 'text-[#2a2a2a]'}`}>
                  <span className="font-semibold">Real-time news and macro events</span>
                  <span className={`${isDark ? 'text-[#9a9a9a]' : 'text-[#6a6a6a]'}`}>Updates without code edits</span>
                </div>

                <div className={`overflow-hidden rounded-xl border ${isDark ? 'border-[#3a3a3a]' : 'border-[#d0d0d0]'}`}>
                  <TradingViewCalendarWidget isDark={isDark} />
                </div>
                <div className={`mt-3 text-xs ${isDark ? 'text-[#9a9a9a]' : 'text-[#6a6a6a]'}`}>
                  This live widget refreshes from TradingView instead of relying on hardcoded news dates in the code.
                </div>
              </div>
            </div>
            
            <button
              onClick={() => {
                // Open TradingView economic calendar in modal
                const width = 900;
                const height = 700;
                const left = (window.innerWidth - width) / 2;
                const top = (window.innerHeight - height) / 2;
                window.open('https://www.tradingview.com/economic-calendar/', 'economic-calendar', `width=${width},height=${height},left=${left},top=${top}`);
              }}
              className={`w-full px-4 py-3 rounded-lg font-medium transition-colors ${isDark ? 'bg-[#2a2a2a] hover:bg-[#3a3a3a] text-[#e8e8e8] border border-[#3a3a3a]' : 'bg-[#2a2a2a] hover:bg-[#1a1a1a] text-white border border-gray-300'}`}
            >
              View Full Calendar
            </button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 backdrop-blur-sm z-30"
        onClick={onClose}
      />

      {/* Sidebar */}
      <aside className={`fixed top-12 right-0 bottom-8 w-96 ${isDark ? 'bg-[#1a1a1a] border-[#3a3a3a]' : 'bg-[#f5f5f0] border-[#d0d0d0]'} border-l z-40 flex flex-col shadow-2xl`}>
        {/* Header */}
        <div className={`p-6 border-b ${isDark ? 'border-[#3a3a3a]' : 'border-[#d0d0d0]'}`}>
          <div className="flex items-center justify-between mb-4">
            <h2 className={`text-lg font-semibold ${isDark ? 'text-[#e8e8e8]' : 'text-[#2a2a2a]'}`}>
              User Dashboard
            </h2>
            <button
              onClick={onClose}
              className={`w-8 h-8 rounded-lg ${isDark ? 'hover:bg-[#2a2a2a]' : 'hover:bg-[#e8e8e8]'} flex items-center justify-center transition-colors`}
            >
              <X className={`w-4 h-4 ${isDark ? 'text-[#9a9a9a]' : 'text-[#6a6a6a]'}`} />
            </button>
          </div>

          {/* User Info */}
          <div className={`flex items-center gap-3 p-3 ${isDark ? 'bg-[#2a2a2a] border-[#3a3a3a]' : 'bg-white border-[#d0d0d0]'} rounded-xl border`}>
            <div className={`w-12 h-12 rounded-full ${isDark ? 'bg-[#e8e8e8] text-[#1a1a1a]' : 'bg-[#2a2a2a] text-[#e8e8e8]'} flex items-center justify-center font-semibold`}>
              {userInitials}
            </div>
            <div>
              <div className={`font-medium text-sm ${isDark ? 'text-[#e8e8e8]' : 'text-[#2a2a2a]'}`}>
                {user?.fullName || 'Impulse Hub User'}
              </div>
              <div className={`text-xs ${isDark ? 'text-[#9a9a9a]' : 'text-[#6a6a6a]'}`}>
                {user?.email || 'No email available'}
              </div>
            </div>
          </div>
        </div>

        {/* Menu Items */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Portfolio Section */}
          <div className="mb-6">
            <div className={`flex items-center gap-2 px-2 mb-3 ${isDark ? 'text-[#e8e8e8]' : 'text-[#2a2a2a]'}`}>
              <PieChart className="w-4 h-4" />
              <h3 className="text-xs font-semibold uppercase tracking-wider">Portfolio</h3>
            </div>
            
            <div className={`${isDark ? 'bg-[#2a2a2a] border-[#3a3a3a]' : 'bg-white border-[#d0d0d0]'} rounded-xl p-4 border`}>
              <div className={`text-xs ${isDark ? 'text-[#9a9a9a]' : 'text-[#6a6a6a]'}`}>
                No Portfolio Data Yet
              </div>
              <div className={`text-sm ${isDark ? 'text-[#6a6a6a]' : 'text-[#9a9a9a]'} mt-2`}>
                Start using Micromax to begin tracking your portfolio. Your trading data will appear here.
              </div>
            </div>
          </div>

          {/* Performance Section - Only show if user has trading data */}
          <div className="mb-6">
            <div className={`flex items-center gap-2 px-2 mb-3 ${isDark ? 'text-[#e8e8e8]' : 'text-[#2a2a2a]'}`}>
              <TrendingUp className="w-4 h-4" />
              <h3 className="text-xs font-semibold uppercase tracking-wider">Performance</h3>
            </div>
            <div className="space-y-3">
              <div className={`${isDark ? 'bg-[#2a2a2a] border-[#3a3a3a]' : 'bg-white border-[#d0d0d0]'} rounded-xl p-4 border`}>
                <div className={`text-xs ${isDark ? 'text-[#9a9a9a]' : 'text-[#6a6a6a]'} mb-1`}>
                  Performance data will populate as you execute trades
                </div>
              </div>
            </div>
          </div>

          {/* Menu Section */}
          <div className="mb-6 space-y-2">
            <button
              onClick={() => setShowSettingsPage(true)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isDark ? 'hover:bg-[#2a2a2a] text-[#e8e8e8]' : 'hover:bg-[#e8e8e8] text-[#2a2a2a]'}`}
            >
              <Settings className="w-4 h-4" />
              <span className="text-sm font-medium">Settings</span>
            </button>

            <button
              onClick={() => setShowBillingPage(true)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isDark ? 'hover:bg-[#2a2a2a] text-[#e8e8e8]' : 'hover:bg-[#e8e8e8] text-[#2a2a2a]'}`}
            >
              <CreditCard className="w-4 h-4" />
              <span className="text-sm font-medium">Billing & Plans</span>
            </button>

            <button
              onClick={() => {
                setShowNotificationsModal(true);
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isDark ? 'hover:bg-[#2a2a2a] text-[#e8e8e8]' : 'hover:bg-[#e8e8e8] text-[#2a2a2a]'}`}
            >
              <Bell className="w-4 h-4" />
              <span className="text-sm font-medium">Notifications</span>
            </button>

            <button
              onClick={() => {
                setShowBrokerModal(true);
                setBrokerStatusMessage('');
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isDark ? 'hover:bg-[#2a2a2a] text-[#e8e8e8]' : 'hover:bg-[#e8e8e8] text-[#2a2a2a]'}`}
            >
              <Wallet className="w-4 h-4" />
              <span className="text-sm font-medium">Connect Broker</span>
            </button>
          </div>

          {/* Telegram Connection Section */}
          <div className="mb-6">
            <div className={`flex items-center gap-2 px-2 mb-3 ${isDark ? 'text-[#e8e8e8]' : 'text-[#2a2a2a]'}`}>
              <Send className="w-4 h-4" />
              <h3 className="text-xs font-semibold uppercase tracking-wider">Telegram Notifications</h3>
            </div>
            <div className={`${isDark ? 'bg-[#2a2a2a] border-[#3a3a3a]' : 'bg-white border-[#d0d0d0]'} rounded-xl p-4 border space-y-3`}>
              {/* Bot Info */}
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full ${isDark ? 'bg-[#2a2a2a] border-[#3a3a3a]' : 'bg-[#f3f0e8] border-[#d8d2c6]'} border flex items-center justify-center`}>
                  <Send className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className={`text-sm font-semibold ${isDark ? 'text-[#e8e8e8]' : 'text-[#2a2a2a]'}`}>
                    Micromax Bot
                  </div>
                  <div className={`text-[10px] ${isDark ? 'text-[#9a9a9a]' : 'text-[#6a6a6a]'}`}>
                    @impulsehub_bot
                  </div>
                </div>
              </div>

              {/* Description */}
              <div className={`text-xs ${isDark ? 'text-[#9a9a9a]' : 'text-[#6a6a6a]'}`}>
                Connect to receive real-time trade signals, chart analysis, and personalized alerts directly to your Telegram.
              </div>

              {/* Connection UI */}
              {!user?.telegramId ? (
                <>
                  <button
                    onClick={() => window.open('https://t.me/impulsehub_bot', '_blank')}
                    className={`w-full px-4 py-2.5 rounded-lg transition-colors text-sm font-medium ${isDark ? 'bg-[#1a1a1a] hover:bg-[#2a2a2a] border border-[#3a3a3a] text-[#e8e8e8]' : 'bg-white hover:bg-[#f5f5f5] border border-[#d0d0d0] text-[#2a2a2a]'}`}
                  >
                    Connect Telegram
                  </button>

                  <label className={`block text-xs font-medium mb-2 ${isDark ? 'text-[#e8e8e8]' : 'text-[#2a2a2a]'}`}>
                    Telegram ID
                  </label>
                  <input
                    type="text"
                    value={telegramId}
                    onChange={(e) => setTelegramId(e.target.value)}
                    placeholder="Enter your Telegram user ID"
                    className={`w-full px-3 py-2 rounded-lg border text-sm transition-colors ${
                      isDark
                        ? 'bg-[#1a1a1a] border-[#3a3a3a] text-[#e8e8e8] placeholder-[#6a6a6a] focus:border-[#6a6a6a]'
                        : 'bg-white border-[#d0d0d0] text-[#2a2a2a] placeholder-[#9a9a9a] focus:border-[#9a9a9a]'
                    } focus:outline-none`}
                  />
                  <div className={`text-[10px] mt-1.5 ${isDark ? 'text-[#9a9a9a]' : 'text-[#6a6a6a]'}`}>
                    Open Telegram bot @impulsehub_bot to get your ID
                  </div>
                  
                  <button
                    onClick={handleTelegramSave}
                    disabled={!telegramId.trim() || isSavingTelegram}
                    className={`w-full px-4 py-2.5 rounded-lg transition-colors text-sm font-medium ${
                      !telegramId.trim() || isSavingTelegram
                        ? isDark ? 'bg-[#1a1a1a] border border-[#3a3a3a] text-[#6a6a6a] cursor-not-allowed' : 'bg-gray-100 border border-gray-200 text-gray-400 cursor-not-allowed'
                        : isDark ? 'bg-black hover:bg-[#2a2a2a] border border-[#3a3a3a] text-[#e8e8e8]' : 'bg-black hover:bg-gray-800 border border-gray-300 text-white'
                    }`}
                  >
                    {isSavingTelegram ? 'Verifying...' : 'Verify'}
                  </button>
                </>
              ) : (
                <>
                  <div className={`flex items-center gap-2 p-3 rounded-lg ${isDark ? 'bg-green-500/10 border border-green-500/30' : 'bg-green-50 border border-green-200'}`}>
                    <div className="w-3 h-3 rounded-full bg-green-500"></div>
                    <div className={`text-sm font-medium ${isDark ? 'text-green-400' : 'text-green-700'}`}>
                      Verified
                    </div>
                  </div>
                  <button
                    onClick={() => window.open('https://t.me/impulsehub_bot', '_blank')}
                    className={`w-full px-4 py-2.5 rounded-lg transition-colors text-sm font-medium ${isDark ? 'bg-black hover:bg-[#2a2a2a] border border-[#3a3a3a] text-[#e8e8e8]' : 'bg-black hover:bg-gray-800 border border-gray-300 text-white'}`}
                  >
                    Go to Telegram
                  </button>
                  <button
                    onClick={() => {
                      supabaseAuth.updateProfile({ telegramId: '' });
                      setTelegramId('');
                      setStatusMessage('Telegram disconnected');
                    }}
                    className={`w-full px-4 py-2.5 rounded-lg text-sm transition-colors font-medium ${isDark ? 'bg-red-600/30 hover:bg-red-600/40 border border-red-600/50 text-red-400' : 'bg-red-50 hover:bg-red-100 border border-red-200 text-red-700'}`}
                  >
                    Disconnect
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className={`p-4 border-t ${isDark ? 'border-[#3a3a3a]' : 'border-[#d0d0d0]'}`}>
          <button
            onClick={onSignOut}
            className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl ${isDark ? 'bg-[#2a2a2a] hover:bg-[#3a3a3a] border-[#3a3a3a] text-[#9a9a9a]' : 'bg-white hover:bg-[#e8e8e8] border-[#d0d0d0] text-[#6a6a6a]'} transition-colors border`}
          >
            <LogOut className="w-4 h-4" />
            <span className="text-sm font-medium">Sign Out</span>
          </button>
        </div>
      </aside>
    </>
  );
}
