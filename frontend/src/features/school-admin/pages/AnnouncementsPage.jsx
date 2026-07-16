import React, { useState, useEffect } from 'react';
import { 
  FileText, Eye, Edit, Trash2, AlertCircle, Bold, Italic, Underline, Check, Megaphone, Plus
} from 'lucide-react';
import { schoolService } from '../../../common/services/schoolService';
import { Card, CardContent } from '../../../common/ui/card';
import { Button } from '../../../common/ui/button';
import { Input } from '../../../common/ui/input';
import { Dialog } from '../../../common/ui/dialog';
import { Select } from '../../../common/ui/select';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../../common/ui/table';
import { useToast } from '../../../common/components/Toast';
import PageTitle from '../../../common/components/PageTitle';

export default function AnnouncementsPage() {
  const toast = useToast();

  // State Variables
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Form Fields State
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [audience, setAudience] = useState('Both'); // 'Teachers' | 'Students' | 'Both'
  const [editingId, setEditingId] = useState(null);

  // Filter State
  const [audienceFilter, setAudienceFilter] = useState('Teachers'); // Default to 'Teachers'

  // Modal / Confirm States
  const [showFormModal, setShowFormModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showConfirmPublish, setShowConfirmPublish] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [showConfirmMoveToDraft, setShowConfirmMoveToDraft] = useState(false);
  const [selectedAnn, setSelectedAnn] = useState(null);
  
  // Track status to save/publish
  const [pendingStatus, setPendingStatus] = useState('Draft');

  // UI Dropdown state
  const [activeDropdownId, setActiveDropdownId] = useState(null);
  
  // Refs
  const editorRef = React.useRef(null);

  // Fetch Announcements
  const loadAnnouncements = async () => {
    setLoading(true);
    try {
      const data = await schoolService.getAnnouncements();
      // Ensure sorting newest created first (Descending)
      const sorted = (data || []).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      setAnnouncements(sorted);
    } catch (err) {
      toast.show('error', 'Error', err.message || 'Failed to load announcements.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAnnouncements();
  }, []);

  // Sync Rich Text Editor content when description state changes from external (e.g. edit mode initialization)
  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== description) {
      editorRef.current.innerHTML = description;
    }
  }, [description, showFormModal]);

  // Click outside to close dropdowns
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (!e.target.closest('.dropdown-container')) {
        setActiveDropdownId(null);
      }
    };
    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, []);

  // Rich Text Action Executer
  const execCmd = (cmd) => {
    document.execCommand(cmd, false, null);
    if (editorRef.current) {
      setDescription(editorRef.current.innerHTML);
    }
  };

  // Keyboard shortcut handlers for Editor
  const handleEditorKeyDown = (e) => {
    if (e.ctrlKey || e.metaKey) {
      const key = e.key.toLowerCase();
      if (key === 'b') {
        e.preventDefault();
        execCmd('bold');
      } else if (key === 'i') {
        e.preventDefault();
        execCmd('italic');
      } else if (key === 'u') {
        e.preventDefault();
        execCmd('underline');
      }
    }
  };

  const handleEditorInput = () => {
    if (editorRef.current) {
      setDescription(editorRef.current.innerHTML);
    }
  };

  // Format Date standard: 13 July 2027
  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    try {
      const datePart = dateStr.includes(' ') ? dateStr.split(' ')[0] : (dateStr.includes('T') ? dateStr.split('T')[0] : dateStr);
      const parts = datePart.split('-');
      if (parts.length === 3) {
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10);
        const day = parseInt(parts[2], 10);
        const months = [
          'January', 'February', 'March', 'April', 'May', 'June',
          'July', 'August', 'September', 'October', 'November', 'December'
        ];
        return `${day} ${months[month - 1]} ${year}`;
      }
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return dateStr;
      const day = date.getDate();
      const months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
      ];
      return `${day} ${months[date.getMonth()]} ${date.getFullYear()}`;
    } catch (e) {
      return dateStr;
    }
  };

  const formatAudience = (aud) => {
    if (aud === 'Both') return 'For Teachers & Students';
    if (aud === 'Teachers') return 'For Teachers Only';
    if (aud === 'Students') return 'For Students Only';
    return aud;
  };

  // Open Form Modal for Create
  const handleOpenCreateModal = () => {
    setSubject('');
    setDescription('');
    if (editorRef.current) editorRef.current.innerHTML = '';
    setAudience('Both');
    setEditingId(null);
    setShowFormModal(true);
  };

  // Open Form Modal for Edit
  const handleEdit = (ann) => {
    setSubject(ann.subject);
    setDescription(ann.description);
    setAudience(ann.audience);
    setEditingId(ann.id);
    setActiveDropdownId(null);
    setShowFormModal(true);
  };

  // Trigger Save validations
  const handlePreSave = (status) => {
    const cleanSub = subject.trim();
    const cleanDescText = editorRef.current ? editorRef.current.textContent.trim() : '';

    if (!cleanSub) {
      toast.show('error', 'Validation Error', 'Subject is mandatory.');
      return;
    }
    if (cleanSub.length > 100) {
      toast.show('error', 'Validation Error', 'Subject cannot exceed 100 characters.');
      return;
    }
    if (!cleanDescText && !description.trim()) {
      toast.show('error', 'Validation Error', 'Description is mandatory.');
      return;
    }

    setPendingStatus(status);

    if (status === 'Published') {
      setShowConfirmPublish(true);
    } else {
      handleSaveAnnouncement(status);
    }
  };

  // Save (Create or Update) Announcement
  const handleSaveAnnouncement = async (statusOverride) => {
    const statusToSave = statusOverride || pendingStatus;
    setSubmitting(true);
    try {
      const payload = {
        subject: subject.trim(),
        description: description,
        audience: audience,
        status: statusToSave
      };

      if (editingId) {
        await schoolService.updateAnnouncement(editingId, payload);
        toast.show('success', 'Updated', 'Announcement updated successfully.');
      } else {
        await schoolService.createAnnouncement(payload);
        if (statusToSave === 'Published') {
          toast.show('success', 'Published', 'Announcement published successfully and notifications sent.');
        } else {
          toast.show('success', 'Saved as Draft', 'Announcement saved as draft.');
        }
      }

      // Reset Form fields
      setSubject('');
      setDescription('');
      if (editorRef.current) editorRef.current.innerHTML = '';
      setAudience('Both');
      setEditingId(null);

      // Close popups/confirm modals
      setShowFormModal(false);
      setShowConfirmPublish(false);
      
      // Refresh listing state instantly
      await loadAnnouncements();
    } catch (err) {
      toast.show('error', 'Error', err.message || 'Failed to save announcement.');
    } finally {
      setSubmitting(false);
    }
  };

  // Direct Publish Action for Drafts in table list
  const handleDirectPublish = (ann) => {
    setSubject(ann.subject);
    setDescription(ann.description);
    setAudience(ann.audience);
    setEditingId(ann.id);
    setPendingStatus('Published');
    setShowConfirmPublish(true);
    setActiveDropdownId(null);
  };

  // Direct Move to Draft Action for Published in table list
  const handleMoveToDraftTrigger = (ann) => {
    setSelectedAnn(ann);
    setShowConfirmMoveToDraft(true);
    setActiveDropdownId(null);
  };

  const handleMoveToDraftConfirm = async () => {
    if (!selectedAnn) return;
    setSubmitting(true);
    try {
      const payload = {
        subject: selectedAnn.subject,
        description: selectedAnn.description,
        audience: selectedAnn.audience,
        status: 'Draft'
      };
      await schoolService.updateAnnouncement(selectedAnn.id, payload);
      toast.show('success', 'Moved to Draft', 'Announcement moved to draft successfully.');
      
      // Reset confirm popup state
      setShowConfirmMoveToDraft(false);
      setSelectedAnn(null);
      
      // Refresh list immediately
      await loadAnnouncements();
    } catch (err) {
      toast.show('error', 'Error', err.message || 'Failed to move announcement to draft.');
    } finally {
      setSubmitting(false);
    }
  };

  // Trigger Delete Confirm Modal
  const handleDeleteTrigger = (ann) => {
    setSelectedAnn(ann);
    setShowConfirmDelete(true);
    setActiveDropdownId(null);
  };

  // Execute Delete
  const handleDeleteConfirm = async () => {
    if (!selectedAnn) return;
    setSubmitting(true);
    try {
      await schoolService.deleteAnnouncement(selectedAnn.id);
      toast.show('success', 'Deleted', 'Announcement deleted successfully.');
      
      // Reset confirmation
      setShowConfirmDelete(false);
      setSelectedAnn(null);
      
      // Refresh listing state instantly
      await loadAnnouncements();
    } catch (err) {
      toast.show('error', 'Error', err.message || 'Failed to delete announcement.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCloseFormModal = () => {
    setShowFormModal(false);
    setSubject('');
    setDescription('');
    if (editorRef.current) editorRef.current.innerHTML = '';
    setAudience('Both');
    setEditingId(null);
  };

  // Client-side Instant Filter Logic (Strictly teachers, students, both)
  const filteredAnnouncements = announcements.filter((ann) => {
    return ann.audience === audienceFilter;
  });

  const filterOptions = [
    { label: 'Teachers Only', value: 'Teachers' },
    { label: 'Students Only', value: 'Students' },
    { label: 'Teachers & Students', value: 'Both' }
  ];

  return (
    <div className="space-y-6 p-1 md:p-6 max-w-7xl mx-auto animate-in fade-in duration-200">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/60 pb-5">
        <div>
          <PageTitle title="Announcements" />
          <p className="text-xs text-text-secondary mt-1 font-medium">
            Publish notices, alerts, and school updates. Create drafts and manage published announcements.
          </p>
        </div>
        <Button 
          onClick={handleOpenCreateModal}
          className="font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 self-start md:self-center"
        >
          <Plus className="h-4 w-4" />
          Create Announcement
        </Button>
      </div>

      {/* Standard Select component for Audience filter dropdown */}
      <div className="w-full sm:w-[220px]">
        <Select
          value={audienceFilter}
          onChange={(e) => setAudienceFilter(e.target.value)}
          className="text-xs font-bold cursor-pointer bg-surface h-9"
        >
          {filterOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Select>
      </div>

      {/* Grid Table Layout with standard columns */}
      <Card className="shadow-xs border border-border bg-surface overflow-hidden">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center items-center py-24">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : filteredAnnouncements.length === 0 ? (
            /* Empty State Layout */
            <div className="text-center py-20 px-6 max-w-md mx-auto space-y-5 animate-in fade-in duration-300">
              <div className="mx-auto w-14 h-14 rounded-full bg-zinc-100 flex items-center justify-center text-text-muted">
                <Megaphone className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <h3 className="font-extrabold text-text-primary text-base">No Announcements Found</h3>
                <p className="text-xs text-text-secondary leading-relaxed">
                  No announcements match the selected audience filter.
                </p>
              </div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-1/2">Title</TableHead>
                  <TableHead className="w-1/4">Created</TableHead>
                  <TableHead className="w-1/6">Status</TableHead>
                  <TableHead className="w-1/12 text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAnnouncements.map((ann) => (
                  <TableRow key={ann.id}>
                    {/* Title */}
                    <TableCell className="font-bold text-text-primary">
                      {ann.subject}
                    </TableCell>

                    {/* Created/Published Dates */}
                    <TableCell className="text-text-secondary">
                      <div>
                        <span>{formatDate(ann.created_at)}</span>
                        {ann.status === 'Published' && ann.published_at && (
                          <div className="text-[10px] text-emerald-600 font-bold mt-0.5">
                            Published: {formatDate(ann.published_at)}
                          </div>
                        )}
                      </div>
                    </TableCell>

                    {/* Status */}
                    <TableCell>
                      {ann.status === 'Published' ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Published
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200">
                          Draft
                        </span>
                      )}
                    </TableCell>

                    {/* Action dropdown button */}
                    <TableCell className="text-right">
                      <div className="dropdown-container relative inline-block text-left">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveDropdownId(activeDropdownId === ann.id ? null : ann.id);
                          }}
                          className="p-1.5 rounded-lg hover:bg-zinc-100 text-text-muted hover:text-text-primary transition-all border border-border/50 bg-surface inline-flex"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </button>
                        
                        {activeDropdownId === ann.id && (
                          <div className="absolute right-0 top-full mt-1.5 w-36 bg-surface border border-border shadow-lg rounded-xl py-1 z-20 animate-in fade-in slide-in-from-top-1 duration-100 text-left">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedAnn(ann);
                                setShowViewModal(true);
                                setActiveDropdownId(null);
                              }}
                              className="w-full text-left px-4 py-2 text-xs text-text-primary hover:bg-zinc-50 flex items-center gap-2 font-bold uppercase tracking-wider"
                            >
                              <Eye className="h-3.5 w-3.5 text-zinc-500" />
                              View
                            </button>
                            
                            <button
                              type="button"
                              onClick={() => handleEdit(ann)}
                              className="w-full text-left px-4 py-2 text-xs text-text-primary hover:bg-zinc-50 flex items-center gap-2 font-bold uppercase tracking-wider"
                            >
                              <Edit className="h-3.5 w-3.5 text-blue-600" />
                              Edit
                            </button>

                            {ann.status === 'Draft' ? (
                              <button
                                type="button"
                                onClick={() => handleDirectPublish(ann)}
                                className="w-full text-left px-4 py-2 text-xs text-text-primary hover:bg-zinc-50 flex items-center gap-2 font-bold uppercase tracking-wider"
                              >
                                <Check className="h-3.5 w-3.5 text-emerald-600" />
                                Publish
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleMoveToDraftTrigger(ann)}
                                className="w-full text-left px-4 py-2 text-xs text-text-primary hover:bg-zinc-50 flex items-center gap-2 font-bold uppercase tracking-wider"
                              >
                                <FileText className="h-3.5 w-3.5 text-amber-600" />
                                Move to Draft
                              </button>
                            )}
                            
                            <button
                              type="button"
                              onClick={() => handleDeleteTrigger(ann)}
                              className="w-full text-left px-4 py-2 text-xs text-destructive hover:bg-zinc-50 flex items-center gap-2 font-bold uppercase tracking-wider"
                            >
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Creation/Edit Modal */}
      <Dialog
        isOpen={showFormModal}
        onClose={handleCloseFormModal}
        title={editingId ? 'Edit Announcement' : 'Create Announcement'}
        className="max-w-2xl w-full"
      >
        <div className="p-6 space-y-5">
          {/* Subject */}
          <div className="space-y-2">
            <label className="block text-[10px] font-black text-text-secondary uppercase tracking-wider">
              Subject <span className="text-destructive">*</span>
            </label>
            <Input
              placeholder="e.g. School Reopens from 15 July"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              maxLength={100}
              className="w-full text-sm"
              disabled={submitting}
            />
          </div>

          {/* Description Editor */}
          <div className="space-y-2">
            <label className="block text-[10px] font-black text-text-secondary uppercase tracking-wider">
              Description <span className="text-destructive">*</span>
            </label>
            
            <div className="border border-border rounded-lg overflow-hidden flex flex-col bg-surface">
              {/* Rich text actions */}
              <div className="flex items-center gap-1 bg-zinc-50 border-b border-border p-1.5">
                <button 
                  type="button" 
                  title="Bold" 
                  onClick={() => execCmd('bold')}
                  className="p-1.5 rounded hover:bg-zinc-200 text-text-primary transition-colors"
                >
                  <Bold className="h-3.5 w-3.5" />
                </button>
                <button 
                  type="button" 
                  title="Italic" 
                  onClick={() => execCmd('italic')}
                  className="p-1.5 rounded hover:bg-zinc-200 text-text-primary transition-colors"
                >
                  <Italic className="h-3.5 w-3.5" />
                </button>
                <button 
                  type="button" 
                  title="Underline" 
                  onClick={() => execCmd('underline')}
                  className="p-1.5 rounded hover:bg-zinc-200 text-text-primary transition-colors"
                >
                  <Underline className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Editor Content Area */}
              <div
                ref={editorRef}
                contentEditable
                onInput={handleEditorInput}
                onKeyDown={handleEditorKeyDown}
                className="p-3 min-h-[140px] focus:outline-hidden text-sm overflow-y-auto max-h-60"
                style={{ outline: 'none' }}
                disabled={submitting}
              />
            </div>
          </div>

          {/* Audience selection */}
          <div className="space-y-2">
            <label className="block text-[10px] font-black text-text-secondary uppercase tracking-wider">
              Audience <span className="text-destructive">*</span>
            </label>
            <div className="flex flex-col sm:flex-row gap-4 pt-1">
              <label className="flex items-center gap-2 text-xs text-text-primary cursor-pointer font-semibold">
                <input 
                  type="radio" 
                  name="audience" 
                  value="Teachers" 
                  checked={audience === 'Teachers'} 
                  onChange={() => setAudience('Teachers')}
                  disabled={submitting}
                  className="h-4 w-4 text-primary focus:ring-primary border-gray-300"
                />
                <span>For Teachers Only</span>
              </label>

              <label className="flex items-center gap-2 text-xs text-text-primary cursor-pointer font-semibold">
                <input 
                  type="radio" 
                  name="audience" 
                  value="Students" 
                  checked={audience === 'Students'} 
                  onChange={() => setAudience('Students')}
                  disabled={submitting}
                  className="h-4 w-4 text-primary focus:ring-primary border-gray-300"
                />
                <span>For Students Only</span>
              </label>

              <label className="flex items-center gap-2 text-xs text-text-primary cursor-pointer font-semibold">
                <input 
                  type="radio" 
                  name="audience" 
                  value="Both" 
                  checked={audience === 'Both'} 
                  onChange={() => setAudience('Both')}
                  disabled={submitting}
                  className="h-4 w-4 text-primary focus:ring-primary border-gray-300"
                />
                <span>For Teachers & Students</span>
              </label>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex justify-end gap-2 pt-4 border-t border-border mt-6">
            <Button 
              type="button" 
              variant="outline"
              className="font-bold text-xs uppercase tracking-wider" 
              onClick={handleCloseFormModal}
              disabled={submitting}
            >
              Cancel
            </Button>
            
            <Button 
              type="button" 
              variant="outline"
              className="font-bold text-xs uppercase tracking-wider" 
              onClick={() => handlePreSave('Draft')}
              disabled={submitting || !subject.trim() || !description.trim()}
            >
              Create as Draft
            </Button>

            <Button 
              type="button" 
              className="font-bold text-xs uppercase tracking-wider bg-black hover:bg-black/95 text-white border-0" 
              onClick={() => handlePreSave('Published')}
              disabled={submitting || !subject.trim() || !description.trim()}
            >
              Publish
            </Button>
          </div>
        </div>
      </Dialog>

      {/* View Read-Only Dialog */}
      <Dialog
        isOpen={showViewModal}
        onClose={() => {
          setShowViewModal(false);
          setSelectedAnn(null);
        }}
        title="View Announcement"
        className="max-w-xl w-full"
      >
        {selectedAnn && (
          <div className="p-6 space-y-6">
            {/* Subject Title */}
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Subject</span>
              <h3 className="text-base font-extrabold text-text-primary leading-snug">
                {selectedAnn.subject}
              </h3>
            </div>

            {/* Meta row: Status & Audience */}
            <div className="grid grid-cols-2 gap-4 border-y border-border/60 py-3">
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block">Status</span>
                {selectedAnn.status === 'Published' ? (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Published
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200">
                    Draft
                  </span>
                )}
              </div>

              <div className="space-y-1">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block">Audience</span>
                <span className="text-xs font-bold text-text-primary">
                  {formatAudience(selectedAnn.audience)}
                </span>
              </div>
            </div>

            {/* Created & Published Dates */}
            <div className="grid grid-cols-2 gap-4 border-b border-border/60 pb-4">
              <div className="space-y-0.5">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block">Created Date</span>
                <span className="text-xs font-semibold text-text-secondary whitespace-nowrap">
                  {formatDate(selectedAnn.created_at)}
                </span>
              </div>

              <div className="space-y-0.5">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block">Published Date</span>
                <span className="text-xs font-semibold text-text-secondary whitespace-nowrap">
                  {selectedAnn.status === 'Published' ? formatDate(selectedAnn.published_at) : '—'}
                </span>
              </div>
            </div>

            {/* Description Content */}
            <div className="space-y-2">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Message Content</span>
              <div 
                className="text-sm text-text-secondary leading-relaxed bg-zinc-50 border border-border/60 rounded-xl p-4 min-h-[100px] max-h-[250px] overflow-y-auto rich-render-wrapper"
                dangerouslySetInnerHTML={{ __html: selectedAnn.description }}
              />
            </div>

            {/* Close Button */}
            <div className="flex justify-end pt-4 border-t border-border/60">
              <Button
                variant="outline"
                size="sm"
                className="font-bold text-xs uppercase tracking-wider w-full sm:w-auto"
                onClick={() => {
                  setShowViewModal(false);
                  setSelectedAnn(null);
                }}
              >
                Close
              </Button>
            </div>
          </div>
        )}
      </Dialog>

      {/* Confirmation Dialog: Publish */}
      <Dialog
        isOpen={showConfirmPublish}
        onClose={() => setShowConfirmPublish(false)}
      >
        <div className="p-6 max-w-sm mx-auto">
          <div className="flex items-center gap-3 text-amber-500 mb-3">
            <AlertCircle className="h-6 w-6" />
            <h3 className="text-base font-bold text-text-primary">Publish Announcement?</h3>
          </div>
          <p className="text-xs text-text-secondary leading-relaxed mb-6">
            The announcement will immediately become visible in the mobile application. Push notifications will be sent to the selected audience.
          </p>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              className="text-xxs font-bold uppercase tracking-wider"
              onClick={() => setShowConfirmPublish(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="text-xxs font-bold uppercase tracking-wider bg-black hover:bg-black/90 text-white"
              onClick={() => handleSaveAnnouncement('Published')}
              disabled={submitting}
            >
              Publish
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Confirmation Dialog: Move to Draft */}
      <Dialog
        isOpen={showConfirmMoveToDraft}
        onClose={() => setShowConfirmMoveToDraft(false)}
      >
        <div className="p-6 max-w-sm mx-auto">
          <div className="flex items-center gap-3 text-amber-500 mb-3">
            <AlertCircle className="h-6 w-6" />
            <h3 className="text-base font-bold text-text-primary">Move Announcement to Draft?</h3>
          </div>
          <p className="text-xs text-text-secondary leading-relaxed mb-6">
            The announcement will no longer be visible in the mobile application.
          </p>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              className="text-xxs font-bold uppercase tracking-wider"
              onClick={() => setShowConfirmMoveToDraft(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="text-xxs font-bold uppercase tracking-wider bg-black hover:bg-black/90 text-white"
              onClick={handleMoveToDraftConfirm}
              disabled={submitting}
            >
              Move to Draft
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Confirmation Dialog: Delete */}
      <Dialog
        isOpen={showConfirmDelete}
        onClose={() => setShowConfirmDelete(false)}
      >
        <div className="p-6 max-w-sm mx-auto">
          <div className="flex items-center gap-3 text-destructive mb-3">
            <AlertCircle className="h-6 w-6" />
            <h3 className="text-base font-bold text-text-primary">Delete Announcement?</h3>
          </div>
          <p className="text-xs text-text-secondary leading-relaxed mb-6">
            This action cannot be undone.
          </p>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              className="text-xxs font-bold uppercase tracking-wider"
              onClick={() => setShowConfirmDelete(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              className="text-xxs font-bold uppercase tracking-wider bg-destructive hover:bg-destructive/90 text-white"
              onClick={handleDeleteConfirm}
              disabled={submitting}
            >
              Delete
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
