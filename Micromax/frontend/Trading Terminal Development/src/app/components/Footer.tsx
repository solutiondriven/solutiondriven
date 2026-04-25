interface FooterProps {
  isDark: boolean;
}

export function Footer({ isDark }: FooterProps) {
  return (
    <footer className={`h-8 ${isDark ? 'bg-[#e8e8e8] border-[#d0d0d0]' : 'bg-[#2a2a2a] border-[#3a3a3a]'} border-t flex items-center justify-center px-8 z-50`}>
      <p className={`text-[10px] ${isDark ? 'text-[#8a8a8a]' : 'text-[#6a6a6a]'}`}>
        © {new Date().getFullYear()} All Rights Reserved by{' '}
        <span className={`font-medium ${isDark ? 'text-[#5a5a5a]' : 'text-[#9a9a9a]'}`}>ImpulseHub</span>
      </p>
    </footer>
  );
}