import React, { useState, useEffect } from 'react';
import { Edit, School, MapPin, Calendar, KeyRound, CreditCard, AlertCircle, CheckCircle2, Copy, Phone, Mail, AlertTriangle } from 'lucide-react';
import { Button } from '../../../common/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '../../../common/ui/card';
import { Dialog } from '../../../common/ui/dialog';
import { Input } from '../../../common/ui/input';
import { schoolService } from '../../../common/services/schoolService';
import { authService } from '../../../common/services/authService';
import { SearchableSelect, INDIAN_STATES_AND_CITIES } from '../../../common/ui/SearchableSelect';
import { useToast } from '../../../common/components/Toast';

const calculateDaysLeftText = (expiryDateStr) => {
  if (!expiryDateStr) return 'Expired';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const datePart = expiryDateStr.split(' ')[0];
  const expiry = new Date(datePart.replace(/-/g, '/'));
  expiry.setHours(0, 0, 0, 0);
  const diffTime = expiry.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return 'Expired';
  if (diffDays === 0) return '0 Days Left';
  return `${diffDays} ${diffDays === 1 ? 'Day' : 'Days'} Left`;
}

export default function ProfilePage({ mode = 'details' }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [isRemoveConfirmOpen, setIsRemoveConfirmOpen] = useState(false);
  const [logoError, setLogoError] = useState(false);
  const [signatureError, setSignatureError] = useState(false);
  const [isRemoveSignatureConfirmOpen, setIsRemoveSignatureConfirmOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Profile Form State
  const [profileForm, setProfileForm] = useState({
    name: '',
    street_address: '',
    city: '',
    state: '',
    pin_code: '',
    contact_email: '',
    contact_phone: ''
  });
  const [formErrors, setFormErrors] = useState({});

  const [plans, setPlans] = useState([]);
  const [subHistory, setSubHistory] = useState([]);

  // Password Form State
  const [passwordForm, setPasswordForm] = useState({ newPassword: '', confirmPassword: '' });
  const [submittingPassword, setSubmittingPassword] = useState(false);

  const passwordMismatch = passwordForm.confirmPassword && passwordForm.newPassword !== passwordForm.confirmPassword;

  const loadProfile = async () => {
    setLoading(true);
    setError('');
    try {
      const [profileData, plansData, historyData] = await Promise.all([
        schoolService.getSchoolProfile(),
        schoolService.getActivePlans().catch(() => []),
        schoolService.getSubscriptionHistory().catch(() => [])
      ]);
      setProfile(profileData || null);
      setPlans(plansData || []);
      setSubHistory(historyData || []);
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

  // Reset logoError state whenever logo path changes
  useEffect(() => {
    setLogoError(false);
  }, [profile?.logo_path]);

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
  const email = profile?.contact_email || '—';
  const phone = profile?.contact_phone || '—';
  const street = profile?.street_address || '—';
  const city = profile?.city || '—';
  const state = profile?.state || '—';
  const pin = profile?.pin_code || '—';

  const handleEditProfile = () => {
    setProfileForm({
      name: schoolName === '—' ? '' : schoolName,
      street_address: street === '—' ? '' : street,
      city: city === '—' ? '' : city,
      state: state === '—' ? '' : state,
      pin_code: pin === '—' ? '' : pin,
      contact_email: email === '—' ? '' : email,
      contact_phone: phone === '—' ? '' : phone,
    });
    setFormErrors({});
    setError('');
    setSuccessMsg('');
    setIsEditProfileOpen(true);
  };

  const validateForm = () => {
    const errs = {};
    if (!profileForm.name.trim()) {
      errs.name = "School Name is required";
    }
    if (!profileForm.street_address.trim()) {
      errs.street_address = "Street Address is required";
    }
    if (!profileForm.state) {
      errs.state = "State is required";
    } else if (!Object.keys(INDIAN_STATES_AND_CITIES).includes(profileForm.state)) {
      errs.state = "Please select a valid state from the list";
    }
    
    if (!profileForm.city) {
      errs.city = "City is required";
    } else {
      const allowedCities = INDIAN_STATES_AND_CITIES[profileForm.state] || [];
      if (!allowedCities.includes(profileForm.city)) {
        errs.city = "Please select a valid city from the list";
      }
    }
    
    if (!profileForm.pin_code.trim()) {
      errs.pin_code = "PIN Code is required";
    } else if (!/^\d{6}$/.test(profileForm.pin_code.trim())) {
      errs.pin_code = "PIN Code must be a 6-digit number";
    }

    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async (updatedFields, closeDialog) => {
    if (!validateForm()) return;
    
    setSubmitting(true);
    setError('');
    setSuccessMsg('');
    try {
      const payload = {
        // Keep locked contact fields unmodified
        contact_email: email === '—' ? null : email,
        contact_phone: phone === '—' ? null : phone,
        // Update user fields
        name: updatedFields.name,
        street_address: updatedFields.street_address,
        city: updatedFields.city,
        state: updatedFields.state,
        pin_code: updatedFields.pin_code
      };
      const updatedProfile = await schoolService.updateSchoolProfile(payload);
      closeDialog(false);
      setSuccessMsg('Profile details updated successfully.');
      setProfile(updatedProfile);

      // Dispatch event to update AppLayout header immediately
      window.dispatchEvent(new CustomEvent('school-profile-updated', { detail: updatedProfile }));
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to update school profile.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStateChange = (stateName) => {
    setProfileForm(prev => ({
      ...prev,
      state: stateName,
      city: ''
    }));
    if (formErrors.state) {
      setFormErrors(prev => ({ ...prev, state: null }));
    }
    if (formErrors.city) {
      setFormErrors(prev => ({ ...prev, city: null }));
    }
  };

  const handleCityChange = (cityName) => {
    setProfileForm(prev => ({
      ...prev,
      city: cityName
    }));
    if (formErrors.city) {
      setFormErrors(prev => ({ ...prev, city: null }));
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

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate size and type
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg'];
    if (!validTypes.includes(file.type)) {
      alert('Only PNG, JPG, and JPEG images are accepted.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert('File size must be less than 5MB.');
      return;
    }

    const formData = new FormData();
    formData.append('logo', file);

    setLoading(true);
    setError('');
    setSuccessMsg('');
    try {
      const updatedProfile = await schoolService.uploadSchoolLogo(formData);
      setProfile(updatedProfile);
      setSuccessMsg('School logo uploaded successfully.');
      
      // Dispatch event to update AppLayout header immediately
      window.dispatchEvent(new CustomEvent('school-profile-updated', { detail: updatedProfile }));
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to upload school logo.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogoRemove = async () => {
    setIsRemoveConfirmOpen(false);
    setLoading(true);
    setError('');
    setSuccessMsg('');
    try {
      const updatedProfile = await schoolService.removeSchoolLogo();
      setProfile(updatedProfile);
      setSuccessMsg('School logo removed.');
      
      // Dispatch event to update AppLayout header immediately
      window.dispatchEvent(new CustomEvent('school-profile-updated', { detail: updatedProfile }));
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to remove school logo.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignatureUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = file.name.split('.').pop().toLowerCase();
    if (!['png', 'jpg', 'jpeg'].includes(ext)) {
      alert('Only PNG, JPG, and JPEG files are accepted.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert('File size must be less than 5MB.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccessMsg('');
    try {
      // Process canvas adaptively to extract ink and crop bounding box
      const processedFile = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (event) => {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);

            const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imgData.data;
            const len = data.length;

            let sumLum = 0;
            let maxLum = 0;
            const luminances = new Float32Array(len / 4);

            for (let i = 0; i < len; i += 4) {
              const r = data[i], g = data[i + 1], b = data[i + 2];
              const lum = r * 0.299 + g * 0.587 + b * 0.114;
              luminances[i / 4] = lum;
              sumLum += lum;
              if (lum > maxLum) maxLum = lum;
            }

            const avgLum = sumLum / (len / 4);
            const paperThreshold = Math.min(240, Math.max(avgLum * 0.88, maxLum * 0.72));

            let minX = canvas.width, minY = canvas.height, maxX = 0, maxY = 0;
            let hasInk = false;

            for (let i = 0; i < len; i += 4) {
              const idx = i / 4;
              const lum = luminances[idx];
              const x = idx % canvas.width;
              const y = Math.floor(idx / canvas.width);
              const r = data[i], g = data[i + 1], b = data[i + 2];

              const isPaper = lum >= paperThreshold || (r > 120 && g > 120 && b > 120 && Math.abs(r - g) < 25 && Math.abs(g - b) < 25 && lum > 140);

              if (isPaper) {
                data[i + 3] = 0; // Paper pixel -> Transparent
              } else {
                hasInk = true;
                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;

                const contrastFactor = Math.max(0, (paperThreshold - lum) / paperThreshold);
                data[i + 3] = Math.min(255, Math.round(contrastFactor * 255 * 1.8));
              }
            }

            ctx.putImageData(imgData, 0, 0);

            let finalCanvas = canvas;
            if (hasInk && maxX > minX && maxY > minY) {
              const cropW = maxX - minX + 1;
              const cropH = maxY - minY + 1;
              const cropCanvas = document.createElement('canvas');
              cropCanvas.width = cropW;
              cropCanvas.height = cropH;
              const cropCtx = cropCanvas.getContext('2d');
              cropCtx.drawImage(canvas, minX, minY, cropW, cropH, 0, 0, cropW, cropH);
              finalCanvas = cropCanvas;
            }

            finalCanvas.toBlob((blob) => {
              if (blob) {
                const fileRes = new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".png", { type: 'image/png' });
                resolve(fileRes);
              } else {
                resolve(file);
              }
            }, 'image/png');
          };
          img.onerror = () => resolve(file);
          img.src = event.target.result;
        };
        reader.onerror = () => resolve(file);
        reader.readAsDataURL(file);
      });

      const formData = new FormData();
      formData.append('signature', processedFile);

      const updatedProfile = await schoolService.uploadPrincipalSignature(formData);
      setProfile(updatedProfile);
      setSuccessMsg('Principal signature uploaded successfully with transparent background.');
      window.dispatchEvent(new CustomEvent('school-profile-updated', { detail: updatedProfile }));
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to upload principal signature.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignatureRemove = async () => {
    setIsRemoveSignatureConfirmOpen(false);
    setLoading(true);
    setError('');
    setSuccessMsg('');
    try {
      const updatedProfile = await schoolService.removePrincipalSignature();
      setProfile(updatedProfile);
      setSuccessMsg('Principal signature removed.');
      window.dispatchEvent(new CustomEvent('school-profile-updated', { detail: updatedProfile }));
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to remove principal signature.');
    } finally {
      setLoading(false);
    }
  };

  const getInitials = () => {
    if (profile?.name) {
      return profile.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
    }
    return 'SP';
  };

  const getHeaderInfo = () => {
    switch (mode) {
      case 'password':
        return {
          title: "Change Password",
          desc: "Update your login credentials securely."
        };
      case 'plans':
        return {
          title: "Subscription Plans",
          desc: "View your active billing plans and payment invoices."
        };
      default:
        return {
          title: "Profile Settings",
          desc: "Manage school profile details and configurations."
        };
    }
  };

  const { title, desc } = getHeaderInfo();

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div>
        <h2 className="text-3xl font-black text-text-primary tracking-tight font-display">{title}</h2>
        <p className="text-text-secondary text-sm mt-1">{desc}</p>
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

      {/* ─── SECTION 1: Profile Details ────────────────────────────────────────── */}
      {mode === 'details' && (
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
              
              {/* School Logo / Profile Image Upload Section */}
              <div className="flex flex-col sm:flex-row items-center gap-6 p-4 bg-zinc-50/50 dark:bg-zinc-900/50 border border-border rounded-xl mb-4">
                <div className="w-20 h-20 rounded-full border border-border flex items-center justify-center overflow-hidden bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-100 text-xl font-black uppercase flex-shrink-0">
                  {!logoError && profile?.logo_path ? (
                    <img 
                      src={profile.logo_path} 
                      alt="School Logo" 
                      className="w-full h-full object-cover" 
                      onError={() => setLogoError(true)}
                    />
                  ) : (
                    <span>{getInitials()}</span>
                  )}
                </div>

                <div className="space-y-2 text-center sm:text-left flex-1">
                  <h4 className="text-xs font-bold text-text-primary uppercase tracking-wide">Logo / Profile Image</h4>
                  <p className="text-[10px] text-text-muted">PNG, JPG, JPEG. Max file size: 5MB.</p>
                  
                  <div className="flex flex-wrap gap-2 justify-center sm:justify-start items-center">
                    <label className="cursor-pointer inline-flex items-center justify-center rounded-md text-xs font-bold transition-colors border border-input bg-background hover:bg-zinc-50 dark:hover:bg-zinc-900 h-8 px-3">
                      <span>{profile?.logo_path ? 'Change Image' : 'Upload Image'}</span>
                      <input 
                        type="file" 
                        accept=".png, .jpg, .jpeg" 
                        onChange={handleLogoUpload}
                        className="hidden" 
                      />
                    </label>

                    {profile?.logo_path && (
                      <Button 
                        variant="destructive" 
                        size="sm" 
                        onClick={() => setIsRemoveConfirmOpen(true)}
                        className="h-8 px-3 text-xs font-bold"
                      >
                        Remove Image
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              {/* Principal Signature Upload Section */}
              <div className="flex flex-col sm:flex-row items-center gap-6 p-4 bg-zinc-50/50 dark:bg-zinc-900/50 border border-border rounded-xl mb-6">
                <div className="w-32 h-16 rounded-xl border border-border flex items-center justify-center overflow-hidden bg-white dark:bg-zinc-800 p-1 flex-shrink-0">
                  {!signatureError && profile?.principal_signature_path ? (
                    <img 
                      src={profile.principal_signature_path} 
                      alt="Principal Signature" 
                      className="w-full h-full object-contain" 
                      onError={() => setSignatureError(true)}
                    />
                  ) : (
                    <span className="text-[10px] font-bold text-text-muted italic">No Signature</span>
                  )}
                </div>

                <div className="space-y-2 text-center sm:text-left flex-1">
                  <h4 className="text-xs font-bold text-text-primary uppercase tracking-wide">Principal Signature</h4>
                  <p className="text-[10px] text-text-muted">PNG, JPG, JPEG. White background paper will be automatically made transparent.</p>
                  
                  <div className="flex flex-wrap gap-2 justify-center sm:justify-start items-center">
                    <label className="cursor-pointer inline-flex items-center justify-center rounded-md text-xs font-bold transition-colors border border-input bg-background hover:bg-zinc-50 dark:hover:bg-zinc-900 h-8 px-3">
                      <span>{profile?.principal_signature_path ? 'Change Signature' : 'Upload Signature'}</span>
                      <input 
                        type="file" 
                        accept=".png, .jpg, .jpeg" 
                        onChange={handleSignatureUpload}
                        className="hidden" 
                      />
                    </label>

                    {profile?.principal_signature_path && (
                      <Button 
                        variant="destructive" 
                        size="sm" 
                        onClick={() => setIsRemoveSignatureConfirmOpen(true)}
                        className="h-8 px-3 text-xs font-bold"
                      >
                        Remove Signature
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              {/* School Information */}
              <div>
                <h4 className="text-xs font-extrabold text-primary mb-3 uppercase tracking-wider">School Information</h4>
                <div className="grid grid-cols-1 gap-6 text-xs">
                  <div>
                    <p className="text-[10px] font-black text-text-muted uppercase tracking-wider">School Name</p>
                    <p className="text-sm font-semibold text-text-primary mt-0.5">{schoolName}</p>
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

      {/* ─── SECTION 2: Change Password ────────────────────────────────────────── */}
      {mode === 'password' && (
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

      {/* ─── SECTION 3: Subscription Plans ─────────────────────────────────────── */}
      {mode === 'plans' && (
        <div className="space-y-6">
          {/* Current plan card */}
          <Card className="shadow-xs border-border bg-surface">
            <CardContent className="p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="space-y-1">
                <p className="text-[10px] font-black text-text-muted uppercase tracking-wider">Current Subscription Plan</p>
                <div className="flex items-center gap-2">
                  <span className="text-xl font-black text-text-primary tracking-tight">{profile?.plan || 'Premium'}</span>
                  {(() => {
                    const daysText = calculateDaysLeftText(profile?.subscription_expiry);
                    const isExpired = daysText === 'Expired';
                    return (
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${isExpired ? 'bg-red-500/10 text-red-600 border border-red-500/20' : 'bg-blue-500/10 text-blue-600 border border-blue-500/20'}`}>
                        {daysText}
                      </span>
                    );
                  })()}
                </div>
              </div>
              <div className="text-xs text-text-secondary max-w-sm">
                Your billing and plan details are configured by the Super Admin. If you need to make changes, please get in touch with support.
              </div>
            </CardContent>
          </Card>

          {/* Plans comparison cards */}
          {plans.length === 0 ? (
            <div className="py-12 border-2 border-dashed border-border bg-surface rounded-2xl text-center text-text-muted text-sm font-medium">
              No active subscription plans found. Please contact the Super Administrator.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {plans.map(plan => {
                const isCurrent = (profile?.plan || '').toLowerCase() === plan.name.toLowerCase();
                return (
                  <Card key={plan.id} className={`shadow-xs flex flex-col justify-between overflow-hidden border ${isCurrent ? 'border-primary ring-1 ring-primary' : 'border-border'} min-h-[350px] relative p-6 rounded-2xl hover:shadow-md transition-all duration-200`}>
                    <div className="space-y-4">
                      <div className="flex justify-between items-start border-b border-border/60 pb-4">
                        <div>
                          <h4 className="text-base font-black text-text-primary tracking-tight font-display">{plan.name}</h4>
                        </div>
                        {isCurrent && (
                          <span className="text-[9px] font-black bg-primary text-zinc-50 px-2.5 py-1 rounded-full uppercase tracking-wider">Current</span>
                        )}
                      </div>
                      
                      <div className="flex justify-between items-center py-1">
                        <div className="flex items-baseline gap-1">
                          <span className="text-2xl font-black text-text-primary">₹{parseFloat(plan.price).toLocaleString('en-IN')}</span>
                          <span className="text-[10px] text-text-muted">
                            /{plan.duration_value || 1}{plan.duration_unit || 'month'}{(plan.duration_value || 1) > 1 ? 's' : ''}
                          </span>
                        </div>
                        {isCurrent && profile?.subscription_expiry && (
                          <span className="text-xs text-text-secondary font-bold">
                            Expires on {(() => {
                              const d = new Date(profile.subscription_expiry);
                              const day = d.getDate();
                              const month = d.toLocaleString('en-US', { month: 'long' });
                              const year = d.getFullYear();
                              return `${day} ${month} ${year}`;
                            })()}
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-text-secondary leading-relaxed font-medium">{plan.description}</p>
                    </div>

                    <div className="pt-6">
                      <Button 
                        className="w-full font-bold text-xs uppercase tracking-wider bg-amber-600 hover:bg-amber-700 text-white"
                        onClick={() => setContactOpen(true)}
                      >
                        Contact Super Admin
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Subscription History section */}
          <div className="space-y-4 pt-6">
            <h3 className="text-sm font-bold text-text-primary tracking-tight">Subscription History</h3>
            <Card className="shadow-xs border-border bg-surface overflow-hidden">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-border bg-zinc-50 dark:bg-zinc-900/50 text-text-secondary font-bold uppercase tracking-wider text-[10px]">
                        <th className="p-4">Plan Name</th>
                        <th className="p-4">Purchase Date</th>
                        <th className="p-4">Expiry Date</th>
                        <th className="p-4">Duration</th>
                        <th className="p-4">Amount</th>
                        <th className="p-4">Status</th>
                        <th className="p-4">Features Included</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {subHistory.length === 0 ? (
                        <tr>
                          <td colSpan="7" className="p-8 text-center text-text-muted font-medium">
                            No subscription history records found.
                          </td>
                        </tr>
                      ) : (
                        subHistory.map((sub, idx) => {
                          const today = new Date();
                          today.setHours(0, 0, 0, 0);
                          return (
                            <tr key={idx} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/20 transition-colors">
                              <td className="p-4 font-extrabold text-text-primary">{sub.plan_name}</td>
                              <td className="p-4 text-text-secondary font-medium">
                                {new Date(sub.created_at).toLocaleDateString('en-IN', {
                                  day: '2-digit',
                                  month: 'short',
                                  year: 'numeric'
                                })}
                              </td>
                              <td className="p-4 text-text-secondary font-medium">
                                {new Date(sub.expiry_date).toLocaleDateString('en-IN', {
                                  day: '2-digit',
                                  month: 'short',
                                  year: 'numeric'
                                })}
                              </td>
                              <td className="p-4 text-text-secondary font-semibold">
                                {sub.duration_value} {sub.duration_unit}{sub.duration_value > 1 ? 's' : ''}
                              </td>
                              <td className="p-4 font-bold text-text-primary">
                                ₹{parseFloat(sub.amount).toLocaleString('en-IN')}
                              </td>
                              <td className="p-4">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${sub.status === 'PAID' ? 'bg-green-500/10 text-green-600 border border-green-500/20' : 'bg-red-500/10 text-red-600 border border-red-500/20'}`}>
                                  {sub.status}
                                </span>
                              </td>
                              <td className="p-4 text-text-secondary leading-relaxed max-w-xs truncate font-medium" title={sub.features || '—'}>
                                {sub.features || '—'}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Custom Confirmation Modal for Logo Removal */}
      <Dialog
        isOpen={isRemoveConfirmOpen}
        onClose={() => setIsRemoveConfirmOpen(false)}
        title="Remove Profile Image"
        description="This action will restore the default placeholder avatar."
        footer={<>
          <Button variant="secondary" onClick={() => setIsRemoveConfirmOpen(false)}>Cancel</Button>
          <Button variant="destructive" onClick={handleLogoRemove}>Remove Image</Button>
        </>}
      >
        <div className="text-xs text-text-secondary leading-relaxed py-2">
          Are you sure you want to remove the current profile image?
        </div>
      </Dialog>

      {/* Dialog: Edit Profile Details */}
      <Dialog isOpen={isEditProfileOpen} onClose={() => setIsEditProfileOpen(false)}
        title="Edit Profile Details" description="Update your school's name and address information."
        footer={<>
          <Button variant="secondary" onClick={() => setIsEditProfileOpen(false)}>Cancel</Button>
          <Button onClick={() => handleSave(profileForm, setIsEditProfileOpen)} disabled={submitting}>
            {submitting ? 'Saving...' : 'Save Changes'}
          </Button>
        </>}>
        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-text-secondary uppercase">School Name <span className="text-red-500">*</span></label>
            <Input 
              value={profileForm.name} 
              onChange={e => {
                setProfileForm(p => ({ ...p, name: e.target.value }));
                if (formErrors.name) setFormErrors(prev => ({ ...prev, name: null }));
              }} 
              required 
            />
            {formErrors.name && <p className="text-[10px] text-red-500 font-semibold">{formErrors.name}</p>}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-secondary uppercase">Contact Email (Read-only)</label>
              <Input value={profileForm.contact_email} disabled className="bg-zinc-50 dark:bg-zinc-800/40 text-text-muted" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-secondary uppercase">Contact Phone (Read-only)</label>
              <Input value={profileForm.contact_phone} disabled className="bg-zinc-50 dark:bg-zinc-800/40 text-text-muted" />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-text-secondary uppercase">Street Address <span className="text-red-500">*</span></label>
            <Input 
              value={profileForm.street_address} 
              onChange={e => {
                setProfileForm(p => ({ ...p, street_address: e.target.value }));
                if (formErrors.street_address) setFormErrors(prev => ({ ...prev, street_address: null }));
              }} 
              required
            />
            {formErrors.street_address && <p className="text-[10px] text-red-500 font-semibold">{formErrors.street_address}</p>}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <SearchableSelect
              label="State"
              placeholder="Search State..."
              value={profileForm.state}
              onChange={handleStateChange}
              options={Object.keys(INDIAN_STATES_AND_CITIES)}
              required
              error={formErrors.state}
            />
            <SearchableSelect
              label="City"
              placeholder="Search City..."
              value={profileForm.city}
              onChange={handleCityChange}
              options={profileForm.state ? (INDIAN_STATES_AND_CITIES[profileForm.state] || []) : []}
              required
              error={formErrors.city}
            />
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-secondary uppercase">PIN Code <span className="text-red-500">*</span></label>
              <Input 
                value={profileForm.pin_code} 
                onChange={e => {
                  const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                  setProfileForm(p => ({ ...p, pin_code: val }));
                  if (formErrors.pin_code) setFormErrors(prev => ({ ...prev, pin_code: null }));
                }} 
                placeholder="6-digit ZIP/PIN code"
                required 
              />
              {formErrors.pin_code && <p className="text-[10px] text-red-500 font-semibold">{formErrors.pin_code}</p>}
            </div>
          </div>
        </div>
      </Dialog>

      {/* Remove Principal Signature Confirmation Modal */}
      {isRemoveSignatureConfirmOpen && (
        <Dialog
          isOpen={isRemoveSignatureConfirmOpen}
          onClose={() => setIsRemoveSignatureConfirmOpen(false)}
          title="Remove Principal Signature"
          description="Are you sure you want to remove the principal signature? This will hide the signature from all generated student identity cards."
          footer={
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setIsRemoveSignatureConfirmOpen(false)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleSignatureRemove}>
                Remove Signature
              </Button>
            </div>
          }
        >
          <div className="p-2 text-xs font-medium text-text-secondary">
            You can re-upload a new principal signature anytime.
          </div>
        </Dialog>
      )}

      <ContactSuperAdminDialog isOpen={contactOpen} onClose={() => setContactOpen(false)} />
    </div>
  );
}

function ContactSuperAdminDialog({ isOpen, onClose }) {
  const toast = useToast();

  const handleCopy = (text, type) => {
    navigator.clipboard.writeText(text);
    toast.success(`${type} copied successfully.`, 'Copied');
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Contact Super Admin"
      description="Get in touch with support to activate or renew subscription plans."
      className="max-w-md animate-in fade-in zoom-in-95 duration-200"
      footer={
        <div className="flex justify-end w-full">
          <Button onClick={onClose} variant="secondary">
            Close
          </Button>
        </div>
      }
    >
      <div className="space-y-4 text-sm mt-3">
        <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed font-medium">
          To purchase or renew a subscription plan, please contact the ShikshaPilot Super Admin using any of the methods below.
          Our team will assist you with plan activation and account renewal.
        </p>

        <div className="bg-zinc-50 dark:bg-zinc-900/50 p-4 rounded-xl border border-border space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-zinc-500" />
              <span className="text-text-primary font-bold">8650302499</span>
            </div>
            <Button 
              size="xs" 
              variant="outline" 
              className="flex items-center gap-1 font-bold text-[10px] py-1 px-2.5 h-7 rounded-lg"
              onClick={() => handleCopy('8650302499', 'Phone number')}
            >
              <Copy className="h-3 w-3" /> Copy
            </Button>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-zinc-500" />
              <span className="text-text-primary font-bold">Shikshapilot@gmail.com</span>
            </div>
            <Button 
              size="xs" 
              variant="outline" 
              className="flex items-center gap-1 font-bold text-[10px] py-1 px-2.5 h-7 rounded-lg"
              onClick={() => handleCopy('Shikshapilot@gmail.com', 'Email address')}
            >
              <Copy className="h-3 w-3" /> Copy
            </Button>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
