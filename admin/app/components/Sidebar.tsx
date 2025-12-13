'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useTheme } from './ThemeProvider';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import {
  BarChart3,
  Calendar,
  CalendarDays,
  Users,
  Sparkles,
  UserCog,
  Mail,
  Bot,
  FileText,
  Settings,
  Moon,
  Sun,
  LogOut,
  Menu,
  X,
  FileCode,
  MessageSquare,
} from 'lucide-react';

const menuItems = [
  { href: '/dashboard', label: 'Статистика', icon: BarChart3 },
  { href: '/appointments', label: 'Записи', icon: Calendar },
  { href: '/appointments/calendar', label: 'Календарь', icon: CalendarDays },
  { href: '/clients', label: 'Клиенты', icon: Users },
  { href: '/services', label: 'Услуги', icon: Sparkles },
  { href: '/masters', label: 'Мастера', icon: UserCog },
  { href: '/contact-requests', label: 'Заявки', icon: MessageSquare },
  { href: '/mailings', label: 'Рассылки', icon: Mail },
  { href: '/telegram', label: 'Telegram бот', icon: Bot },
  { href: '/templates', label: 'Шаблоны', icon: FileCode },
  { href: '/audit', label: 'Журнал действий', icon: FileText },
  { href: '/settings', label: 'Настройки', icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const [user, setUser] = useState<any>(null);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  useEffect(() => {
    const userStr = localStorage.getItem('admin-user');
    if (userStr) {
      try {
        setUser(JSON.parse(userStr));
      } catch (e) {
        // ignore
      }
    }
  }, []);

  const [showLogoutDialog, setShowLogoutDialog] = useState(false);

  const handleLogout = () => {
    localStorage.removeItem('admin-token');
    localStorage.removeItem('admin-user');
    // Удаляем токен из cookies для Server Components
    document.cookie = 'admin-token=; path=/; max-age=0; SameSite=Lax';
    // Используем router.push, basePath уже учтен в next.config.js
    router.push('/login');
  };

  const sidebarContent = (
    <>
      <div className="p-6 border-b border-border">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              Афродита
            </h1>
            <p className="text-sm text-muted-foreground mt-1">Админ панель</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className="lg:hidden"
            title={theme === 'light' ? 'Переключить на темную тему' : 'Переключить на светлую тему'}
          >
            {theme === 'light' ? (
              <Moon className="h-5 w-5" />
            ) : (
              <Sun className="h-5 w-5" />
            )}
          </Button>
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto p-4 space-y-1">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            pathname === item.href || pathname?.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setIsMobileOpen(false)}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200",
                "hover:bg-accent hover:text-accent-foreground",
                isActive
                  ? "bg-accent text-accent-foreground shadow-sm"
                  : "text-muted-foreground"
              )}
            >
              <Icon className={cn(
                "h-5 w-5 transition-colors",
                isActive ? "text-primary" : "text-muted-foreground"
              )} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="p-4 border-t border-border space-y-3">
        {user && (
          <div className="px-4 py-3 rounded-lg bg-muted/50">
            <p className="text-sm font-semibold text-foreground">
              {user.firstName} {user.lastName}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">{user.email}</p>
          </div>
        )}
        <Button
          variant="ghost"
          onClick={() => setShowLogoutDialog(true)}
          className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10"
        >
          <LogOut className="mr-2 h-4 w-4" />
          <span className="font-medium">Выйти</span>
        </Button>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile menu button */}
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden fixed top-4 left-4 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border"
        onClick={() => setIsMobileOpen(!isMobileOpen)}
      >
        {isMobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </Button>

      {/* Mobile sidebar overlay */}
      {isMobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-background/80 backdrop-blur-sm z-40"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed lg:static inset-y-0 left-0 z-40 w-64 bg-card border-r border-border flex flex-col transition-transform duration-300 ease-in-out",
          "lg:translate-x-0",
          isMobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        {sidebarContent}
      </aside>

      {/* Диалог подтверждения выхода */}
      <Dialog open={showLogoutDialog} onOpenChange={setShowLogoutDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Выход из системы</DialogTitle>
            <DialogDescription>
              Вы уверены, что хотите выйти?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowLogoutDialog(false)}
            >
              Отмена
            </Button>
            <Button
              variant="destructive"
              onClick={handleLogout}
            >
              Выйти
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

