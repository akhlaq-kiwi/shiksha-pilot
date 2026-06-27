import React, { useState, useEffect } from 'react';
import { Edit, School, MapPin, Calendar, KeyRound, CreditCard, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Button } from '../../../common/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '../../../common/ui/card';
import { Dialog } from '../../../common/ui/dialog';
import { Input } from '../../../common/ui/input';
import { schoolService } from '../../../common/services/schoolService';
import { authService } from '../../../common/services/authService';

export default function ProfilePage() {
  const [activeTab, setActiveTab] = useState('details'); // 'details', 'password', 'plans'
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Profile Form State
  const [profileForm, setProfileForm] = useState({
    name: '', registration_no: '', affiliation_board: '', school_type: '',
    founded_year: '', medium_of_instruction: '', street_address: '',
    city: '', state: '', pin_code: '', classes_offered: ''
  });

  // Password Form State
  const [passwordForm, setPasswordForm] = useState({ newPassword: '', confirmPassword: '' });
  const [submittingPassword, setSubmittingPassword] = useState(false);

  const passwordMismatch = passwordForm.confirmPassword && passwordForm.newPassword !== passwordForm.confirmPassword;

  const loadProfile = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await schoolService.getSchoolProfile();
      setProfile(data || null);
    } catch (err) {
      console.error(err);
      setError('Failed to load school profile.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px] w-full">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <p className="text-xs font-bold text-text-muted uppercase tracking-wider">Loading Profile...</p>
        </div>
      </div>
    );
  }

  // Value mappings
  const schoolName = profile?.name || '—';
  const regNo = profile?.registration_no || '—';
  const board = profile?.affiliation_board || '—';
  const type = profile?.school_type || '—';
  const founded = profile?.founded_year || '—';
  const medium = profile?.medium_of_instruction || '—';
  const email = profile?.contact_email || '—';
  const phone = profile?.contact_phone || '—';
  const street = profile?.street_address || '—';
  const city = profile?.city || '—';
  const state = profile?.state || '—';
  const pin = profile?.pin_code || '—';
  const classesOffered = profile?.classes_offered || '—';

  const handleEditProfile = () => {
    setProfileForm({
      name: schoolName === '—' ? '' : schoolName,
      registration_no: regNo === '—' ? '' : regNo,
      affiliation_board: board === '—' ? '' : board,
      school_type: type === '—' ? '' : type,
      founded_year: founded === '—' ? '' : founded,
      medium_of_instruction: medium === '—' ? '' : medium,
      street_address: street === '—' ? '' : street,
      city: city === '—' ? '' : city,
      state: state === '—' ? '' : state,
      pin_code: pin === '—' ? '' : pin,
      classes_offered: classesOffered === '—' ? '' : classesOffered,
    });
    setError('');
    setSuccessMsg('');
    setIsEditProfileOpen(true);
  };

  const handleSave = async (updatedFields, closeDialog) => {
    setSubmitting(true);
    setError('');
    setSuccessMsg('');
    try {
      const payload = {
        // Keep locked contact fields unmodified
        contact_email: email === '—' ? null : email,
        contact_phone: phone === '—' ? null : phone,
        // Update user fields
        ...updatedFields
      };
      await schoolService.updateSchoolProfile(payload);
      closeDialog(false);
      setSuccessMsg('Profile details updated successfully.');
      loadProfile();
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to update school profile.');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (passwordMismatch || passwordForm.newPassword.length < 6) return;

    setSubmittingPassword(true);
    setError('');
    setSuccessMsg('');
    try {
      await authService.changePassword(passwordForm.newPassword);
      setSuccessMsg('Your password has been changed successfully.');
      setPasswordForm({ newPassword: '', confirmPassword: '' });
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to change password.');
    } finally {
      setSubmittingPassword(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div>
        <h2 className="text-3xl font-black text-text-primary tracking-tight font-display">Profile Settings</h2>
        <p className="text-text-secondary text-sm mt-1">Manage profile details, credentials, and view active subscription plans.</p>
      </div>

      {/* Tab Selector Nav */}
      <div className="flex border-b border-border text-sm overflow-x-auto whitespace-nowrap scrollbar-none gap-6">
        {[
          { id: 'details', label: 'Profile Details', icon: School },
          { id: 'password', label: 'Change Password', icon: KeyRound },
          { id: 'plans', label: 'Subscription Plans', icon: CreditCard }
        ].map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setActiveTab(tab.id);
                setError('');
                setSuccessMsg('');
              }}
              className={`flex items-center gap-2 pb-3 font-bold border-b-2 transition-all ${activeTab === tab.id ? 'border-primary text-primary font-black' : 'border-transparent text-text-muted hover:text-text-secondary hover:border-border/60'}`}
            >
              <Icon className="h-4 w-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-600 rounded-lg text-xs font-semibold flex items-center gap-2">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-3 bg-green-500/10 border border-green-500/20 text-green-600 rounded-lg text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* ─── TAB 1: Profile Details ────────────────────────────────────────── */}
      {activeTab === 'details' && (
        <div className="space-y-6">
          <Card className="shadow-xs border-border bg-surface">
            <CardHeader className="py-4 border-b border-border bg-zinc-50/50 dark:bg-zinc-900/50 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-bold text-text-primary flex items-center gap-2">
                <School className="h-4 w-4 text-text-secondary" /> Profile Details
              </CardTitle>
              <Button variant="outline" className="text-xs h-8 px-3 flex items-center gap-1.5 font-bold" onClick={handleEditProfile}>
                <Edit className="h-3 w-3" /> Edit Profile
              </Button>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              
              {/* School Information */}
              <div>
                <h4 className="text-xs font-extrabold text-primary mb-3 uppercase tracking-wider">School Information</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 text-xs">
                  <div>
                    <p className="text-[10px] font-black text-text-muted uppercase tracking-wider">School Name</p>
                    <p className="text-sm font-semibold text-text-primary mt-0.5">{schoolName}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-text-muted uppercase tracking-wider">Registration No.</p>
                    <p className="text-sm font-semibold text-text-primary mt-0.5">{regNo}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-text-muted uppercase tracking-wider">Affiliation Board</p>
                    <p className="text-sm font-semibold text-text-primary mt-0.5">{board}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-text-muted uppercase tracking-wider">School Type</p>
                    <p className="text-sm font-semibold text-text-primary mt-0.5">{type}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-text-muted uppercase tracking-wider">Founded Year</p>
                    <p className="text-sm font-semibold text-text-primary mt-0.5">{founded}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-text-muted uppercase tracking-wider">Medium of Instruction</p>
                    <p className="text-sm font-semibold text-text-primary mt-0.5">{medium}</p>
                  </div>
                </div>
              </div>

              <hr className="border-border" />

              {/* Address & Location */}
              <div>
                <h4 className="text-xs font-extrabold text-primary mb-3 uppercase tracking-wider">Address & Location</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 text-xs">
                  <div className="sm:col-span-2">
                    <p className="text-[10px] font-black text-text-muted uppercase tracking-wider">Street Address</p>
                    <p className="text-sm font-semibold text-text-primary mt-0.5">{street}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-text-muted uppercase tracking-wider">City</p>
                    <p className="text-sm font-semibold text-text-primary mt-0.5">{city}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-text-muted uppercase tracking-wider">State</p>
                    <p className="text-sm font-semibold text-text-primary mt-0.5">{state}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-text-muted uppercase tracking-wider">PIN Code</p>
                    <p className="text-sm font-semibold text-text-primary mt-0.5">{pin}</p>
                  </div>
                </div>
              </div>

              <hr className="border-border" />

              {/* Academic Configuration */}
              <div>
                <h4 className="text-xs font-extrabold text-primary mb-3 uppercase tracking-wider">Academic Configuration</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs">
                  <div>
                    <p className="text-[10px] font-black text-text-muted uppercase tracking-wider">Classes Offered</p>
                    <p className="text-sm font-semibold text-text-primary mt-0.5">{classesOffered}</p>
                  </div>
                </div>
              </div>

              <hr className="border-border" />

              {/* Contact Information */}
              <div>
                <h4 className="text-xs font-extrabold text-primary mb-3 uppercase tracking-wider">Contact Information</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs mb-3">
                  <div>
                    <p className="text-[10px] font-black text-text-muted uppercase tracking-wider">Contact Email</p>
                    <p className="text-sm font-semibold text-text-primary mt-0.5">{email}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-text-muted uppercase tracking-wider">Contact Phone</p>
                    <p className="text-sm font-semibold text-text-primary mt-0.5">{phone}</p>
                  </div>
                </div>
                <div className="p-3 bg-zinc-50 border border-zinc-200 dark:bg-zinc-900/50 dark:border-zinc-800 text-[11px] text-text-muted italic rounded-lg leading-relaxed mt-2.5">
                  To update your registered email address or contact number, please contact the Super Admin.
                </div>
              </div>

            </CardContent>
          </Card>
        </div>
      )}

      {/* ─── TAB 2: Change Password ────────────────────────────────────────── */}
      {activeTab === 'password' && (
        <Card className="max-w-md shadow-xs border-border bg-surface">
          <CardHeader className="py-4 border-b border-border bg-zinc-50/50 dark:bg-zinc-900/50">
            <CardTitle className="text-sm font-bold text-text-primary flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-text-secondary" /> Change Password
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <form onSubmit={handlePasswordChange} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-text-secondary uppercase">New Password</label>
                <Input 
                  type="password" 
                  placeholder="Minimum 6 characters" 
                  value={passwordForm.newPassword} 
                  onChange={e => setPasswordForm(p => ({ ...p, newPassword: e.target.value }))} 
                  required 
                  minLength={6} 
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-text-secondary uppercase">Confirm New Password</label>
                <Input 
                  type="password" 
                  placeholder="Repeat new password" 
                  value={passwordForm.confirmPassword} 
                  onChange={e => setPasswordForm(p => ({ ...p, confirmPassword: e.target.value }))} 
                  required 
                  className={passwordMismatch ? 'border-red-400 focus:ring-red-400' : ''} 
                />
                {passwordMismatch && (
                  <p className="text-[10px] text-red-500 font-semibold mt-1">Passwords do not match</p>
                )}
              </div>
              <Button type="submit" disabled={submittingPassword || passwordMismatch || passwordForm.newPassword.length < 6} className="w-full font-bold">
                {submittingPassword ? 'Updating...' : 'Update Password'}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* ─── TAB 3: Subscription Plans ─────────────────────────────────────── */}
      {activeTab === 'plans' && (
        <div className="space-y-6">
          {/* Current plan card */}
          <Card className="shadow-xs border-border bg-surface">
            <CardContent className="p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="space-y-1">
                <p className="text-[10px] font-black text-text-muted uppercase tracking-wider">Current Subscription Plan</p>
                <div className="flex items-center gap-2">
                  <span className="text-xl font-black text-text-primary tracking-tight">{profile?.plan || 'Premium'}</span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-black uppercase bg-green-500/10 text-green-600 border border-green-500/20">Active</span>
                </div>
              </div>
              <div className="text-xs text-text-secondary max-w-sm">
                Your billing and plan details are configured by the Super Admin. If you need to make changes, please get in touch with support.
              </div>
            </CardContent>
          </Card>

          {/* Plans comparison cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                name: 'Standard',
                price: '₹7,999',
                limit: '1,500 Students',
                desc: 'Includes standard gradebooks and audit logs up to 1,500 students.',
                features: ['Gradebooks', 'Audit Logs', 'Timetables', 'Exams & Results', 'Standard Support']
              },
              {
                name: 'Premium',
                price: '₹19,999',
                limit: '5,000 Students',
                desc: 'Includes dynamic timetables, color themes, and multi-branch configurations.',
                features: ['All Standard features', 'Dynamic Timetables', 'Color Themes', 'Multi-branch Configs', 'Priority Support']
              },
              {
                name: 'Enterprise',
                price: '₹39,999',
                limit: 'Unlimited Students',
                desc: 'Unlimited students, custom domain matching, and dedicated audit log exports.',
                features: ['All Premium features', 'Unlimited Students', 'Custom Domain Matching', 'Dedicated Audit Logs', '24/7 Phone Support']
              }
            ].map(plan => {
              const isCurrent = (profile?.plan || 'Premium').toLowerCase() === plan.name.toLowerCase();
              return (
                <Card key={plan.name} className={`shadow-xs flex flex-col justify-between overflow-hidden border ${isCurrent ? 'border-primary ring-1 ring-primary' : 'border-border'}`}>
                  <div className="p-6 space-y-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="text-base font-black text-text-primary tracking-tight">{plan.name}</h4>
                        <p className="text-[11px] text-text-muted mt-0.5">{plan.limit}</p>
                      </div>
                      {isCurrent && (
                        <span className="text-[9px] font-black bg-primary text-zinc-50 px-2 py-0.5 rounded uppercase">Current</span>
                      )}
                    </div>
                    
                    <div className="flex items-baseline gap-1 py-1">
                      <span className="text-2xl font-black text-text-primary">{plan.price}</span>
                      <span className="text-[10px] text-text-muted">/month</span>
                    </div>

                    <p className="text-xs text-text-secondary leading-relaxed">{plan.desc}</p>

                    <hr className="border-border" />

                    <ul className="space-y-2 text-xs text-text-primary">
                      {plan.features.map(f => (
                        <li key={f} className="flex items-center gap-2 opacity-90">
                          <span className="h-1.5 w-1.5 rounded-full bg-primary flex-shrink-0"></span>
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="p-6 pt-0">
                    {isCurrent ? (
                      <Button disabled className="w-full font-bold text-xs uppercase tracking-wider">Current Plan</Button>
                    ) : (
                      <Button variant="outline" disabled className="w-full font-bold text-xs uppercase tracking-wider text-text-muted border-border">Contact Super Admin</Button>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Dialog: Edit Profile Details */}
      <Dialog isOpen={isEditProfileOpen} onClose={() => setIsEditProfileOpen(false)}
        title="Edit Profile Details" description="Update your school's information, address, and classes."
        footer={<>
          <Button variant="secondary" onClick={() => setIsEditProfileOpen(false)}>Cancel</Button>
          <Button onClick={() => handleSave(profileForm, setIsEditProfileOpen)} disabled={submitting}>
            {submitting ? 'Saving...' : 'Save Changes'}
          </Button>
        </>}>
        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-text-secondary uppercase">School Name</label>
            <Input value={profileForm.name} onChange={e => setProfileForm(p => ({ ...p, name: e.target.value }))} required />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-secondary uppercase">Registration No.</label>
              <Input value={profileForm.registration_no} onChange={e => setProfileForm(p => ({ ...p, registration_no: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-secondary uppercase">Affiliation Board</label>
              <Input value={profileForm.affiliation_board} onChange={e => setProfileForm(p => ({ ...p, affiliation_board: e.target.value }))} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-secondary uppercase">School Type</label>
              <Input value={profileForm.school_type} onChange={e => setProfileForm(p => ({ ...p, school_type: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-secondary uppercase">Founded Year</label>
              <Input value={profileForm.founded_year} onChange={e => setProfileForm(p => ({ ...p, founded_year: e.target.value }))} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-secondary uppercase">Medium of Instruction</label>
              <Input value={profileForm.medium_of_instruction} onChange={e => setProfileForm(p => ({ ...p, medium_of_instruction: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-secondary uppercase">Classes Offered</label>
              <Input placeholder="e.g. 1 - 12" value={profileForm.classes_offered} onChange={e => setProfileForm(p => ({ ...p, classes_offered: e.target.value }))} required />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-text-secondary uppercase">Street Address</label>
            <Input value={profileForm.street_address} onChange={e => setProfileForm(p => ({ ...p, street_address: e.target.value }))} />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-secondary uppercase">City</label>
              <Input value={profileForm.city} onChange={e => setProfileForm(p => ({ ...p, city: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-secondary uppercase">State</label>
              <Input value={profileForm.state} onChange={e => setProfileForm(p => ({ ...p, state: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-secondary uppercase">PIN Code</label>
              <Input value={profileForm.pin_code} onChange={e => setProfileForm(p => ({ ...p, pin_code: e.target.value }))} />
            </div>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
