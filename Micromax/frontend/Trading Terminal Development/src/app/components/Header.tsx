import { Moon, Sun, User } from 'lucide-react';

interface HeaderProps {
  onUserClick: () => void;
  isDark: boolean;
  onThemeToggle: () => void;
  isLoggedIn: boolean;
}

export function Header({ onUserClick, isDark, onThemeToggle, isLoggedIn }: HeaderProps) {
  return (
    <header className={`h-12 ${isDark ? 'bg-[#e8e8e8] border-[#d0d0d0]' : 'bg-[#2a2a2a] border-[#3a3a3a]'} border-b flex items-center justify-between px-8 z-50`}>
      {/* Logo/Brand */}
      <div className="flex items-center gap-8">
        <h1 className={`text-base font-light tracking-[0.3em] ${isDark ? 'text-[#2a2a2a]' : 'text-[#e8e8e8]'}`}>
          IMPULSE HUB
        </h1>
      </div>

      {/* Right Section */}
      <div className="flex items-center gap-3">
        {/* Theme Toggle */}
        <button
          onClick={onThemeToggle}
          className={`w-8 h-8 rounded-full ${isDark ? 'bg-[#d0d0d0] hover:bg-[#c0c0c0] border-[#b0b0b0]' : 'bg-[#3a3a3a] hover:bg-[#4a4a4a] border-[#4a4a4a]'} flex items-center justify-center transition-colors border`}
          title="Toggle theme"
        >
          {isDark ? (
            <Moon className="w-3.5 h-3.5 text-[#6a6a6a]" />
          ) : (
            <Sun className="w-3.5 h-3.5 text-[#9a9a9a]" />
          )}
        </button>

        {/* User Profile */}
        <button
          onClick={onUserClick}
          disabled={!isLoggedIn}
          className={`w-8 h-8 rounded-full ${isDark ? 'bg-[#d0d0d0] hover:bg-[#c0c0c0] border-[#b0b0b0]' : 'bg-[#3a3a3a] hover:bg-[#4a4a4a] border-[#4a4a4a]'} flex items-center justify-center transition-colors border ${!isLoggedIn ? 'opacity-50 cursor-not-allowed' : ''}`}
          title={isLoggedIn ? "User profile" : "Login to access profile"}
        >
          <User className={`w-3.5 h-3.5 ${isDark ? 'text-[#6a6a6a]' : 'text-[#9a9a9a]'}`} />
        </button>
      </div>
    </header>
  );
}