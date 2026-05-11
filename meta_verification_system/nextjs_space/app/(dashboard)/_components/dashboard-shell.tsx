'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ShieldCheck, LayoutDashboard, Building2, Globe, BarChart3,
  Facebook, FileText, LogOut, Menu, ChevronDown,
  User, Bell, Phone, Plug
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/empresas', label: 'Empresas', icon: Building2 },
  { href: '/sites-verificacao', label: 'Sites BMS', icon: Globe },
  { href: '/trust-score', label: 'Trust Score', icon: BarChart3 },
  { href: '/contas-meta', label: 'Contas Meta', icon: Facebook },
  { href: '/numeros-whatsapp', label: 'Números WhatsApp', icon: Phone },
  { href: '/integracao-meta', label: 'Integração Meta', icon: Plug },
  { href: '/auditoria', label: 'Auditoria', icon: FileText },
];

export function DashboardShell({ session, children }: { session: any; children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const pathname = usePathname();
  const userName = session?.user?.name ?? 'Usu\u00e1rio';
  const userRole = (session?.user as any)?.role ?? 'FUNCIONARIO';

  return (
    <div className="min-h-screen bg-background">
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/50 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      <aside
        className={cn(
          'fixed top-0 left-0 z-50 h-full w-64 bg-card border-r border-border transition-transform duration-300 lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex items-center gap-3 px-6 h-16 border-b border-border">
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary text-white">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <h1 className="font-display text-lg font-bold tracking-tight">MetaVerify</h1>
        </div>

        <nav className="p-4 space-y-1">
          {(navItems ?? []).map((item: any) => {
            const Icon = item?.icon;
            const isActive = pathname === item?.href || (item?.href !== '/dashboard' && pathname?.startsWith?.(item?.href));
            return (
              <Link
                key={item?.href}
                href={item?.href}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                {Icon && <Icon className="w-5 h-5" />}
                {item?.label}
              </Link>
            );
          })}
        </nav>

        <div className="absolute bottom-4 left-4 right-4">
          <div className="p-3 rounded-lg bg-muted/50">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{userName}</p>
                <p className="text-xs text-muted-foreground">
                  {userRole === 'ADMIN' ? 'Administrador' : 'Funcion\u00e1rio'}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start text-muted-foreground hover:text-destructive"
              onClick={() => signOut({ callbackUrl: '/login' })}
            >
              <LogOut className="w-4 h-4 mr-2" /> Sair
            </Button>
          </div>
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 h-16 bg-card/80 backdrop-blur border-b border-border flex items-center px-4 lg:px-6 gap-4">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setSidebarOpen(true)}>
            <Menu className="w-5 h-5" />
          </Button>
          <div className="flex-1" />
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-destructive rounded-full" />
            </Button>
            <div className="relative">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-muted transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="w-4 h-4 text-primary" />
                </div>
                <span className="text-sm font-medium hidden sm:block">{userName}</span>
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              </button>
              {userMenuOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-card rounded-lg shadow-lg border border-border py-1 z-50">
                  <button
                    onClick={() => { setUserMenuOpen(false); signOut({ callbackUrl: '/login' }); }}
                    className="flex items-center gap-2 w-full px-4 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <LogOut className="w-4 h-4" /> Sair
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
        <main className="p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
