import React, { useState } from 'react';
import { GraduationCap, Sun, Moon, LogOut, Palette } from 'lucide-react';
import { useTheme } from '../theme/ThemeContext';
import { authService } from '../common/services/authService';
import { Button } from '../common/ui/button';
import ForcePasswordChange from '../common/components/ForcePasswordChange';

const BRAND_PRESETS = [
  {
    id: 'default',
    label: 'Default Blue',
    swatch: '#18181b',
  },
  {
    id: 'enterprise',
    label: 'Enterprise',
    swatch: '#10b981',
  },
  {
    id: 'fintech',
    label: 'Fintech',
    swatch: '#f59e0b',
  },
  {
    id: 'healthcare',
    label: 'Healthcare',
    swatch: '#0d9488',
  },
];

const ROLE_LABELS = {
  SUPER_ADMIN: 'Super Admin',
  SCHOOL_ADMIN: 'School Admin',
  TEACHER: 'Teacher',
  STUDENT: 'Student',
  PARENT: 'Parent',
};

const AppLayout = ({ children }) => {
  const { theme, toggleTheme, brandPreset, setBrandPreset } = useTheme();
  const [showBrandDrawer, setShowBrandDrawer] = useState(false);

  const user = authService.getCurrentUser();
  const role = authService.getUserRole();
  const [showForcePassword, setShowForcePassword] = useState(
    () => !!(user?.force_password_change)
  );

  const displayName = user
    ? [user.first_name, user.last_name].filter(Boolean).join(' ') || user.name || user.username || 'User'
    : 'User';

  const roleLabel = ROLE_LABELS[role] || role || 'Member';

  const handleLogout = () => {
    authService.logout();
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Sticky header */}
      <header className="sticky top-0 z-40 border-b border-border bg-surface">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
          <div className="flex items-center justify-between h-14 gap-4">
            {/* Brand */}
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex items-center justify-center w-8 h-8 rounded-md bg-zinc-900 dark:bg-zinc-50 flex-shrink-0">
                <GraduationCap className="w-4 h-4 text-zinc-50 dark:text-zinc-900" />
              </div>
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-black text-text-primary font-display tracking-tight leading-none">
                    Shiksha Pilot
                  </span>
                  <span className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-widest bg-zinc-900 text-zinc-50 dark:bg-zinc-50 dark:text-zinc-900 leading-none">
                    SaaS
                  </span>
                </div>
                <span className="text-[10px] text-text-muted leading-none mt-0.5 hidden sm:block">
                  Cloud-Native School Management
                </span>
              </div>
            </div>

            {/* Right controls */}
            <div className="flex items-center gap-1.5">
              {/* User info */}
              <div className="hidden sm:flex flex-col items-end mr-2">
                <span className="text-xs font-semibold text-text-primary leading-none">
                  {displayName}
                </span>
                <span className="text-[10px] text-text-muted leading-none mt-0.5 uppercase tracking-wide">
                  {roleLabel}
                </span>
              </div>

              {/* Theme toggle */}
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleTheme}
                aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                {theme === 'dark'
                  ? <Sun className="w-4 h-4" />
                  : <Moon className="w-4 h-4" />
                }
              </Button>

              {/* Brand palette toggle */}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowBrandDrawer(prev => !prev)}
                aria-label="Brand settings"
                title="Brand settings"
                aria-expanded={showBrandDrawer}
              >
                <Palette className="w-4 h-4" />
              </Button>

              {/* Logout */}
              <Button
                variant="ghost"
                size="icon"
                onClick={handleLogout}
                aria-label="Log out"
                title="Log out"
              >
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Brand settings drawer */}
        {showBrandDrawer && (
          <div className="border-t border-border bg-surface">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 py-3">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-[11px] font-semibold text-text-muted uppercase tracking-widest mr-1">
                  Theme
                </span>
                {BRAND_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => setBrandPreset(preset.id)}
                    className={`
                      flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium
                      border transition-all duration-100 focus-visible:outline-none
                      focus-visible:ring-1 focus-visible:ring-zinc-950 dark:focus-visible:ring-zinc-300
                      ${brandPreset === preset.id
                        ? 'border-zinc-900 dark:border-zinc-50 bg-zinc-100 dark:bg-zinc-800 text-text-primary'
                        : 'border-border text-text-secondary hover:border-zinc-400 dark:hover:border-zinc-500 hover:text-text-primary'
                      }
                    `}
                    aria-pressed={brandPreset === preset.id}
                    title={preset.label}
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: preset.swatch }}
                    />
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Force password change modal */}
      {showForcePassword && (
        <ForcePasswordChange onDismiss={() => setShowForcePassword(false)} />
      )}

      {/* Page content */}
      <main className="flex-1 w-full max-w-7xl mx-auto p-4 sm:p-6 md:p-8">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-surface py-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
          <p className="text-[11px] text-text-muted text-center">
            &copy; 2026 Shiksha Pilot. Cloud-Native School Management Platform.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default AppLayout;
