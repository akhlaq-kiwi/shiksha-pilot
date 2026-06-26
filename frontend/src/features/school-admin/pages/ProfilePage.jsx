import React, { useState, useEffect } from 'react';
import { Edit, School, MapPin, Calendar, Building } from 'lucide-react';
import { Button } from '../../../common/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '../../../common/ui/card';
import { Dialog } from '../../../common/ui/dialog';
import { Input } from '../../../common/ui/input';
import { schoolService } from '../../../common/services/schoolService';

export default function ProfilePage() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isBasicOpen, setIsBasicOpen] = useState(false);
  const [isAddressOpen, setIsAddressOpen] = useState(false);
  const [isAcademicOpen, setIsAcademicOpen] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Form states initialized on edit
  const [basicForm, setBasicForm] = useState({
    name: '', registration_no: '', affiliation_board: '', school_type: '',
    founded_year: '', medium_of_instruction: '', contact_email: '', contact_phone: ''
  });
  const [addressForm, setAddressForm] = useState({
    street_address: '', city: '', state: '', pin_code: ''
  });
  const [academicForm, setAcademicForm] = useState({
    classes_offered: ''
  });

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

  // Default mock fallback values if profile has null/empty columns
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

  const handleEditBasic = () => {
    setBasicForm({
      name: schoolName === '—' ? '' : schoolName,
      registration_no: regNo === '—' ? '' : regNo,
      affiliation_board: board === '—' ? '' : board,
      school_type: type === '—' ? '' : type,
      founded_year: founded === '—' ? '' : founded,
      medium_of_instruction: medium === '—' ? '' : medium,
      contact_email: email === '—' ? '' : email,
      contact_phone: phone === '—' ? '' : phone
    });
    setError('');
    setIsBasicOpen(true);
  };

  const handleEditAddress = () => {
    setAddressForm({
      street_address: street === '—' ? '' : street,
      city: city === '—' ? '' : city,
      state: state === '—' ? '' : state,
      pin_code: pin === '—' ? '' : pin
    });
    setError('');
    setIsAddressOpen(true);
  };

  const handleEditAcademic = () => {
    setAcademicForm({
      classes_offered: classesOffered === '—' ? '' : classesOffered
    });
    setError('');
    setIsAcademicOpen(true);
  };

  const handleSave = async (updatedFields, closeDialog) => {
    setSubmitting(true);
    setError('');
    try {
      // Merge current profile values with updated fields
      const payload = {
        name: schoolName === '—' ? '' : schoolName,
        registration_no: regNo === '—' ? null : regNo,
        affiliation_board: board === '—' ? null : board,
        school_type: type === '—' ? null : type,
        founded_year: founded === '—' ? null : founded,
        medium_of_instruction: medium === '—' ? null : medium,
        contact_email: email === '—' ? null : email,
        contact_phone: phone === '—' ? null : phone,
        street_address: street === '—' ? null : street,
        city: city === '—' ? null : city,
        state: state === '—' ? null : state,
        pin_code: pin === '—' ? null : pin,
        classes_offered: classesOffered === '—' ? null : classesOffered,
        ...updatedFields
      };
      await schoolService.updateSchoolProfile(payload);
      closeDialog(false);
      loadProfile();
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to update school profile.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-text-primary tracking-tight font-display">School Profile</h2>
          <p className="text-text-secondary text-sm mt-1">Manage your school's identity, contact information, and academic configuration.</p>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-600 rounded-lg text-xs font-semibold">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-5">
          {/* Basic Info */}
          <Card>
            <CardHeader className="py-4 border-b border-border bg-zinc-50/50 dark:bg-zinc-900/50 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-bold text-text-primary flex items-center gap-2">
                <School className="h-4 w-4 text-text-secondary" /> Basic Information
              </CardTitle>
              <Button variant="outline" className="text-xs h-8 px-3 flex items-center gap-1.5" onClick={handleEditBasic}>
                <Edit className="h-3 w-3" /> Edit Info
              </Button>
            </CardHeader>
            <CardContent className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-6">
              {[
                ['School Name', schoolName],
                ['Registration No.', regNo],
                ['Affiliation Board', board],
                ['School Type', type],
                ['Founded Year', founded],
                ['Medium of Instruction', medium],
                ['Contact Email', email],
                ['Contact Phone', phone],
              ].map(([k, v]) => (
                <div key={k}>
                  <p className="text-[10px] font-black text-text-muted uppercase tracking-wider">{k}</p>
                  <p className="text-sm font-semibold text-text-primary mt-0.5">{v || '—'}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Address & Location */}
          <Card>
            <CardHeader className="py-4 border-b border-border bg-zinc-50/50 dark:bg-zinc-900/50 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-bold text-text-primary flex items-center gap-2">
                <MapPin className="h-4 w-4 text-text-secondary" /> Address & Location
              </CardTitle>
              <Button variant="outline" className="text-xs h-8 px-3 flex items-center gap-1.5" onClick={handleEditAddress}>
                <Edit className="h-3 w-3" /> Edit Address
              </Button>
            </CardHeader>
            <CardContent className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-6">
              {[
                ['Street Address', street],
                ['City', city],
                ['State', state],
                ['PIN Code', pin],
              ].map(([k, v]) => (
                <div key={k}>
                  <p className="text-[10px] font-black text-text-muted uppercase tracking-wider">{k}</p>
                  <p className="text-sm font-semibold text-text-primary mt-0.5">{v || '—'}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Academic Session */}
          <Card>
            <CardHeader className="py-4 border-b border-border bg-zinc-50/50 dark:bg-zinc-900/50 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-bold text-text-primary flex items-center gap-2">
                <Calendar className="h-4 w-4 text-text-secondary" /> Academic Session
              </CardTitle>
              <Button variant="outline" className="text-xs h-7 px-2.5 flex items-center gap-1" onClick={handleEditAcademic}>
                <Edit className="h-3 w-3" /> Edit
              </Button>
            </CardHeader>
            <CardContent className="p-5 space-y-3 text-xs">
              <div className="flex justify-between border-b border-border/60 pb-2 last:border-0 last:pb-0">
                <span className="text-text-muted font-semibold">Classes Offered</span>
                <span className="font-bold text-text-primary">{classesOffered || '—'}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Dialog: Edit Basic Info */}
      <Dialog isOpen={isBasicOpen} onClose={() => setIsBasicOpen(false)}
        title="Edit Basic Information" description="Update your school's official registry information."
        footer={<>
          <Button variant="secondary" onClick={() => setIsBasicOpen(false)}>Cancel</Button>
          <Button onClick={() => handleSave(basicForm, setIsBasicOpen)} disabled={submitting}>
            {submitting ? 'Saving...' : 'Save Changes'}
          </Button>
        </>}>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-text-secondary uppercase">School Name</label>
            <Input value={basicForm.name} onChange={e => setBasicForm(p => ({ ...p, name: e.target.value }))} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-secondary uppercase">Registration No.</label>
              <Input value={basicForm.registration_no} onChange={e => setBasicForm(p => ({ ...p, registration_no: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-secondary uppercase">Affiliation Board</label>
              <Input value={basicForm.affiliation_board} onChange={e => setBasicForm(p => ({ ...p, affiliation_board: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-secondary uppercase">School Type</label>
              <Input value={basicForm.school_type} onChange={e => setBasicForm(p => ({ ...p, school_type: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-secondary uppercase">Founded Year</label>
              <Input value={basicForm.founded_year} onChange={e => setBasicForm(p => ({ ...p, founded_year: e.target.value }))} />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-text-secondary uppercase">Medium of Instruction</label>
            <Input value={basicForm.medium_of_instruction} onChange={e => setBasicForm(p => ({ ...p, medium_of_instruction: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-secondary uppercase">Contact Email</label>
              <Input type="email" value={basicForm.contact_email} onChange={e => setBasicForm(p => ({ ...p, contact_email: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-secondary uppercase">Contact Phone</label>
              <Input value={basicForm.contact_phone} onChange={e => setBasicForm(p => ({ ...p, contact_phone: e.target.value }))} />
            </div>
          </div>
        </div>
      </Dialog>

      {/* Dialog: Edit Address */}
      <Dialog isOpen={isAddressOpen} onClose={() => setIsAddressOpen(false)}
        title="Edit Address & Location" description="Update the physical address of the institution."
        footer={<>
          <Button variant="secondary" onClick={() => setIsAddressOpen(false)}>Cancel</Button>
          <Button onClick={() => handleSave(addressForm, setIsAddressOpen)} disabled={submitting}>
            {submitting ? 'Saving...' : 'Save Address'}
          </Button>
        </>}>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-text-secondary uppercase">Street Address</label>
            <Input value={addressForm.street_address} onChange={e => setAddressForm(p => ({ ...p, street_address: e.target.value }))} />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-secondary uppercase">City</label>
              <Input value={addressForm.city} onChange={e => setAddressForm(p => ({ ...p, city: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-secondary uppercase">State</label>
              <Input value={addressForm.state} onChange={e => setAddressForm(p => ({ ...p, state: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-secondary uppercase">PIN Code</label>
              <Input value={addressForm.pin_code} onChange={e => setAddressForm(p => ({ ...p, pin_code: e.target.value }))} />
            </div>
          </div>
        </div>
      </Dialog>

      {/* Dialog: Edit Academic Session */}
      <Dialog isOpen={isAcademicOpen} onClose={() => setIsAcademicOpen(false)}
        title="Edit Academic Session" description="Configure class coverage."
        footer={<>
          <Button variant="secondary" onClick={() => setIsAcademicOpen(false)}>Cancel</Button>
          <Button onClick={() => handleSave(academicForm, setIsAcademicOpen)} disabled={submitting}>
            {submitting ? 'Saving...' : 'Save Session'}
          </Button>
        </>}>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-text-secondary uppercase">Classes Offered</label>
            <Input placeholder="e.g. 1 - 12" value={academicForm.classes_offered} onChange={e => setAcademicForm(p => ({ ...p, classes_offered: e.target.value }))} required />
          </div>
        </div>
      </Dialog>
    </div>
  );
}
