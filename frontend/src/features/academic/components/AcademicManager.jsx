import React, { useState } from 'react';
import { Plus, X, Award, Edit, Trash2, ShieldAlert } from 'lucide-react';

export default function AcademicManager({
  token,
  years,
  classrooms,
  teachers,
  students,
  activeYearId,
  fetchERPData,
  showToast
}) {
  const [showCreateYearModal, setShowCreateYearModal] = useState(false);
  const [newYearForm, setNewYearForm] = useState({
    year_range: '',
    start_date: '',
    end_date: '',
    description: ''
  });
  
  // Year transition wizard
  const [showTransitionWizard, setShowTransitionWizard] = useState(false);
  const [wizardTargetYear, setWizardTargetYear] = useState(null);
  const [transitionWizardStep, setTransitionWizardStep] = useState(1);
  const [wizardClassMappings, setWizardClassMappings] = useState({});
  const [wizardStudentStatus, setWizardStudentStatus] = useState({});
  const [wizardConfirmText, setWizardConfirmText] = useState('');
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Classroom States
  const [showClassModal, setShowClassModal] = useState(false);
  const [classForm, setClassForm] = useState({ id: null, name: '', room: '', class_teacher_id: '' });

  const getHeaders = () => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  });

  const handleCreateYearSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/academic-years', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(newYearForm)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to add academic year");
      showToast("Academic Year created successfully!", "success");
      setShowCreateYearModal(false);
      setNewYearForm({ year_range: '', start_date: '', end_date: '', description: '' });
      if (fetchERPData) fetchERPData();
    } catch (err) {
      showToast(err.message, "error");
    }
  };

  const handleArchiveYear = async (id) => {
    if (!confirm("Are you sure you want to archive this academic year session? Historical records will be locked.")) return;
    try {
      const res = await fetch(`/api/academic-years/${id}/archive`, {
        method: 'PUT',
        headers: getHeaders()
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to archive year");
      showToast("Academic Year archived successfully", "success");
      if (fetchERPData) fetchERPData();
    } catch (err) {
      showToast(err.message, "error");
    }
  };

  const startTransitionWizard = (y) => {
    setWizardTargetYear(y);
    setTransitionWizardStep(1);
    
    // Initial class mappings
    const mappings = {};
    classrooms.forEach(c => {
      mappings[c.id] = '';
    });
    setWizardClassMappings(mappings);

    // Initial student promo status mapping
    const statuses = {};
    students.forEach(s => {
      if (s.status === 'Active') {
        statuses[s.id] = 'promote';
      }
    });
    setWizardStudentStatus(statuses);
    setWizardConfirmText('');
    setShowTransitionWizard(true);
  };

  const handleTransitionSubmit = async () => {
    if (wizardConfirmText !== 'ACTIVATE SESSION') {
      alert("Please type the confirmation text to proceed.");
      return;
    }
    setIsTransitioning(true);
    try {
      const res = await fetch(`/api/academic-years/${wizardTargetYear.id}/activate`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          class_mappings: wizardClassMappings,
          student_status: wizardStudentStatus
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Transition failed");
      showToast(data.message || "New session activated successfully!", "success");
      setShowTransitionWizard(false);
      if (fetchERPData) fetchERPData();
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setIsTransitioning(false);
    }
  };

  // Classroom Handlers
  const handleSaveClassroom = async (e) => {
    e.preventDefault();
    const isEdit = classForm.id !== null;
    const url = isEdit ? `/api/classes/${classForm.id}` : '/api/classes';
    const method = isEdit ? 'PUT' : 'POST';
    try {
      const res = await fetch(url, {
        method,
        headers: getHeaders(),
        body: JSON.stringify(classForm)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to save classroom");
      showToast(data.message || "Classroom saved successfully", "success");
      setShowClassModal(false);
      if (fetchERPData) fetchERPData();
    } catch (err) {
      showToast(err.message, "error");
    }
  };

  const handleDeleteClassroom = async (id) => {
    if (!confirm("Are you sure you want to delete this classroom? All student mappings will be cleared.")) return;
    try {
      const res = await fetch(`/api/classes/${id}`, {
        method: 'DELETE',
        headers: getHeaders()
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to delete class");
      showToast("Classroom deleted successfully", "success");
      if (fetchERPData) fetchERPData();
    } catch (err) {
      showToast(err.message, "error");
    }
  };

  const handleClassTeacherAssign = async (classId, teacherId) => {
    try {
      const res = await fetch('/api/class-teacher', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ class_id: classId, teacher_id: teacherId })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to assign teacher");
      showToast("Class Teacher assignment updated successfully", "success");
      if (fetchERPData) fetchERPData();
    } catch (err) {
      showToast(err.message, "error");
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* 1. Academic Sessions Manager */}
      <div className="sp-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h4 style={{ fontSize: '1.1rem', margin: 0, fontWeight: 700 }}>Academic Sessions Manager</h4>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '4px' }}>
              Configure, activate, and archive school academic sessions.
            </p>
          </div>
          <button onClick={() => setShowCreateYearModal(true)} className="btn-primary">
            <Plus size={16} /> Create Academic Year
          </button>
        </div>

        <div className="sp-table-container">
          <table className="sp-table">
            <thead>
              <tr>
                <th>Session Range</th>
                <th>Start Date</th>
                <th>End Date</th>
                <th>Description</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {years.map((y, idx) => (
                <tr key={y.id || idx}>
                  <td style={{ fontWeight: 'bold' }}>{y.year_range}</td>
                  <td>{y.start_date || 'N/A'}</td>
                  <td>{y.end_date || 'N/A'}</td>
                  <td>{y.description || 'No description'}</td>
                  <td>
                    <span className={`badge ${y.status === 'Active' ? 'badge-success' : y.status === 'Archived' ? 'badge-secondary' : 'badge-warning'}`}>
                      {y.status}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {y.status === 'Draft' && (
                      <button onClick={() => startTransitionWizard(y)} className="btn-primary" style={{ padding: '4px 10px', fontSize: '0.8rem' }}>
                        Activate Session
                      </button>
                    )}
                    {y.status === 'Active' && (
                      <button onClick={() => handleArchiveYear(y.id)} className="btn-outline" style={{ padding: '4px 10px', fontSize: '0.8rem', color: '#ef4444', borderColor: '#ef4444' }}>
                        Archive Session
                      </button>
                    )}
                    {y.status === 'Archived' && (
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontStyle: 'italic' }}>Historical</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 2. Classroom Master Directory */}
      <div className="sp-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h4 style={{ fontSize: '1.1rem', margin: 0, fontWeight: 700 }}>Classrooms Directory</h4>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '4px' }}>
              Create standard classroom grades and sections, and allocate class teachers.
            </p>
          </div>
          <button onClick={() => { setClassForm({ id: null, name: '', room: '', class_teacher_id: '' }); setShowClassModal(true); }} className="btn-primary">
            <Plus size={16} /> Create Classroom
          </button>
        </div>

        <div className="sp-table-container">
          <table className="sp-table">
            <thead>
              <tr>
                <th>Classroom Name</th>
                <th>Physical Room Room</th>
                <th>Class Teacher Name</th>
                <th>Allocated Class Teacher Contact</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {classrooms.map((c) => (
                <tr key={c.id}>
                  <td style={{ fontWeight: 'bold' }}>{c.name}</td>
                  <td>{c.room || '-'}</td>
                  <td>
                    <select
                      className="sp-input"
                      style={{ padding: '4px 8px', fontSize: '0.85rem', width: '200px' }}
                      value={c.class_teacher_id || ''}
                      onChange={(e) => handleClassTeacherAssign(c.id, e.target.value || null)}
                    >
                      <option value="">No Class Teacher Assigned</option>
                      {teachers.filter(t => t.status === 'Active').map(t => (
                        <option key={t.id} value={t.id}>{t.name} ({t.subject})</option>
                      ))}
                    </select>
                  </td>
                  <td>{c.class_teacher_contact || '-'}</td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                      <button 
                        onClick={() => { setClassForm({ id: c.id, name: c.name, room: c.room, class_teacher_id: c.class_teacher_id || '' }); setShowClassModal(true); }} 
                        className="btn-outline" 
                        style={{ padding: '4px 8px' }}
                      >
                        <Edit size={14} />
                      </button>
                      <button onClick={() => handleDeleteClassroom(c.id)} className="btn-outline" style={{ padding: '4px 8px', color: '#ef4444', borderColor: '#fca5a5' }}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Year Modal */}
      {showCreateYearModal && (
        <div className="modal-overlay" onClick={() => setShowCreateYearModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Create Academic Session</h3>
              <button onClick={() => setShowCreateYearModal(false)} style={{ background: 'transparent', border: 'none' }}><X size={20} /></button>
            </div>
            <form onSubmit={handleCreateYearSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label className="form-label">Session year range</label>
                <input type="text" className="sp-input" placeholder="e.g. 2026-2027" value={newYearForm.year_range} onChange={(e) => setNewYearForm({ ...newYearForm, year_range: e.target.value })} required />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div>
                  <label className="form-label">Start Date</label>
                  <input type="date" className="sp-input" value={newYearForm.start_date} onChange={(e) => setNewYearForm({ ...newYearForm, start_date: e.target.value })} />
                </div>
                <div>
                  <label className="form-label">End Date</label>
                  <input type="date" className="sp-input" value={newYearForm.end_date} onChange={(e) => setNewYearForm({ ...newYearForm, end_date: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="form-label">Description</label>
                <input type="text" className="sp-input" value={newYearForm.description} onChange={(e) => setNewYearForm({ ...newYearForm, description: e.target.value })} />
              </div>
              <button type="submit" className="btn-primary" style={{ justifyContent: 'center' }}>Save Session Draft</button>
            </form>
          </div>
        </div>
      )}

      {/* Classroom Modal */}
      {showClassModal && (
        <div className="modal-overlay" onClick={() => setShowClassModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>{classForm.id ? 'Edit' : 'Create'} Classroom</h3>
              <button onClick={() => setShowClassModal(false)} style={{ background: 'transparent', border: 'none' }}><X size={20} /></button>
            </div>
            <form onSubmit={handleSaveClassroom} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label className="form-label">Classroom Name</label>
                <input type="text" className="sp-input" placeholder="e.g. Grade 5-A" value={classForm.name} onChange={(e) => setClassForm({ ...classForm, name: e.target.value })} required />
              </div>
              <div>
                <label className="form-label">Physical Room number</label>
                <input type="text" className="sp-input" placeholder="e.g. Room 302" value={classForm.room} onChange={(e) => setClassForm({ ...classForm, room: e.target.value })} />
              </div>
              <button type="submit" className="btn-primary" style={{ justifyContent: 'center' }}>Save Classroom</button>
            </form>
          </div>
        </div>
      )}

      {/* Transition Wizard Modal */}
      {showTransitionWizard && (
        <div className="modal-overlay" onClick={() => !isTransitioning && setShowTransitionWizard(false)}>
          <div className="modal-content" style={{ maxWidth: '800px', width: '90%' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Year Transition & Promotion Wizard</h3>
              <button onClick={() => !isTransitioning && setShowTransitionWizard(false)} style={{ background: 'transparent', border: 'none' }}><X size={20} /></button>
            </div>

            <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
              <span className={`badge ${transitionWizardStep === 1 ? 'badge-primary' : 'badge-secondary'}`}>1. Class Mappings</span>
              <span className={`badge ${transitionWizardStep === 2 ? 'badge-primary' : 'badge-secondary'}`}>2. Student Promotion</span>
              <span className={`badge ${transitionWizardStep === 3 ? 'badge-primary' : 'badge-secondary'}`}>3. Confirmation</span>
            </div>

            {/* Step 1: Class Mappings */}
            {transitionWizardStep === 1 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <p style={{ fontSize: '0.85rem' }}>Map previous session classes to destination classes in the upcoming session.</p>
                <div style={{ maxHeight: '40vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {classrooms.map(c => (
                    <div key={c.id} style={{ display: 'grid', gridTemplateColumns: '1fr 50px 1fr', alignItems: 'center', gap: '12px' }}>
                      <span style={{ fontWeight: 600 }}>{c.name}</span>
                      <span style={{ textAlign: 'center', color: 'var(--text-muted)' }}>→</span>
                      <select
                        className="sp-input"
                        value={wizardClassMappings[c.id] || ''}
                        onChange={(e) => setWizardClassMappings({ ...wizardClassMappings, [c.id]: e.target.value })}
                      >
                        <option value="">Select Destination</option>
                        {classrooms.map(dest => (
                          <option key={dest.id} value={dest.id}>{dest.name}</option>
                        ))}
                        <option value="Alumni">Graduate to Alumni</option>
                      </select>
                    </div>
                  ))}
                </div>
                <button onClick={() => setTransitionWizardStep(2)} className="btn-primary" style={{ alignSelf: 'flex-end' }}>Next Step</button>
              </div>
            )}

            {/* Step 2: Student promotions */}
            {transitionWizardStep === 2 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <p style={{ fontSize: '0.85rem' }}>Review student promotion choices. Uncheck to repeat the year or graduate early.</p>
                <div style={{ maxHeight: '40vh', overflowY: 'auto' }}>
                  <table className="sp-table">
                    <thead>
                      <tr>
                        <th>Student Name</th>
                        <th>Class</th>
                        <th>Promotion status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {students.filter(s => s.status === 'Active').map(s => (
                        <tr key={s.id}>
                          <td>{s.name}</td>
                          <td>{classrooms.find(c => c.id === s.class_id)?.name || 'Unknown'}</td>
                          <td>
                            <select
                              className="sp-input"
                              style={{ padding: '4px', fontSize: '0.85rem' }}
                              value={wizardStudentStatus[s.id] || 'promote'}
                              onChange={(e) => setWizardStudentStatus({ ...wizardStudentStatus, [s.id]: e.target.value })}
                            >
                              <option value="promote">Promote</option>
                              <option value="repeat">Repeat Grade</option>
                              <option value="graduate">Graduate (Alumni)</option>
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px' }}>
                  <button onClick={() => setTransitionWizardStep(1)} className="btn-outline">Back</button>
                  <button onClick={() => setTransitionWizardStep(3)} className="btn-primary">Next Step</button>
                </div>
              </div>
            )}

            {/* Step 3: Confirmation */}
            {transitionWizardStep === 3 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', gap: '12px', background: 'rgba(245, 158, 11, 0.1)', padding: '16px', borderRadius: 'var(--radius)', border: '1px solid #f59e0b', color: '#d97706' }}>
                  <ShieldAlert size={24} />
                  <div>
                    <h5 style={{ margin: 0, fontWeight: 700 }}>Critical Actions Confirmation</h5>
                    <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem' }}>
                      Activating session range <b>{wizardTargetYear?.year_range}</b> will archive the current active session. This operation promotes selected students, recovers unpaid dues, and generates new fee registers.
                    </p>
                  </div>
                </div>
                <div>
                  <label className="form-label">Type <b>ACTIVATE SESSION</b> to confirm</label>
                  <input type="text" className="sp-input" value={wizardConfirmText} onChange={(e) => setWizardConfirmText(e.target.value)} placeholder="Type confirmation phrase..." />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px' }}>
                  <button onClick={() => setTransitionWizardStep(2)} className="btn-outline" disabled={isTransitioning}>Back</button>
                  <button onClick={handleTransitionSubmit} className="btn-primary" disabled={isTransitioning || wizardConfirmText !== 'ACTIVATE SESSION'}>
                    {isTransitioning ? 'Activating Session...' : 'Execute Year Transition'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
