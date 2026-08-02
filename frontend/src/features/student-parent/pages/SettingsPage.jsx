import React, { useState, useEffect } from 'react';
import { 
  User, Bell, Shield, HelpCircle, Info, LogOut, Sun, Moon, 
  Settings, ChevronRight, School, Laptop, Check, Users
} from 'lucide-react';
import { Button } from '../../../common/ui/button';
import { Card, CardContent } from '../../../common/ui/card';
import { Dialog } from '../../../common/ui/dialog';
import { useTheme } from '../../../theme/ThemeContext';
import { authService } from '../../../common/services/authService';
import { schoolService } from '../../../common/services/schoolService';
import { studentService } from '../../../common/services/studentService';
import { useToast } from '../../../common/components/Toast';

export default function SettingsPage() {
  const toast = useToast();
  const { theme, setTheme } = useTheme();
  const user = authService.getCurrentUser();
  const role = authService.getUserRole();
  const isParent = role === 'PARENT';

  const [children, setChildren] = useState([]);
  const [schoolProfile, setSchoolProfile] = useState(null);
  
  // Settings details modals
  const [activeModal, setActiveModal] = useState(null); // 'profile' | 'notifications' | 'privacy' | 'help' | 'about'
  const [notifsEnabled, setNotifsEnabled] = useState(true);

  useEffect(() => {
    // Fetch profile and school details
    schoolService.getSchoolProfile()
      .then(p => setSchoolProfile(p))
      .catch(err => console.error("Failed to load school profile", err));

    if (isParent) {
      studentService.getChildren()
        .then(data => setChildren(data || []))
        .catch(err => console.error("Failed to fetch children for settings:", err));
    }
  }, [isParent]);

  const handleLogout = () => {
    authService.logout();
  };

  const getInitials = (name) => {
    if (!name) return 'S';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const displayName = isParent 
    ? (children[0]?.name || 'Parent Account')
    : (user?.name || 'Student Account');

  const gradeDisplay = isParent
    ? (children[0]?.grade ? `${children[0].grade}` : 'Student')
    : 'Grade 9-A · Roll 14';

  return (
    <div className="space-y-6 max-w-2xl mx-auto pb-16 animate-in fade-in duration-300">
      
      {/* Title */}
      <div>
        <h2 className="text-xl font-bold text-text-primary tracking-tight font-display">Settings</h2>
        <p className="text-xs text-text-muted">Manage settings, application theme, and notification preferences.</p>
      </div>

      {/* Top Profile Header Card */}
      <Card className="bg-surface border-border overflow-hidden shadow-xs">
        <CardContent className="p-6 flex flex-col items-center text-center space-y-4">
          <div className="relative group">
            <div className="h-20 w-20 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-2xl border-2 border-primary/20 shadow-inner">
              {getInitials(displayName)}
            </div>
          </div>
          <div>
            <h3 className="text-base font-bold text-text-primary">{displayName}</h3>
            <p className="text-xs text-text-muted font-semibold mt-0.5">{gradeDisplay}</p>
          </div>
        </CardContent>
      </Card>

      {/* School Info Section */}
      <Card className="bg-surface border-border overflow-hidden shadow-xs">
        <CardContent className="p-4 flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
            <School className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] text-text-muted font-bold uppercase tracking-wider">Associated School</p>
            <p className="text-xs font-bold text-text-primary truncate">{schoolProfile?.name || 'Shiksha Pilot Academy'}</p>
          </div>
        </CardContent>
      </Card>

      {/* Settings Options List */}
      <div className="space-y-1.5">
        <p className="text-[11px] font-bold text-text-muted uppercase tracking-wider px-3 mb-2">Preferences & Details</p>
        
        {/* Profile */}
        <button
          onClick={() => setActiveModal('profile')}
          className="w-full bg-surface hover:bg-secondary/40 border border-border rounded-xl p-4 flex items-center justify-between text-left transition-colors focus:outline-hidden"
        >
          <div className="flex items-center gap-3">
            <User className="h-4 w-4 text-text-secondary" />
            <span className="text-xs font-bold text-text-primary">Profile Details</span>
          </div>
          <ChevronRight className="h-4 w-4 text-text-muted" />
        </button>

        {/* Notifications */}
        <button
          onClick={() => setActiveModal('notifications')}
          className="w-full bg-surface hover:bg-secondary/40 border border-border rounded-xl p-4 flex items-center justify-between text-left transition-colors focus:outline-hidden"
        >
          <div className="flex items-center gap-3">
            <Bell className="h-4 w-4 text-text-secondary" />
            <span className="text-xs font-bold text-text-primary">Notifications</span>
          </div>
          <ChevronRight className="h-4 w-4 text-text-muted" />
        </button>

        {/* Appearance */}
        <button
          onClick={() => setActiveModal('appearance')}
          className="w-full bg-surface hover:bg-secondary/40 border border-border rounded-xl p-4 flex items-center justify-between text-left transition-colors focus:outline-hidden"
        >
          <div className="flex items-center gap-3">
            {theme === 'dark' ? <Moon className="h-4 w-4 text-text-secondary" /> : <Sun className="h-4 w-4 text-text-secondary" />}
            <span className="text-xs font-bold text-text-primary">Appearance (Theme)</span>
          </div>
          <ChevronRight className="h-4 w-4 text-text-muted" />
        </button>

        {/* Privacy */}
        <button
          onClick={() => setActiveModal('privacy')}
          className="w-full bg-surface hover:bg-secondary/40 border border-border rounded-xl p-4 flex items-center justify-between text-left transition-colors focus:outline-hidden"
        >
          <div className="flex items-center gap-3">
            <Shield className="h-4 w-4 text-text-secondary" />
            <span className="text-xs font-bold text-text-primary">Privacy Settings</span>
          </div>
          <ChevronRight className="h-4 w-4 text-text-muted" />
        </button>

        {/* Help & Support */}
        <button
          onClick={() => setActiveModal('help')}
          className="w-full bg-surface hover:bg-secondary/40 border border-border rounded-xl p-4 flex items-center justify-between text-left transition-colors focus:outline-hidden"
        >
          <div className="flex items-center gap-3">
            <HelpCircle className="h-4 w-4 text-text-secondary" />
            <span className="text-xs font-bold text-text-primary">Help & Support</span>
          </div>
          <ChevronRight className="h-4 w-4 text-text-muted" />
        </button>

        {/* About */}
        <button
          onClick={() => setActiveModal('about')}
          className="w-full bg-surface hover:bg-secondary/40 border border-border rounded-xl p-4 flex items-center justify-between text-left transition-colors focus:outline-hidden"
        >
          <div className="flex items-center gap-3">
            <Info className="h-4 w-4 text-text-secondary" />
            <span className="text-xs font-bold text-text-primary">About Application</span>
          </div>
          <ChevronRight className="h-4 w-4 text-text-muted" />
        </button>

        {/* Logout */}
        <div className="pt-4">
          <button
            onClick={handleLogout}
            className="w-full bg-red-500/10 hover:bg-red-500/15 border border-red-500/20 text-red-600 dark:text-red-400 rounded-xl p-4 flex items-center justify-center gap-2 font-bold text-xs transition-colors focus:outline-hidden"
          >
            <LogOut className="h-4 w-4" />
            <span>Logout Account</span>
          </button>
        </div>
      </div>

      {/* Profile Modal */}
      {activeModal === 'profile' && (
        <Dialog
          open={activeModal === 'profile'}
          onClose={() => setActiveModal(null)}
          title="Profile Details"
          className="max-w-md"
        >
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-3 border-b border-border/50 py-2">
              <span className="font-bold text-text-muted uppercase">Full Name</span>
              <span className="col-span-2 text-text-primary font-bold">{isParent ? user?.name : displayName}</span>
            </div>
            {isParent && (
              <div className="grid grid-cols-3 border-b border-border/50 py-2">
                <span className="font-bold text-text-muted uppercase">Viewing Child</span>
                <span className="col-span-2 text-text-primary font-bold">{displayName}</span>
              </div>
            )}
            <div className="grid grid-cols-3 border-b border-border/50 py-2">
              <span className="font-bold text-text-muted uppercase">Phone No</span>
              <span className="col-span-2 text-text-primary font-semibold">{user?.phone}</span>
            </div>
            <div className="grid grid-cols-3 border-b border-border/50 py-2">
              <span className="font-bold text-text-muted uppercase">Class & Grade</span>
              <span className="col-span-2 text-text-primary font-semibold">{gradeDisplay}</span>
            </div>
            <div className="grid grid-cols-3 py-2">
              <span className="font-bold text-text-muted uppercase">Portal Mode</span>
              <span className="col-span-2 text-text-primary font-bold">{role}</span>
            </div>
            <div className="flex justify-end pt-3 border-t border-border mt-4">
              <Button onClick={() => setActiveModal(null)} variant="outline">Close</Button>
            </div>
          </div>
        </Dialog>
      )}

      {/* Notifications Modal */}
      {activeModal === 'notifications' && (
        <Dialog
          open={activeModal === 'notifications'}
          onClose={() => setActiveModal(null)}
          title="Notification Settings"
          className="max-w-md"
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="text-xs font-bold text-text-primary">Enable Push Notifications</p>
                <p className="text-[11px] text-text-muted mt-0.5">Receive alerts when school announcements or holidays occur.</p>
              </div>
              <input 
                type="checkbox" 
                checked={notifsEnabled}
                onChange={e => {
                  setNotifsEnabled(e.target.checked);
                  toast.show('success', 'Saved', `Notifications ${e.target.checked ? 'enabled' : 'disabled'}.`);
                }}
                className="h-4.5 w-9 rounded-full appearance-none bg-zinc-200 dark:bg-zinc-800 checked:bg-primary cursor-pointer transition-colors relative before:content-[''] before:absolute before:h-3.5 before:w-3.5 before:rounded-full before:bg-white before:top-0.5 before:left-0.5 checked:before:translate-x-4.5 before:transition-transform"
              />
            </div>
            <div className="flex justify-end pt-3 border-t border-border mt-4">
              <Button onClick={() => setActiveModal(null)} variant="outline">Close</Button>
            </div>
          </div>
        </Dialog>
      )}

      {/* Appearance Modal */}
      {activeModal === 'appearance' && (
        <Dialog
          open={activeModal === 'appearance'}
          onClose={() => setActiveModal(null)}
          title="Appearance (Theme)"
          className="max-w-xs"
        >
          <div className="space-y-2">
            {[
              { id: 'light', label: 'Light Mode', icon: Sun },
              { id: 'dark', label: 'Dark Mode', icon: Moon }
            ].map(t => (
              <button
                key={t.id}
                onClick={() => {
                  setTheme(t.id);
                  toast.show('success', 'Theme Updated', `Switched to ${t.label}.`);
                }}
                className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-secondary/40 border border-transparent hover:border-border text-left transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <t.icon className="h-4 w-4 text-text-secondary" />
                  <span className="text-xs font-bold text-text-primary">{t.label}</span>
                </div>
                {theme === t.id && <Check className="h-4 w-4 text-primary" />}
              </button>
            ))}
            <div className="flex justify-end pt-3 border-t border-border mt-4">
              <Button onClick={() => setActiveModal(null)} variant="outline">Close</Button>
            </div>
          </div>
        </Dialog>
      )}

      {/* Privacy Modal */}
      {activeModal === 'privacy' && (
        <Dialog
          open={activeModal === 'privacy'}
          onClose={() => setActiveModal(null)}
          title="Privacy Settings"
          className="max-w-md"
        >
          <div className="space-y-3">
            <p className="text-xs text-text-secondary leading-relaxed">
              Your academic data is fully encrypted and stored securely. To request details updates, contact the School Administration directly.
            </p>
            <div className="flex justify-end pt-3 border-t border-border mt-4">
              <Button onClick={() => setActiveModal(null)} variant="outline">Close</Button>
            </div>
          </div>
        </Dialog>
      )}

      {/* Help Modal */}
      {activeModal === 'help' && (
        <Dialog
          open={activeModal === 'help'}
          onClose={() => setActiveModal(null)}
          title="Help & Support"
          className="max-w-md"
        >
          <div className="space-y-3">
            <p className="text-xs text-text-secondary leading-relaxed">
              If you have any questions or experience difficulties in applying for leaves or reviewing holidays:
            </p>
            <ul className="text-xs space-y-1.5 pl-4 list-disc text-text-secondary">
              <li>Check your network connection.</li>
              <li>Ensure the School Administrator has approved your active profile session.</li>
              <li>For direct help, email us at <span className="font-bold">support@shikshapilot.com</span>.</li>
            </ul>
            <div className="flex justify-end pt-3 border-t border-border mt-4">
              <Button onClick={() => setActiveModal(null)} variant="outline">Close</Button>
            </div>
          </div>
        </Dialog>
      )}

      {/* About Modal */}
      {activeModal === 'about' && (
        <Dialog
          open={activeModal === 'about'}
          onClose={() => setActiveModal(null)}
          title="About Application"
          className="max-w-sm"
        >
          <div className="space-y-3 text-center py-2">
            <div className="h-10 w-10 bg-primary/10 text-primary rounded-xl flex items-center justify-center mx-auto mb-2">
              <Settings className="h-5 w-5" />
            </div>
            <h4 className="text-xs font-bold text-text-primary">Shiksha Pilot Portal</h4>
            <p className="text-[11px] text-text-muted">Version 1.0.0 (Build 449)</p>
            <p className="text-[11px] text-text-muted">© 2026 Shiksha Pilot Inc. All rights reserved.</p>
            <div className="flex justify-end pt-3 border-t border-border mt-4">
              <Button onClick={() => setActiveModal(null)} variant="outline" className="mx-auto">Close</Button>
            </div>
          </div>
        </Dialog>
      )}

    </div>
  );
}
