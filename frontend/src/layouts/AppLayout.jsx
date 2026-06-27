import React, { useState, useEffect } from 'react';
import { GraduationCap, Sun, Moon, LogOut } from 'lucide-react';
import { useTheme } from '../theme/ThemeContext';
import { authService } from '../common/services/authService';
import { Button } from '../common/ui/button';
import ForcePasswordChange from '../common/components/ForcePasswordChange';

const ROLE_LABELS = {
  SUPER_ADMIN: 'Super Admin',
  SCHOOL_ADMIN: 'School Admin',
  TEACHER: 'Teacher',
  STUDENT: 'Student',
  PARENT: 'Parent',
};

const AppLayout = ({ children }) => {
  const { theme, toggleTheme, applySchoolTheme } = useTheme();

  const user = authService.getCurrentUser();
  const role = authService.getUserRole();
  const [showForcePassword, setShowForcePassword] = useState(
    () => !!(user?.force_password_change)
  );

  // Apply the school-scoped portal theme once on mount (non-SUPER_ADMIN only)
  useEffect(() => {
    if (role && role !== 'SUPER_ADMIN' && user?.school_portal_theme) {
      applySchoolTheme(user.school_portal_theme);
    }
  }, []);

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
              <span className="text-sm font-black text-text-primary font-display tracking-tight leading-none">
                Shiksha Pilot
              </span>
            </div>

            {/* Right controls */}
            <div className="flex items-center gap-1.5">
              {/* User info */}
              <div className="hidden sm:flex flex-col items-end mr-2">
                <span className={`font-semibold text-text-primary leading-none ${role === 'SCHOOL_ADMIN' ? 'text-sm font-bold' : 'text-xs'}`}>
                  {displayName}
                </span>
                {role !== 'SCHOOL_ADMIN' && (
                  <span className="text-[10px] text-text-muted leading-none mt-0.5 uppercase tracking-wide">
                    {roleLabel}
                  </span>
                )}
              </div>

              {/* Dark/light toggle */}
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
