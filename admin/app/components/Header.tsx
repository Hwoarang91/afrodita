'use client';

import { useTheme } from './ThemeProvider';
import { Button } from '@/components/ui/button';
import { Moon, Sun } from 'lucide-react';

export function Header() {
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="sticky top-0 z-30 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-end gap-4 px-4 lg:px-6">
        {/* Theme toggle - hidden on mobile (shown in sidebar) */}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          className="hidden lg:flex"
          title={theme === 'light' ? 'Переключить на темную тему' : 'Переключить на светлую тему'}
        >
          {theme === 'light' ? (
            <Moon className="h-5 w-5" />
          ) : (
            <Sun className="h-5 w-5" />
          )}
          <span className="sr-only">Переключить тему</span>
        </Button>
      </div>
    </header>
  );
}

