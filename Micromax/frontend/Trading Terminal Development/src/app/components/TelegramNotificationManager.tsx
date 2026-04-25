import { useState } from 'react';
import { Send, CheckCircle2, AlertCircle, Bell } from 'lucide-react';
import { supabaseAuth, AuthUser } from '../services/supabaseAuth';

interface TelegramNotificationManagerProps {
  user: AuthUser;
  isDark: boolean;
  onUpdate?: () => void;
}

export function TelegramNotificationManager({
  user,
  isDark,
  onUpdate,
}: TelegramNotificationManagerProps) {
  const [telegramId, setTelegramId] = useState(user.telegramId || '');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const validateTelegramId = (id: string): boolean => /^\d{5,}$/.test(id);
  const isValid = telegramId && validateTelegramId(telegramId);

  const handleUpdate = async () => {
    if (!isValid) {
      setError('Please enter a valid Telegram ID');
      return;
    }

    setIsLoading(true);
    setError('');
    setSuccess('');

    try {
      await supabaseAuth.updateTelegramId(telegramId);
      setSuccess('Telegram ID updated. Alerts will use this ID.');
      onUpdate?.();
    } catch (err: any) {
      setError(err.message || 'Failed to update Telegram ID');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenTelegramBot = () => {
    window.open('https://t.me/Impulsehub_bot?start=notifications', '_blank');
  };

  const handleTelegramBlur = async () => {
    if (!telegramId || !isValid || telegramId === user.telegramId) {
      return;
    }

    await handleUpdate();
  };

  return (
    <div
      className={`p-6 rounded-lg border ${
        isDark ? 'bg-[#2a2a2a] border-[#3a3a3a]' : 'bg-[#f5f5f0] border-[#d0d0d0]'
      }`}
    >
      <div className="flex items-center gap-3 mb-6">
        <Bell className={`w-6 h-6 ${isDark ? 'text-[#9a9a9a]' : 'text-[#6a6a6a]'}`} />
        <h2 className={`text-lg font-semibold ${isDark ? 'text-[#e8e8e8]' : 'text-[#2a2a2a]'}`}>
          Telegram Notifications
        </h2>
      </div>

      <p className={`text-sm mb-4 ${isDark ? 'text-[#9a9a9a]' : 'text-[#6a6a6a]'}`}>
        Receive real-time alerts when Micromax identifies trading opportunities.
        Get instant notifications in your private Telegram chat.
      </p>

      {user.telegramId && (
        <div
          className={`mb-4 p-3 rounded-lg flex items-start gap-2 ${
            isDark
              ? 'bg-green-900/20 border border-green-500/30'
              : 'bg-green-50 border border-green-200'
          }`}
        >
          <CheckCircle2
            className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
              isDark ? 'text-green-400' : 'text-green-600'
            }`}
          />
          <div>
            <p className={`text-sm font-semibold ${isDark ? 'text-green-400' : 'text-green-700'}`}>
              Notifications Active
            </p>
            <p className={`text-xs ${isDark ? 'text-green-300/80' : 'text-green-600/80'}`}>
              Your Telegram ID: <span className="font-mono">{user.telegramId}</span>
            </p>
          </div>
        </div>
      )}

      {error && (
        <div
          className={`mb-4 p-3 rounded-lg flex items-start gap-2 ${
            isDark ? 'bg-red-900/20 border border-red-500/30' : 'bg-red-50 border border-red-200'
          }`}
        >
          <AlertCircle
            className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
              isDark ? 'text-red-400' : 'text-red-600'
            }`}
          />
          <span className={`text-sm ${isDark ? 'text-red-400' : 'text-red-700'}`}>{error}</span>
        </div>
      )}

      {success && (
        <div
          className={`mb-4 p-3 rounded-lg flex items-start gap-2 ${
            isDark
              ? 'bg-green-900/20 border border-green-500/30'
              : 'bg-green-50 border border-green-200'
          }`}
        >
          <CheckCircle2
            className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
              isDark ? 'text-green-400' : 'text-green-600'
            }`}
          />
          <span className={`text-sm ${isDark ? 'text-green-400' : 'text-green-700'}`}>{success}</span>
        </div>
      )}

      <div className="space-y-4 mb-4">
        <div>
          <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-[#d6d6d6]' : 'text-[#4a4a4a]'}`}>
            Telegram User ID
          </label>
          <input
            type="text"
            value={telegramId}
            onChange={(e) => setTelegramId(e.target.value.trim())}
            onBlur={handleTelegramBlur}
            placeholder="Enter your Telegram User ID (numeric only)"
            disabled={isLoading}
            className={`w-full px-4 py-2 rounded-lg transition-colors disabled:opacity-50 ${
              telegramId && !isValid
                ? isDark
                  ? 'bg-red-900/20 border border-red-500/50 text-slate-100 placeholder-slate-400 focus:border-red-500 focus:outline-none'
                  : 'bg-red-50 border border-red-300 text-slate-900 placeholder-slate-500 focus:border-red-500 focus:outline-none'
                : isDark
                  ? 'bg-[#1f1f1f] border border-[#3a3a3a] text-[#e8e8e8] placeholder-[#6a6a6a] focus:border-[#6a6a6a] focus:outline-none'
                  : 'bg-white border border-[#d0d0d0] text-[#2a2a2a] placeholder-[#9a9a9a] focus:border-[#9a9a9a] focus:outline-none'
            }`}
          />
          {telegramId && (
            <p
              className={`text-xs mt-1 ${
                isValid
                  ? isDark
                    ? 'text-green-400'
                    : 'text-green-600'
                  : isDark
                    ? 'text-red-400'
                    : 'text-red-600'
              }`}
            >
              {isValid ? 'Valid Telegram ID format' : 'ID must be numeric (at least 5 digits)'}
            </p>
          )}
        </div>

        <div className={`p-3 rounded-lg text-xs ${isDark ? 'bg-[#232323]' : 'bg-white'}`}>
          <p className={`font-semibold mb-2 ${isDark ? 'text-[#d6d6d6]' : 'text-[#4a4a4a]'}`}>
            How to find your Telegram ID:
          </p>
          <ol className={`list-decimal list-inside space-y-1 ${isDark ? 'text-[#9a9a9a]' : 'text-[#6a6a6a]'}`}>
            <li>Click the button below to open the bot</li>
            <li>
              Type <code className={`px-1 py-0.5 rounded ${isDark ? 'bg-[#1a1a1a]' : 'bg-[#f0f0f0]'}`}>/myid</code> and send it
            </li>
            <li>Copy the numeric ID the bot shows you</li>
            <li>Paste it in the field above</li>
          </ol>
        </div>
      </div>

      <div className="space-y-3">
        <button
          type="button"
          onClick={handleOpenTelegramBot}
          disabled={isLoading}
          className={`w-full px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2 ${
            isDark
              ? 'bg-[#1f1f1f] hover:bg-[#252525] text-[#e8e8e8] border border-[#3a3a3a]'
              : 'bg-white hover:bg-[#f5f5f0] text-[#2a2a2a] border border-[#d0d0d0]'
          }`}
        >
          <Send className="w-4 h-4" />
          Open Telegram Bot
          <Send className="w-4 h-4" />
        </button>
        <p className={`text-xs ${isDark ? 'text-[#9a9a9a]' : 'text-[#6a6a6a]'}`}>
          Telegram ID saves automatically when you leave the input field.
        </p>
      </div>

      <div
        className={`mt-4 p-3 rounded-lg text-xs border ${
          isDark ? 'bg-[#232323] border-[#3a3a3a] text-[#9a9a9a]' : 'bg-white border-[#d0d0d0] text-[#6a6a6a]'
        }`}
      >
        <p className="font-semibold mb-1">Your privacy matters:</p>
        <ul className="space-y-0.5">
          <li>Your Telegram ID is encrypted</li>
          <li>Only trading alerts will be sent to your Telegram</li>
          <li>You can update or disable notifications anytime</li>
        </ul>
      </div>
    </div>
  );
}
