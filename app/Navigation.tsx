'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { PenLine, BrainCircuit, Rocket, LayoutList, Database, TrendingUp, Users } from 'lucide-react';

export default function Navigation() {
  const pathname = usePathname();

  const navItems = [
    { href: '/', label: 'Capture', icon: PenLine },
    { href: '/vault', label: 'Vault', icon: Database },
    { href: '/profile', label: 'Mind Model', icon: BrainCircuit },
    { href: '/build', label: 'Build', icon: Rocket },
    { href: '/distribution', label: 'Distribution', icon: TrendingUp },
    { href: '/timeline', label: 'Timeline', icon: Users },
    { href: '/review', label: 'Review', icon: LayoutList },
  ];

  return (
    <>
      {/* Desktop Top Navigation */}
      <nav className="hidden sm:block border-b border-zinc-900 bg-[#050505]/95 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-5xl mx-auto w-full px-6 flex items-center h-16 gap-8">
          <div className="text-zinc-100 font-semibold tracking-tight mr-2 flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-indigo-500/20 to-blue-500/20 border border-indigo-500/20 flex items-center justify-center">
              <span className="text-indigo-400 font-bold text-xs">IE</span>
            </div>
            Idea Engine
          </div>
          {navItems.map((item) => {
            const isActive = pathname === item.href || (item.href === '/build' && pathname === '/startup');
            const Icon = item.icon;
            return (
              <Link 
                key={item.href} 
                href={item.href}
                className={`flex items-center gap-2 text-sm font-medium transition-colors h-full border-b-2 pt-1 ${
                  isActive 
                    ? 'border-indigo-500 text-zinc-100' 
                    : 'border-transparent text-zinc-500 hover:text-zinc-300'
                }`}
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Mobile Bottom Navigation */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 border-t border-zinc-900 bg-zinc-950/95 backdrop-blur-md z-50">
        <div className="flex justify-around items-center h-[72px] px-2 pb-safe">
          {navItems.map((item) => {
            const isActive = pathname === item.href || (item.href === '/build' && pathname === '/startup');
            const Icon = item.icon;
            return (
              <Link 
                key={item.href} 
                href={item.href}
                className={`flex flex-col items-center justify-center w-full h-full gap-1 transition-colors ${
                  isActive ? 'text-indigo-400' : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5]' : 'stroke-2'}`} />
                <span className="text-[10px] font-medium tracking-wide">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
