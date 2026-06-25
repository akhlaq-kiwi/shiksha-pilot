import React, { useState, useEffect } from 'react';
import { 
  GraduationCap, Sun, Moon, LogOut, Shield, 
  School, ClipboardList, Sparkles, Palette, Info 
} from 'lucide-react';
import { useTheme } from './theme/ThemeContext';
import { authService } from './common/services/authService';
import LoginForm from './features/auth/components/LoginForm';
import SuperAdminPortal from './features/super-admin/SuperAdminPortal';
import SchoolAdminPortal from './features/school-admin/SchoolAdminPortal';
import TeacherPortal from './features/teacher/TeacherPortal';
import StudentParentPortal from './features/student-parent/StudentParentPortal';
import { Button } from './common/ui/button';

export default function App() {
  const { theme, toggleTheme, brandPreset, setBrandPreset } = useTheme();
  
  // Auth state
  const [user, setUser] = useState(authService.getCurrentUser());
  const [role, setRole] = useState(authService.getUserRole());
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    const handleAuthChange = () => {
      setUser(authService.getCurrentUser());
      setRole(authService.getUserRole());
    };
    
    window.addEventListener('auth-change', handleAuthChange);
    return () => {
      window.removeEventListener('auth-change', handleAuthChange);
    };
  }, []);

  const handleLogout = () => {
    authService.logout();
  };

  const handleLoginSuccess = (loggedInUser) => {
    setUser(loggedInUser);
    setRole(authService.getUserRole());
  };

  // If user is not logged in, show the clean ShadCN login form
  if (!user) {
    return (
      <div className="min-h-screen bg-background text-text-primary flex items-center justify-center">
        <LoginForm onLoginSuccess={handleLoginSuccess} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-text-primary transition-all duration-300 flex flex-col">
      
      {/* Top Application Header */}
      <header className="sticky top-0 z-40 bg-surface/85 backdrop-blur-md border-b border-border py-3 px-4 sm:px-6 flex items-center justify-between shadow-xs">
        <div className="flex items-center space-x-2 sm:space-x-3">
          <div className="h-8 w-8 sm:h-10 sm:w-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary border border-primary/20 shadow-xs flex-shrink-0">
            <GraduationCap className="h-5 w-5 sm:h-6 sm:w-6" />
          </div>
          <div>
            <h1 className="font-extrabold text-sm sm:text-lg leading-tight font-display tracking-tight text-text-primary flex items-center gap-1">
              BN School <span className="text-[9px] font-bold px-1.5 py-0.5 bg-primary text-white rounded-full uppercase tracking-wider">WORKSPACE</span>
            </h1>
            <p className="text-[9px] text-text-muted hidden sm:block">Cloud-Native ERP platform Isolation Active</p>
          </div>
        </div>

        {/* User status & utilities */}
        <div className="flex items-center space-x-1.5 sm:space-x-3">
          
          <div className="text-right hidden md:block">
            <p className="text-xs font-bold text-text-primary">{user.name || user.phone}</p>
            <span className="text-[9px] font-bold px-1.5 py-0.5 bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200 rounded border border-border">
              {role}
            </span>
          </div>

          {/* Theme toggler */}
          <Button variant="ghost" size="icon" className="h-8 w-8 sm:h-9 sm:w-9 rounded-full flex-shrink-0" onClick={toggleTheme} title="Toggle Light/Dark Mode">
            {theme === 'dark' ? <Sun className="h-4 w-4 text-yellow-500" /> : <Moon className="h-4 w-4" />}
          </Button>

          {/* Palette Brand custom switcher */}
          <Button variant="ghost" size="icon" className="h-8 w-8 sm:h-9 sm:w-9 rounded-full flex-shrink-0" onClick={() => setShowSettings(!showSettings)} title="Customize Brand Colors">
            <Palette className="h-4 w-4" />
          </Button>

          {/* Logout trigger */}
          <Button variant="ghost" size="icon" className="h-8 w-8 sm:h-9 sm:w-9 rounded-full flex-shrink-0 text-red-500 hover:text-red-600 hover:bg-red-500/10" onClick={handleLogout} title="Log Out">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* Brand custom color presets settings drawer */}
      {showSettings && (
        <div className="bg-surface/90 backdrop-blur-md border-b border-border px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all duration-200">
          <div className="flex items-center gap-2">
            <Info className="h-4 w-4 text-primary" />
            <p className="text-xs text-text-secondary font-medium">Select a dynamic brand theme to apply to the entire UI design layout tokens:</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button 
              onClick={() => setBrandPreset('default')} 
              className={`px-3 py-1.5 rounded-md text-xs font-bold border transition-all ${brandPreset === 'default' ? 'bg-primary text-white border-primary shadow-xs' : 'bg-background text-text-secondary border-border hover:bg-surface'}`}
            >
              🔵 Default Blue (Academic)
            </button>
            <button 
              onClick={() => setBrandPreset('enterprise')} 
              className={`px-3 py-1.5 rounded-md text-xs font-bold border transition-all ${brandPreset === 'enterprise' ? 'bg-[#10b981] text-white border-[#10b981] shadow-xs' : 'bg-background text-text-secondary border-border hover:bg-surface'}`}
            >
              🟢 Enterprise (Emerald)
            </button>
            <button 
              onClick={() => setBrandPreset('fintech')} 
              className={`px-3 py-1.5 rounded-md text-xs font-bold border transition-all ${brandPreset === 'fintech' ? 'bg-[#f59e0b] text-white border-[#f59e0b] shadow-xs' : 'bg-background text-text-secondary border-border hover:bg-surface'}`}
            >
              🟡 Fintech (Gold/Amber)
            </button>
            <button 
              onClick={() => setBrandPreset('healthcare')} 
              className={`px-3 py-1.5 rounded-md text-xs font-bold border transition-all ${brandPreset === 'healthcare' ? 'bg-[#0d9488] text-white border-[#0d9488] shadow-xs' : 'bg-background text-text-secondary border-border hover:bg-surface'}`}
            >
              🟤 Healthcare (Teal)
            </button>
          </div>
        </div>
      )}

      {/* Main content frame wrapper */}
      <main className="flex-1 w-full max-w-7xl mx-auto p-4 sm:p-6 md:p-8">
        {role === 'SUPER_ADMIN' && <SuperAdminPortal />}
        {role === 'SCHOOL_ADMIN' && <SchoolAdminPortal />}
        {role === 'TEACHER' && <TeacherPortal />}
        {(role === 'STUDENT' || role === 'PARENT') && <StudentParentPortal />}
      </main>

      <footer className="border-t border-border bg-surface/30 py-4 px-6 text-center text-xs text-text-muted flex-shrink-0">
        <p>&copy; 2026 BN School Management Platform. ERP Workspaces Isolation Enabled.</p>
      </footer>

    </div>
  );
}
