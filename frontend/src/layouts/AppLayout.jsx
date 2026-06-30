import React, { useState, useEffect, useRef } from 'react';
import { GraduationCap, Sun, Moon, Bell } from 'lucide-react';
import { useTheme } from '../theme/ThemeContext';
import { authService } from '../common/services/authService';
import { Button } from '../common/ui/button';
import ForcePasswordChange from '../common/components/ForcePasswordChange';
import { useNavigate } from 'react-router-dom';
import { schoolService } from '../common/services/schoolService';

const ROLE_LABELS = {
  SUPER_ADMIN: 'Super Admin',
  SCHOOL_ADMIN: 'School Admin',
  TEACHER: 'Teacher',
  STUDENT: 'Student',
  PARENT: 'Parent',
};

const AppLayout = ({ children }) => {
  const { theme, toggleTheme, applySchoolTheme } = useTheme();
  const navigate = useNavigate();

  const user = authService.getCurrentUser();
  const role = authService.getUserRole();
  const [showForcePassword, setShowForcePassword] = useState(
    () => !!(user?.force_password_change)
  );

  const [schoolProfile, setSchoolProfile] = useState(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [logoError, setLogoError] = useState(false);
  const dropdownRef = useRef(null);

  // Apply the school-scoped portal theme once on mount (non-SUPER_ADMIN only)
  useEffect(() => {
    if (role && role !== 'SUPER_ADMIN' && user?.school_portal_theme) {
      applySchoolTheme(user.school_portal_theme);
    }
  }, []);

  // Fetch school profile dynamically
  useEffect(() => {
    if (role && role !== 'SUPER_ADMIN') {
      schoolService.getSchoolProfile()
        .then(profile => {
          setSchoolProfile(profile);
        })
        .catch(err => {
          console.error("Failed to load school profile in header", err);
        });
    }
  }, [role]);

  // Synchronize dynamic updates immediately
  useEffect(() => {
    const handleUpdate = (e) => {
      if (e.detail) {
        setSchoolProfile(e.detail);
      }
    };
    window.addEventListener('school-profile-updated', handleUpdate);
    return () => window.removeEventListener('school-profile-updated', handleUpdate);
  }, []);

  // Reset logoError state whenever logo path changes
  useEffect(() => {
    setLogoError(false);
  }, [schoolProfile?.logo_path]);

  // Close dropdown on click outside
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const displayName = user
    ? [user.first_name, user.last_name].filter(Boolean).join(' ') || user.name || user.username || 'User'
    : 'User';

  const roleLabel = ROLE_LABELS[role] || role || 'Member';

  const handleLogout = () => {
    authService.logout();
  };

  const getInitials = () => {
    if (schoolProfile?.name) {
      return schoolProfile.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
    }
    return 'SP';
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Sticky header */}
      <header className="sticky top-0 z-40 border-b border-border bg-surface">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
          <div className="flex items-center justify-between h-14 gap-4">
            
            {/* Left side dynamic header */}
            <div className="flex items-center gap-3 min-w-0">
              {role !== 'SUPER_ADMIN' && schoolProfile ? (
                <span 
                  className="text-sm font-black text-text-primary font-display tracking-tight leading-none truncate"
                  style={{ fontWeight: 900 }}
                >
                  {schoolProfile.name}
                </span>
              ) : (
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex items-center justify-center w-8 h-8 rounded-md bg-zinc-900 dark:bg-zinc-50 flex-shrink-0">
                    <GraduationCap className="w-4 h-4 text-zinc-50 dark:text-zinc-900" />
                  </div>
                  <span className="text-sm font-black text-text-primary font-display tracking-tight leading-none">
                    Shiksha Pilot
                  </span>
                </div>
              )}
            </div>

            {/* Right controls */}
            <div className="flex items-center gap-1.5">
              
              {/* Notification Bell */}
              {role !== 'SUPER_ADMIN' && (
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Notifications"
                  title="Notifications"
                  className="text-text-secondary"
                >
                  <Bell className="w-4 h-4" />
                </Button>
              )}

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

              {/* User profile dropdown avatar controls */}
              {role !== 'SUPER_ADMIN' ? (
                <div className="relative" ref={dropdownRef}>
                  <button 
                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                    className="flex items-center gap-2.5 hover:opacity-85 transition-all text-left focus:outline-hidden"
                  >
                    {/* Avatar */}
                    <div className="w-8 h-8 rounded-full border border-border flex items-center justify-center overflow-hidden bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-100 text-xs font-black uppercase flex-shrink-0">
                      {!logoError && schoolProfile?.logo_path ? (
                        <img 
                          src={schoolProfile.logo_path} 
                          alt="School Logo" 
                          className="w-full h-full object-cover" 
                          onError={() => setLogoError(true)}
                        />
                      ) : (
                        <span>{getInitials()}</span>
                      )}
                    </div>
                  </button>

                  {/* Dropdown overlay */}
                  {isDropdownOpen && (
                    <div className="absolute right-0 top-10 w-48 bg-surface border border-border shadow-lg rounded-xl py-1.5 z-50 text-left text-xs animate-in fade-in slide-in-from-top-1 duration-100">
                      <button 
                        onClick={() => { setIsDropdownOpen(false); navigate('/school-admin/profile'); }}
                        className="w-full px-4 py-2 hover:bg-zinc-50 dark:hover:bg-zinc-900 flex items-center gap-2 font-bold text-text-primary text-left"
                      >
                        Profile
                      </button>
                      <button 
                        onClick={() => { setIsDropdownOpen(false); navigate('/school-admin/profile/change-password'); }}
                        className="w-full px-4 py-2 hover:bg-zinc-50 dark:hover:bg-zinc-900 flex items-center gap-2 font-bold text-text-primary text-left"
                      >
                        Change Password
                      </button>
                      <button 
                        onClick={() => { setIsDropdownOpen(false); navigate('/school-admin/profile/subscription'); }}
                        className="w-full px-4 py-2 hover:bg-zinc-50 dark:hover:bg-zinc-900 flex items-center gap-2 font-bold text-text-primary text-left"
                      >
                        Subscription Plans
                      </button>
                      <div className="border-t border-border my-1"></div>
                      <button 
                        onClick={() => { setIsDropdownOpen(false); handleLogout(); }}
                        className="w-full px-4 py-2 hover:bg-zinc-50 dark:hover:bg-zinc-900 flex items-center gap-2 font-bold text-red-600 text-left"
                      >
                        Sign Out
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <div className="hidden sm:flex flex-col items-end mr-2">
                    <span className="font-semibold text-text-primary leading-none text-xs">
                      {displayName}
                    </span>
                    <span className="text-[10px] text-text-muted leading-none mt-0.5 uppercase tracking-wide">
                      {roleLabel}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleLogout}
                    aria-label="Log out"
                    title="Log out"
                  >
                    <GraduationCap className="w-4 h-4" />
                  </Button>
                </div>
              )}

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
