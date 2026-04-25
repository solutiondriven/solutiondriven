import { useState } from 'react';
import { LogIn, UserPlus, Send, CheckCircle2, AlertCircle } from 'lucide-react';
// import telegramIcon from 'figma:asset/8edea62b401b9473c284dd35607fbf7d227ce8a6.png';
import { AuthUser, supabaseAuth } from '../services/supabaseAuth';

interface LoginModalProps {
  onLogin: (user: AuthUser) => void;
  isDark: boolean;
}

export function LoginModal({ onLogin, isDark }: LoginModalProps) {
  const [isSignup, setIsSignup] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [telegramId, setTelegramId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [telegramIdValid, setTelegramIdValid] = useState(false);

  const validateTelegramId = (id: string): boolean => {
    return /^\d{5,}$/.test(id); // Telegram IDs are numeric and usually 8-10 digits
  };

  const handleTelegramIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.trim();
    setTelegramId(value);
    setTelegramIdValid(validateTelegramId(value));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');
    setSuccess('');

    try {
      if (isSignup) {
        if (!name.trim()) {
          throw new Error('Full name is required');
        }
        if (!phone.trim()) {
          throw new Error('Phone number is required');
        }
        if (telegramId && !validateTelegramId(telegramId)) {
          throw new Error('Invalid Telegram ID format');
        }

        console.log('📝 Signing up user:', { email, name, phone, telegramId });
        
        const user = await supabaseAuth.signUp({
          email,
          password,
          fullName: name,
          phone,
          telegramId,
        });

        setSuccess('✅ Account created successfully! You will receive Telegram notifications.');
        console.log('✅ Signup successful, logging in...');
        onLogin(user);
      } else {
        console.log('🔑 Signing in user:', email);
        const user = await supabaseAuth.signIn({
          email,
          password,
        });

        setSuccess('✅ Logged in successfully!');
        console.log('✅ Signin successful');
        onLogin(user);
      }
    } catch (submitError: any) {
      const errorMsg = submitError.message || 'Authentication failed. Please try again.';
      console.error('❌ Auth error:', errorMsg);
      setError(errorMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenTelegram = () => {
    // Open Telegram bot with /start command
    console.log('📱 Opening Telegram bot with /start command...');
    window.open('https://t.me/Impulsehub_bot?start=signup', '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 overflow-hidden">
      {/* Login Card */}
      <div 
        className={`relative w-[360px] max-h-[calc(100vh-120px)] overflow-y-auto ${isDark ? 'bg-[#1a1a1a] border-[#3a3a3a]' : 'bg-white border-[#d0d0d0]'} rounded-2xl shadow-2xl border`}
        style={{
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        }}
      >
        <style>{`
          div::-webkit-scrollbar {
            display: none;
          }
        `}</style>
        {/* Header */}
        <div className={`${isDark ? 'bg-[#2a2a2a] border-[#3a3a3a]' : 'bg-[#e8e8e8] border-[#d0d0d0]'} p-6 border-b sticky top-0 z-10`}>
          <h1 className={`text-2xl font-light tracking-[0.2em] ${isDark ? 'text-[#e8e8e8]' : 'text-[#2a2a2a]'} mb-2`}>
            IMPULSE HUB
          </h1>
          <p className={`text-sm ${isDark ? 'text-[#9a9a9a]' : 'text-[#6a6a6a]'}`}>
            {isSignup ? 'Complete Your Registration' : 'Sign in to your account'}
          </p>
          <p className={`text-xs ${isDark ? 'text-[#6a6a6a]' : 'text-[#8a8a8a]'} mt-1`}>
            {isSignup && 'Fill in your details to start copy trading'}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {isSignup && (
            <>
              <div>
                <label className={`block text-xs font-medium ${isDark ? 'text-[#9a9a9a]' : 'text-[#6a6a6a]'} mb-2`}>Full Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter your full name"
                  className={`w-full ${isDark ? 'bg-[#2a2a2a] border-[#3a3a3a] text-[#e8e8e8] placeholder-[#6a6a6a] focus:ring-[#5a5a5a]' : 'bg-[#f5f5f0] border-[#d0d0d0] text-[#2a2a2a] placeholder-[#9a9a9a] focus:ring-[#a0a0a0]'} border rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:border-transparent transition-all`}
                  required={isSignup}
                />
              </div>

              <div>
                <label className={`block text-xs font-medium ${isDark ? 'text-[#9a9a9a]' : 'text-[#6a6a6a]'} mb-2`}>Phone Number</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Enter your phone number"
                  className={`w-full ${isDark ? 'bg-[#2a2a2a] border-[#3a3a3a] text-[#e8e8e8] placeholder-[#6a6a6a] focus:ring-[#5a5a5a]' : 'bg-[#f5f5f0] border-[#d0d0d0] text-[#2a2a2a] placeholder-[#9a9a9a] focus:ring-[#a0a0a0]'} border rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:border-transparent transition-all`}
                  required={isSignup}
                />
              </div>
            </>
          )}

          <div>
            <label className={`block text-xs font-medium ${isDark ? 'text-[#9a9a9a]' : 'text-[#6a6a6a]'} mb-2`}>Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              className={`w-full ${isDark ? 'bg-[#2a2a2a] border-[#3a3a3a] text-[#e8e8e8] placeholder-[#6a6a6a] focus:ring-[#5a5a5a]' : 'bg-[#f5f5f0] border-[#d0d0d0] text-[#2a2a2a] placeholder-[#9a9a9a] focus:ring-[#a0a0a0]'} border rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:border-transparent transition-all`}
              required
            />
          </div>

          <div>
            <label className={`block text-xs font-medium ${isDark ? 'text-[#9a9a9a]' : 'text-[#6a6a6a]'} mb-2`}>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className={`w-full ${isDark ? 'bg-[#2a2a2a] border-[#3a3a3a] text-[#e8e8e8] placeholder-[#6a6a6a] focus:ring-[#5a5a5a]' : 'bg-[#f5f5f0] border-[#d0d0d0] text-[#2a2a2a] placeholder-[#9a9a9a] focus:ring-[#a0a0a0]'} border rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:border-transparent transition-all`}
              required
            />
          </div>

          {isSignup && (
            <div>
              <label className={`block text-xs font-medium ${isDark ? 'text-[#9a9a9a]' : 'text-[#6a6a6a]'} mb-2`}>
                Telegram ID (Numeric)
              </label>
              
              {/* Step 1: Start Bot */}
              <div className={`${isDark ? 'bg-[#2a2a2a] border-[#3a3a3a]' : 'bg-[#f5f5f0] border-[#d0d0d0]'} border rounded-lg p-4 mb-3`}>
                <p className={`text-xs ${isDark ? 'text-[#9a9a9a]' : 'text-[#6a6a6a]'} mb-2`}>
                  <span className="font-semibold">Step 1:</span> Start the Telegram Bot
                </p>
                <p className={`text-xs ${isDark ? 'text-[#6a6a6a]' : 'text-[#8a8a8a]'} mb-3`}>
                  Tap this button to receive trade notifications directly on your Telegram.
                </p>
                <button
                  type="button"
                  onClick={handleOpenTelegram}
                  disabled={isSubmitting}
                  className={`w-full flex items-center justify-center gap-2 ${isDark ? 'bg-[#3a3a3a] hover:bg-[#4a4a4a] border-[#4a4a4a] text-[#e8e8e8] disabled:opacity-50' : 'bg-[#2196F3] hover:bg-[#1976D2] border-[#1976D2] text-white disabled:opacity-50'} px-4 py-2.5 rounded-lg transition-all border`}
                >
                  <Send className="w-5 h-5" />
                  <span className="text-sm font-medium">Open Bot on Telegram</span>
                  <Send className="w-4 h-4" />
                </button>
              </div>

              {/* Step 2: Enter Telegram ID */}
              <div className={`${isDark ? 'bg-[#2a2a2a] border-[#3a3a3a]' : 'bg-[#f5f5f0] border-[#d0d0d0]'} border rounded-lg p-4`}>
                <p className={`text-xs ${isDark ? 'text-[#9a9a9a]' : 'text-[#6a6a6a]'} mb-2`}>
                  <span className="font-semibold">Step 2:</span> Enter your Telegram ID
                </p>
                <p className={`text-xs ${isDark ? 'text-[#6a6a6a]' : 'text-[#8a8a8a]'} mb-3`}>
                  The bot will automatically generate your ID. Type <span className="font-mono font-semibold">/myid</span> in the bot to get it.
                </p>
                <input
                  type="text"
                  inputMode="numeric"
                  value={telegramId}
                  onChange={handleTelegramIdChange}
                  placeholder="e.g. 1234567890"
                  disabled={isSubmitting}
                  className={`w-full ${
                    telegramId && !telegramIdValid
                      ? isDark
                        ? 'bg-[#1a1a1a] border-red-600/50 text-[#e8e8e8] placeholder-[#6a6a6a] focus:ring-red-500'
                        : 'bg-white border-red-400 text-[#2a2a2a] placeholder-[#9a9a9a] focus:ring-red-400'
                      : isDark
                        ? 'bg-[#1a1a1a] border-[#4a4a4a] text-[#e8e8e8] placeholder-[#6a6a6a] focus:ring-[#5a5a5a]'
                        : 'bg-white border-[#c0c0c0] text-[#2a2a2a] placeholder-[#9a9a9a] focus:ring-[#a0a0a0]'
                  } border rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:border-transparent transition-all font-mono disabled:opacity-50`}
                />
                {/* Real-time Validation Feedback */}
                {telegramId && (
                  <div className="mt-2 flex items-center gap-2">
                    {telegramIdValid ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                        <span className={`text-xs ${isDark ? 'text-green-400' : 'text-green-600'}`}>
                          ✅ Valid Telegram ID - Notifications enabled!
                        </span>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="w-4 h-4 text-red-500" />
                        <span className={`text-xs ${isDark ? 'text-red-400' : 'text-red-600'}`}>
                          ⚠️ Telegram ID must be numeric (e.g., 1234567890)
                        </span>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {error && (
            <div className={`p-3 rounded-lg flex items-start gap-2 ${isDark ? 'bg-red-900/30 border border-red-500/50' : 'bg-red-50 border border-red-200'}`}>
              <AlertCircle className={`w-5 h-5 flex-shrink-0 ${isDark ? 'text-red-400' : 'text-red-600'}`} />
              <span className={`text-sm ${isDark ? 'text-red-400' : 'text-red-700'}`}>
                {error}
              </span>
            </div>
          )}

          {success && (
            <div className={`p-3 rounded-lg flex items-start gap-2 ${isDark ? 'bg-green-900/30 border border-green-500/50' : 'bg-green-50 border border-green-200'}`}>
              <CheckCircle2 className={`w-5 h-5 flex-shrink-0 ${isDark ? 'text-green-400' : 'text-green-600'}`} />
              <span className={`text-sm ${isDark ? 'text-green-400' : 'text-green-700'}`}>
                {success}
              </span>
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting || (isSignup && telegramId && !telegramIdValid)}
            className={`w-full ${isDark ? 'bg-[#e8e8e8] hover:bg-white text-[#1a1a1a] disabled:opacity-50 disabled:hover:bg-[#e8e8e8]' : 'bg-[#2a2a2a] hover:bg-[#1a1a1a] text-[#e8e8e8] disabled:opacity-50 disabled:hover:bg-[#2a2a2a]'} font-medium py-3 rounded-lg transition-all flex items-center justify-center gap-2 mt-6`}
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                {isSignup ? 'Creating Account...' : 'Signing In...'}
              </>
            ) : isSignup ? (
              <>
                <UserPlus className="w-4 h-4" />
                Complete Registration
              </>
            ) : (
              <>
                <LogIn className="w-4 h-4" />
                Sign In
              </>
            )}
          </button>

          <div className="text-center mt-4">
            <button
              type="button"
              onClick={() => {
                setIsSignup(!isSignup);
                setError('');
                setSuccess('');
              }}
              disabled={isSubmitting}
              className={`text-sm ${isDark ? 'text-[#9a9a9a] hover:text-[#e8e8e8] disabled:opacity-50' : 'text-[#6a6a6a] hover:text-[#2a2a2a] disabled:opacity-50'} transition-colors`}
            >
              {isSignup
                ? 'Already have an account? Sign in'
                : "Don't have an account? Sign up"}
            </button>
          </div>
        </form>

        {/* Footer */}
        <div className={`${isDark ? 'bg-[#2a2a2a] border-[#3a3a3a]' : 'bg-[#e8e8e8] border-[#d0d0d0]'} p-4 border-t`}>
          <p className={`text-xs ${isDark ? 'text-[#6a6a6a]' : 'text-[#8a8a8a]'} text-center`}>
            By continuing, you agree to ImpulseHub's Terms & Privacy Policy
          </p>
        </div>
      </div>
    </div>
  );
}
