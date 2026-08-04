import React, { useState, useEffect, useRef } from 'react';
import { GraduationCap, Sun, Moon, Bell, LogOut } from 'lucide-react';
import logoImg from '../assets/logo.png';
import { useTheme } from '../theme/ThemeContext';
import { authService } from '../common/services/authService';
import { Button } from '../common/ui/button';
import ForcePasswordChange from '../common/components/ForcePasswordChange';
import { useNavigate } from 'react-router-dom';
import { schoolService } from '../common/services/schoolService';
import { useAcademicYear } from '../common/contexts/AcademicYearContext';
import { Dialog } from '../common/ui/dialog';
import GlobalSearch from '../common/components/GlobalSearch';
import { useGlobalSearch } from '../common/hooks/useGlobalSearch';

/** Drives the [data-portal] accent so each audience is distinguishable. */
const PORTAL_BY_ROLE = {
  SUPER_ADMIN: 'super-admin',
  SCHOOL_ADMIN: 'school-admin',
  TEACHER: 'teacher',
  STUDENT: 'student',
  PARENT: 'parent',
};

const ROLE_LABELS = {
  SUPER_ADMIN: 'Super Admin',
  SCHOOL_ADMIN: 'School Admin',
  TEACHER: 'Teacher',
  STUDENT: 'Student',
  PARENT: 'Parent',
};

import { useConfirm } from '../common/components/ConfirmDialog';

const AppLayout = ({ children }) => {
  const { theme, resolvedTheme, toggleTheme, applySchoolTheme } = useTheme();
  const navigate = useNavigate();
  const confirm = useConfirm();

  const user = authService.getCurrentUser();
  const role = authService.getUserRole();
  const isSchoolAdmin = role === 'SCHOOL_ADMIN' || role === 'TEACHER';

  const { academicYears, currentYear, selectYear } = isSchoolAdmin
    ? useAcademicYear()
    : { academicYears: [], currentYear: null, selectYear: () => {} };

  const [showForcePassword, setShowForcePassword] = useState(
    () => !!(user?.force_password_change)
  );

  const [schoolProfile, setSchoolProfile] = useState(() => {
    try {
      const cached = localStorage.getItem('cached_school_profile');
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [logoError, setLogoError] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const dropdownRef = useRef(null);

  const [notifications, setNotifications] = useState([]);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);
  const notifRef = useRef(null);

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
          if (profile) {
            localStorage.setItem('cached_school_profile', JSON.stringify(profile));
          }
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
        localStorage.setItem('cached_school_profile', JSON.stringify(e.detail));
      }
    };
    window.addEventListener('school-profile-updated', handleUpdate);
    return () => window.removeEventListener('school-profile-updated', handleUpdate);
  }, []);

  // Reset logoError state whenever logo path changes
  useEffect(() => {
    setLogoError(false);
  }, [schoolProfile?.logo_path]);

  useEffect(() => {
    if (!isSchoolAdmin) return;
    
    const fetchNotifs = async () => {
      try {
        const res = await schoolService.getNotifications();
        setNotifications(res.notifications || []);
        setUnreadNotifCount(res.unread_count || 0);
      } catch (err) {
        console.error("Failed to load notifications", err);
      }
    };

    fetchNotifs();
    const interval = setInterval(fetchNotifs, 30000);
    return () => clearInterval(interval);
  }, [isSchoolAdmin]);

  useEffect(() => {
    const handleOutsideClickNotif = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setShowNotifDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClickNotif);
    return () => document.removeEventListener('mousedown', handleOutsideClickNotif);
  }, []);

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

  // Command palette sources for this role.
  const { destinations, searchRecords, enabled: searchEnabled } = useGlobalSearch(role, navigate);

  const handleLogout = () => {
    setShowLogoutConfirm(true);
  };

  const confirmLogout = () => {
    setShowLogoutConfirm(false);
    localStorage.removeItem('cached_school_profile');
    authService.logout();
  };

  const getInitials = () => {
    if (schoolProfile?.name) {
      return schoolProfile.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
    }
    return 'SP';
  };

  return (
    <div className="min-h-screen flex flex-col bg-background" data-portal={PORTAL_BY_ROLE[role]}>
      {/* First tab stop: lets keyboard users bypass the header nav. */}
      <a href="#main-content" className="skip-link">Skip to main content</a>
      {/* Sticky header */}
      <header className="sticky top-0 z-50 border-b border-border bg-surface no-print">
        <div className="w-full px-6">
          <div className="flex items-center justify-between h-14 gap-4">
            
            {/* Left side dynamic header */}
            <div className="flex items-center gap-3 min-w-0">
              {role !== 'SUPER_ADMIN' ? (
                schoolProfile ? (
                  <div className="flex items-center gap-3 min-w-0">
                    <span 
                      className="text-sm font-bold text-text-primary font-display tracking-tight leading-none truncate uppercase"
                      style={{ fontWeight: 700 }}
                    >
                      {schoolProfile.name}
                    </span>
                    
                    {isSchoolAdmin && currentYear && (
                      <>
                        <div className="h-4 w-px bg-border flex-shrink-0" aria-hidden="true"></div>
                        <div className="flex items-center gap-2 rounded-lg border border-border-strong bg-surface-sunken px-2 py-1 flex-shrink-0">
                          <select
                            id="academic-year-switcher"
                            value={currentYear.id}
                            onChange={async (e) => {
                              const nextId = e.target.value;
                              const next = academicYears.find((y) => String(y.id) === String(nextId));
                              const leavingActive = currentYear.status === 'ACTIVE' && next?.status !== 'ACTIVE';
                              if (leavingActive) {
                                const ok = await confirm({
                                  title: `Switch from active year to ${next?.name}?`,
                                  message: `All dashboards, fees, attendance and exam figures will show ${next?.name} data until you switch back.`,
                                  confirmLabel: 'Switch Year',
                                  danger: false,
                                });
                                if (!ok) return;
                              }
                              selectYear(nextId);
                              navigate('/school-admin');
                            }}
                            className="h-7 cursor-pointer rounded-md border-0 bg-transparent pr-6 text-body-sm font-semibold text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                          >
                            {academicYears.map(y => (
                              <option key={y.id} value={y.id}>
                                {y.name} {y.status === 'ACTIVE' ? '(Active)' : y.status === 'Archived' ? '(Archived)' : `(${y.status})`}
                              </option>
                            ))}
                          </select>
                        </div>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="h-4 w-32 bg-zinc-200 dark:bg-zinc-800 animate-pulse rounded-md"></div>
                )
              ) : (
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex items-center justify-center h-[36px] w-auto flex-shrink-0">
                    <img src={logoImg} alt="Shiksha Pilot Logo" className="h-[36px] w-auto object-contain" />
                  </div>
                  <span className="text-sm font-bold text-text-primary font-display tracking-tight leading-none">
                    Shiksha Pilot
                  </span>
                </div>
              )}
            </div>

            {/* Right controls */}
            <div className="flex items-center gap-1.5">

              {/* Notification Bell */}
              {isSchoolAdmin && (
                <div className="relative" ref={notifRef}>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Notifications"
                    title="Notifications"
                    className="text-text-secondary relative"
                    onClick={() => setShowNotifDropdown(!showNotifDropdown)}
                  >
                    <Bell className="w-4 h-4" />
                    {unreadNotifCount > 0 && (
                      <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                    )}
                  </Button>
                  
                  {showNotifDropdown && (
                    <div className="absolute right-0 mt-2 w-80 max-h-96 overflow-y-auto bg-surface border border-border rounded-xl shadow-xl z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                      <div className="p-3.5 border-b border-border flex items-center justify-between">
                        <span className="font-bold text-xs tracking-tight text-text-primary">Notifications</span>
                        {unreadNotifCount > 0 && (
                          <span className="text-[11px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-bold">
                            {unreadNotifCount} New
                          </span>
                        )}
                      </div>
                      <div className="py-1 divide-y divide-border">
                        {notifications.length === 0 ? (
                          <div className="p-6 text-center text-text-muted text-xs">
                            No notifications yet.
                          </div>
                        ) : (
                          notifications.map((n) => (
                            <div 
                              key={n.id}
                              onClick={async () => {
                                try {
                                  await schoolService.markNotificationRead(n.id);
                                  setNotifications(prev => prev.map(item => item.id === n.id ? { ...item, is_read: 1 } : item));
                                  setUnreadNotifCount(prev => Math.max(0, prev - 1));
                                  setShowNotifDropdown(false);
                                  if (n.link) {
                                    navigate(n.link);
                                  }
                                } catch (err) {
                                  console.error(err);
                                }
                              }}
                              className={`p-3 text-left hover:bg-hover cursor-pointer transition-colors ${!n.is_read ? 'bg-primary/5' : ''}`}
                            >
                              <div className="flex items-start justify-between gap-1">
                                <span className={`text-xs font-bold ${!n.is_read ? 'text-primary' : 'text-text-primary'}`}>
                                  {n.title}
                                </span>
                                <span className="text-[11px] text-text-muted shrink-0 font-mono">
                                  {new Date(n.created_at).toLocaleDateString(undefined, {month: 'short', day: 'numeric'})}
                                </span>
                              </div>
                              <p className="text-[11px] text-text-secondary mt-1 whitespace-pre-line leading-relaxed">
                                {n.message}
                              </p>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/*
                Dark/light toggle — now available to every role. Teachers and
                students spend the longest in these screens and it was
                previously gated to admins.
              */}
              {(
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={toggleTheme}
                  aria-label={resolvedTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                  title={resolvedTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                >
                  {resolvedTheme === 'dark'
                    ? <Sun className="w-4 h-4" />
                    : <Moon className="w-4 h-4" />
                  }
                </Button>
              )}

              {/*
                Who is signed in. The header previously showed only the SCHOOL
                logo where the USER's identity belongs, so on a shared staff-room
                device there was no way to tell whose account was active.
              */}
              {/* User profile dropdown avatar controls */}
              {role !== 'SUPER_ADMIN' ? (
                <div className="relative" ref={dropdownRef}>
                  <button 
                    onClick={() => {
                      if (role === 'TEACHER') {
                        navigate('/teacher/settings');
                      } else if (role === 'PARENT') {
                        navigate('/parent/settings');
                      } else if (role === 'STUDENT') {
                        navigate('/student/settings');
                      } else {
                        setIsDropdownOpen(!isDropdownOpen);
                      }
                    }}
                    className="flex items-center gap-2.5 hover:opacity-85 transition-all text-left focus:outline-hidden"
                  >
                    {/* Avatar */}
                    <div className="w-8 h-8 rounded-full border border-border flex items-center justify-center overflow-hidden bg-secondary text-text-primary text-xs font-bold uppercase flex-shrink-0">
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
                        className="w-full px-4 py-2 hover:bg-secondary/80 flex items-center gap-2 font-bold text-text-primary text-left"
                      >
                        Profile
                      </button>
                      <button 
                        onClick={() => { setIsDropdownOpen(false); navigate('/school-admin/profile/change-password'); }}
                        className="w-full px-4 py-2 hover:bg-secondary/80 flex items-center gap-2 font-bold text-text-primary text-left"
                      >
                        Change Password
                      </button>
                      <button 
                        onClick={() => { setIsDropdownOpen(false); navigate('/school-admin/profile/subscription'); }}
                        className="w-full px-4 py-2 hover:bg-secondary/80 flex items-center gap-2 font-bold text-text-primary text-left"
                      >
                        Subscription Plans
                      </button>
                      <div className="border-t border-border my-1"></div>
                      <button 
                        onClick={() => { setIsDropdownOpen(false); handleLogout(); }}
                        className="w-full px-4 py-2 hover:bg-secondary/80 flex items-center gap-2 font-bold text-red-600 text-left"
                      >
                        Sign Out
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2">
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
      <main id="main-content" className="flex-1 w-full flex flex-col md:flex-row">
        {children}
      </main>

      <Dialog
        isOpen={showLogoutConfirm}
        onClose={() => setShowLogoutConfirm(false)}
        title="Confirm Logout"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowLogoutConfirm(false)}>Cancel</Button>
            <Button className="bg-red-600 hover:bg-red-700 text-white font-bold" onClick={confirmLogout}>Sign Out</Button>
          </>
        }
      >
        <p className="text-sm text-text-secondary font-medium">
          Are you sure you want to sign out?
        </p>
        <p className="text-xs text-text-muted mt-1 leading-normal">
          Any unsaved changes may be lost.
        </p>
      </Dialog>
    </div>
  );
};

export default AppLayout;
