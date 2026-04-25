import { useEffect, useRef, useState } from 'react';
import { FloatingMicromax } from './components/FloatingMicromax';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { RightSidebar } from './components/RightSidebar';
import { LoginModal } from './components/LoginModal';
import { EdgeSidebar } from './components/EdgeSidebar';
import { AuthUser, supabaseAuth } from './services/supabaseAuth';

export default function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<any>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isDark, setIsDark] = useState(true);
  const isLoggedIn = !!currentUser;

  // Set dark mode by default on mount
  useEffect(() => {
    document.documentElement.classList.add('dark');
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadSession = async () => {
      try {
        console.log('⚙️ Initializing session on app load...');
        const user = await supabaseAuth.initializeSession();
        if (isMounted) {
          setCurrentUser(user);
          if (user) {
            console.log('✅ User session restored:', user.email);
          } else {
            console.log('ℹ️ No active session found');
          }
        }
      } catch (error) {
        console.error('❌ Session initialization error:', error);
        if (isMounted) {
          setCurrentUser(null);
        }
      } finally {
        if (isMounted) {
          setIsAuthLoading(false);
        }
      }
    };

    loadSession();

    return () => {
      isMounted = false;
    };
  }, []);

  // Initialize TradingView widget
  const initializeTradingView = (theme: 'light' | 'dark') => {
    if (containerRef.current && (window as any).TradingView) {
      // Clear existing widget
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }

      // Create new widget
      widgetRef.current = new (window as any).TradingView.widget({
        autosize: true,
        symbol: 'BINANCE:BTCUSDT',
        interval: '240',
        timezone: 'Etc/UTC',
        theme: theme,
        style: '1',
        locale: 'en',
        toolbar_bg: theme === 'dark' ? '#1a1a1a' : '#f5f5f0',
        enable_publishing: false,
        allow_symbol_change: true,
        container_id: 'tradingview_chart',
        hide_top_toolbar: false,
        hide_side_toolbar: false,
        studies: ['MAExp@tv-basicstudies'],
      });
    }
  };

  useEffect(() => {
    // Load TradingView widget script
    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/tv.js';
    script.async = true;
    script.onload = () => {
      initializeTradingView(isDark ? 'dark' : 'light');
    };
    document.head.appendChild(script);

    return () => {
      if (document.head.contains(script)) {
        document.head.removeChild(script);
      }
    };
  }, []);

  const handleThemeToggle = () => {
    const newTheme = !isDark;
    setIsDark(newTheme);
    document.documentElement.classList.toggle('dark');
    
    // Reinitialize TradingView with new theme
    initializeTradingView(newTheme ? 'dark' : 'light');
  };

  const handleLogin = (user: AuthUser) => {
    setCurrentUser(user);
  };

  const handleSignOut = async () => {
    await supabaseAuth.signOut();
    setCurrentUser(null);
    setIsSidebarOpen(false);
  };

  const handleUserUpdate = (user: AuthUser) => {
    setCurrentUser(user);
  };

  const handleUserClick = () => {
    // Only open sidebar if user is logged in
    if (isLoggedIn) {
      setIsSidebarOpen(true);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-[#f5f5f0] dark:bg-[#1a1a1a]">
      {/* Top Header Bezel - ALWAYS VISIBLE - INVERTED THEME */}
      <Header 
        onUserClick={handleUserClick}
        isDark={isDark}
        onThemeToggle={handleThemeToggle}
        isLoggedIn={isLoggedIn}
      />

      {/* Main Content Area with Side Bezels */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Bezel - ALWAYS VISIBLE - INVERTED THEME (light when dark, dark when light) */}
        <div className={`w-5 ${isDark ? 'bg-[#e8e8e8] border-[#d0d0d0]' : 'bg-[#2a2a2a] border-[#3a3a3a]'} border-r`} />

        {/* Center: Trading Chart - THIS GETS BLURRED */}
        <div className="flex-1 relative">
          {/* Content that blurs when not logged in */}
          <div className={`size-full ${!isLoggedIn ? 'blur-xl' : ''}`}>
            <div
              id="tradingview_chart"
              ref={containerRef}
              className="size-full bg-[#1a1a1a]"
            />
            {isLoggedIn && <FloatingMicromax isDark={isDark} />}
          </div>

          {/* Login Modal - Sits on top of blurred content */}
          {!isLoggedIn && !isAuthLoading && <LoginModal onLogin={handleLogin} isDark={isDark} />}
        </div>

        {/* Right Bezel - ALWAYS VISIBLE - INVERTED THEME (light when dark, dark when light) */}
        <div className={`w-5 ${isDark ? 'bg-[#e8e8e8] border-[#d0d0d0]' : 'bg-[#2a2a2a] border-[#3a3a3a]'} border-l`} />
      </div>

      {/* Bottom Footer Bezel - ALWAYS VISIBLE - INVERTED THEME */}
      <Footer isDark={isDark} />

      {/* Edge-Triggered Icon Sidebar - Only visible when logged in and dashboard NOT open */}
      {isLoggedIn && !isSidebarOpen && (
        <EdgeSidebar isDark={isDark} onDashboardOpen={() => setIsSidebarOpen(true)} isDashboardOpen={isSidebarOpen} />
      )}

      {/* Right Sidebar (opens on user click) - Only available when logged in */}
      {isLoggedIn && (
        <RightSidebar
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
          isDark={isDark}
          user={currentUser}
          onUserUpdate={handleUserUpdate}
          onSignOut={handleSignOut}
        />
      )}
    </div>
  );
}
