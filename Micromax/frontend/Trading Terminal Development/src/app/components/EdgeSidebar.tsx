import { useState, useEffect, useRef } from 'react';
import { PieChart, TrendingUp, Wallet, User, CreditCard, Bell, LogOut, Settings, ChevronLeft } from 'lucide-react';

interface EdgeSidebarProps {
  isDark: boolean;
  onDashboardOpen: () => void;
  isDashboardOpen: boolean;
}

export function EdgeSidebar({ isDark, onDashboardOpen, isDashboardOpen }: EdgeSidebarProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const edgeZoneRef = useRef<HTMLDivElement>(null);

  // Hide sidebar when dashboard opens
  useEffect(() => {
    if (isDashboardOpen) {
      setIsVisible(false);
    }
  }, [isDashboardOpen]);

  // Reset timer when visibility or hovering changes
  useEffect(() => {
    if (isVisible && !isHovering) {
      // Start 10 second timer to auto-hide
      timeoutRef.current = setTimeout(() => {
        setIsVisible(false);
      }, 10000);
    }

    // Clear timeout when hovering or when component unmounts
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [isVisible, isHovering]);

  // Detect mouse at right edge of screen
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const edgeThreshold = 10; // pixels from edge
      const isAtRightEdge = window.innerWidth - e.clientX <= edgeThreshold;

      if (isAtRightEdge && !isVisible) {
        setIsVisible(true);
      }
    };

    // Detect touch at right edge (for mobile)
    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        const touch = e.touches[0];
        const edgeThreshold = 30; // pixels from edge for touch
        const isAtRightEdge = window.innerWidth - touch.clientX <= edgeThreshold;

        if (isAtRightEdge && !isVisible) {
          setIsVisible(true);
        }
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('touchstart', handleTouchStart);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('touchstart', handleTouchStart);
    };
  }, [isVisible]);

  const handleSidebarClick = () => {
    // Clear the auto-hide timer
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    // Open the full dashboard
    setIsVisible(false);
    onDashboardOpen();
  };

  const menuItems = [
    { icon: PieChart, label: 'Portfolio', color: isDark ? 'text-amber-600' : 'text-amber-400' },
    { icon: TrendingUp, label: 'Performance', color: isDark ? 'text-green-600' : 'text-green-400' },
    { icon: Wallet, label: 'Earnings', color: isDark ? 'text-gray-600' : 'text-gray-400' },
    { icon: User, label: 'Profile', color: isDark ? 'text-gray-600' : 'text-gray-400' },
    { icon: CreditCard, label: 'Billing', color: isDark ? 'text-pink-600' : 'text-pink-400' },
    { icon: Bell, label: 'Notifications', color: isDark ? 'text-yellow-600' : 'text-yellow-400' },
    { icon: Settings, label: 'Settings', color: isDark ? 'text-gray-600' : 'text-gray-400' },
  ];

  return (
    <>
      {/* Edge Detection Zone */}
      <div
        ref={edgeZoneRef}
        className="fixed top-12 right-0 bottom-8 w-1 z-[100] pointer-events-auto"
        style={{ backgroundColor: 'transparent' }}
      />

      {/* Icon Sidebar */}
      <div
        className={`fixed top-12 right-5 bottom-8 w-14 ${isDark ? 'bg-[#1a1a1a]/95 border-[#3a3a3a]' : 'bg-white/95 border-[#d0d0d0]'} backdrop-blur-2xl rounded-2xl shadow-2xl border z-[100] transition-all duration-300 ${
          isVisible ? 'translate-x-0 opacity-100' : 'translate-x-20 opacity-0 pointer-events-none'
        }`}
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
        onClick={handleSidebarClick}
      >
        {/* Slide indicator */}
        <div className={`absolute left-2 top-1/2 -translate-y-1/2 ${isDark ? 'text-[#9a9a9a]' : 'text-[#6a6a6a]'}`}>
          <ChevronLeft className="w-4 h-4 animate-pulse" />
        </div>

        {/* Icons Grid */}
        <div className="flex flex-col items-center gap-3 py-4 px-2">
          {menuItems.map((item, index) => {
            const Icon = item.icon;
            return (
              <button
                key={index}
                className={`w-10 h-10 rounded-xl ${isDark ? 'bg-[#2a2a2a] hover:bg-[#3a3a3a] border-[#3a3a3a]' : 'bg-[#f5f5f0] hover:bg-[#e8e8e8] border-[#e8e8e8]'} border flex items-center justify-center transition-all hover:scale-110 group relative`}
                title={item.label}
              >
                <Icon className={`w-5 h-5 ${item.color}`} />
                
                {/* Tooltip */}
                <div className={`absolute right-full mr-3 px-3 py-1.5 rounded-lg ${isDark ? 'bg-white text-[#2a2a2a] border-[#d0d0d0]' : 'bg-[#1a1a1a] text-[#e8e8e8] border-[#3a3a3a]'} border text-xs font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none`}>
                  {item.label}
                </div>
              </button>
            );
          })}

          {/* Logout Button */}
          <div className={`w-full h-px ${isDark ? 'bg-[#3a3a3a]' : 'bg-[#d0d0d0]'} my-2`} />
          <button
            className={`w-10 h-10 rounded-xl ${isDark ? 'bg-red-900/30 hover:bg-red-900/50 border-red-800/50' : 'bg-red-50 hover:bg-red-100 border-red-200'} border flex items-center justify-center transition-all hover:scale-110 group relative`}
            title="Sign Out"
          >
            <LogOut className={`w-5 h-5 ${isDark ? 'text-red-400' : 'text-red-600'}`} />
            
            {/* Tooltip */}
            <div className={`absolute right-full mr-3 px-3 py-1.5 rounded-lg ${isDark ? 'bg-white text-[#2a2a2a] border-[#d0d0d0]' : 'bg-[#1a1a1a] text-[#e8e8e8] border-[#3a3a3a]'} border text-xs font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none`}>
              Sign Out
            </div>
          </button>
        </div>
      </div>
    </>
  );
}
