import React, { useState, useEffect } from 'react';
import { supabaseAuth } from '../services/supabaseAuth';
import { telegramNotificationService } from '../services/telegramNotificationService';
import { AlertCircle, CheckCircle2, Loader2, Send } from 'lucide-react';

export interface TelegramManagerProps {
  onSuccess?: () => void;
  onError?: (error: string) => void;
  compact?: boolean;
}

export const TelegramManager: React.FC<TelegramManagerProps> = ({
  onSuccess,
  onError,
  compact = false,
}) => {
  const [telegramId, setTelegramId] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [validationStatus, setValidationStatus] = useState<'idle' | 'valid' | 'invalid'>('idle');
  const [message, setMessage] = useState('');
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      const user = await supabaseAuth.getCurrentUser();
      if (user) {
        setCurrentUser(user);
        if (user.telegramId) {
          setTelegramId(user.telegramId);
          setValidationStatus('valid');
        }
      }
    } catch (error) {
      console.error('Failed to load user data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const validateTelegramId = (id: string) => {
    const isValid = /^\d{5,}$/.test(id.trim());
    setValidationStatus(isValid ? 'valid' : 'invalid');
    return isValid;
  };

  const handleTelegramIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setTelegramId(value);
    
    if (value.trim()) {
      validateTelegramId(value);
    } else {
      setValidationStatus('idle');
    }
  };

  const handleOpenTelegramBot = () => {
    window.open('https://t.me/Impulsehub_bot?start=manager', '_blank');
    setMessage('💬 Follow the instructions in the Telegram bot to get your ID.');
  };

  const handleSaveAndTest = async () => {
    if (!validateTelegramId(telegramId)) {
      setMessage('❌ Please enter a valid Telegram ID (numeric, at least 5 digits)');
      onError?.('Invalid Telegram ID');
      return;
    }

    setIsValidating(true);
    setMessage('');

    try {
      // Update user profile with Telegram ID
      const updatedUser = await supabaseAuth.updateTelegramId(telegramId);
      setCurrentUser(updatedUser);
      setValidationStatus('valid');
      setMessage('⏳ Sending test notification...');

      // Send test notification immediately
      setIsSending(true);
      const testResult = await telegramNotificationService.sendTestMessage(telegramId);
      
      if (testResult.success) {
        setMessage('✅ Telegram ID saved and test message sent! Check your Telegram for the message.');
        onSuccess?.();
      } else {
        setMessage(`⚠️ ID saved but test failed: ${testResult.error}. You should still receive notifications.`);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to save Telegram ID';
      setMessage(`❌ ${errorMsg}`);
      setValidationStatus('invalid');
      onError?.(errorMsg);
    } finally {
      setIsValidating(false);
      setIsSending(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-4">
        <Loader2 className="h-5 w-5 animate-spin text-amber-500" />
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
        <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 inline mr-2" />
        <span className="text-yellow-800 dark:text-yellow-200">Please sign in to enable Telegram notifications</span>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${compact ? 'p-3' : 'p-6'} bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700`}>
      <div className="space-y-2">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          📱 Telegram Notifications
        </h3>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Get instant trade alerts directly on Telegram
        </p>
      </div>

      <div className="space-y-3">
        {/* Step 1: Open Telegram Bot */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
            Step 1: Connect with Telegram Bot
          </label>
          <button
            onClick={handleOpenTelegramBot}
            className="w-full px-4 py-2 border rounded-lg transition-colors dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100 dark:hover:bg-slate-700 border-slate-300 bg-white text-slate-900 hover:bg-slate-50"
          >
            🔗 Open Telegram Bot (@Impulsehub_bot)
          </button>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Click the button above, start the bot, and copy your Telegram ID
          </p>
        </div>

        {/* Step 2: Enter Telegram ID */}
        <div className="space-y-2">
          <label htmlFor="telegram-id" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
            Step 2: Paste Your Telegram ID
          </label>
          <div className="flex gap-2">
            <input
              id="telegram-id"
              type="text"
              placeholder="Enter your Telegram ID (numeric)"
              value={telegramId}
              onChange={handleTelegramIdChange}
              disabled={isValidating || isSending}
              className="flex-1 px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100 border-slate-300 bg-white text-slate-900"
            />
            {validationStatus === 'valid' && (
              <CheckCircle2 className="h-6 w-6 text-green-500 flex-shrink-0" />
            )}
            {validationStatus === 'invalid' && telegramId && (
              <AlertCircle className="h-6 w-6 text-red-500 flex-shrink-0" />
            )}
          </div>
        </div>

        {/* Step 3: Save and Test */}
        <div className="space-y-2">
          <button
            onClick={handleSaveAndTest}
            disabled={!telegramId || validationStatus === 'invalid' || isValidating || isSending}
            className="w-full bg-stone-900 hover:bg-stone-800 dark:bg-stone-100 dark:hover:bg-stone-200 text-white dark:text-stone-900 px-4 py-2 rounded-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isValidating || isSending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {isSending ? 'Sending Test...' : 'Saving...'}
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                Save & Send Test Message
              </>
            )}
          </button>
        </div>

        {/* Status Message */}
        {message && (
          <div className={`p-3 rounded-lg text-sm ${
            message.includes('✅') 
              ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200 border border-green-200 dark:border-green-800' 
              : message.includes('❌')
              ? 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200 border border-red-200 dark:border-red-800'
              : 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-200 border border-yellow-200 dark:border-yellow-800'
          }`}>
            {message}
          </div>
        )}

        {/* Success State */}
        {currentUser.telegramId && validationStatus === 'valid' && !message && (
          <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-sm text-green-800 dark:text-green-200 flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 flex-shrink-0" />
            <span>Telegram notifications enabled for ID: {currentUser.telegramId}</span>
          </div>
        )}
      </div>

      {/* Info Section */}
      <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg text-sm text-amber-800 dark:text-amber-200 space-y-1">
        <p className="font-medium">ℹ️ What you'll get:</p>
        <ul className="list-disc list-inside space-y-1 text-xs">
          <li>Real-time trading alerts</li>
          <li>Price change notifications</li>
          <li>Bot status updates</li>
          <li>Error notifications</li>
        </ul>
      </div>
    </div>
  );
};

export default TelegramManager;
