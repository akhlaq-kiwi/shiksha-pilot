import React, { useState, useEffect } from 'react';
import { Plus, X, Pencil, Trash2, ShieldCheck, HelpCircle } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../../../common/ui/card';
import { Button } from '../../../common/ui/button';
import { Input } from '../../../common/ui/input';
import { Select } from '../../../common/ui/select';
import { platformService } from '../../../common/services/platformService';
import { useToast } from '../../../common/components/Toast';
import { useConfirm } from '../../../common/components/ConfirmDialog';

function PlanDialog({ plan, onClose, onSaved }) {
  const toast = useToast();
  const isEdit = !!plan?.id;

  const [form, setForm] = useState({
    name:          plan?.name          ?? '',
    price:         plan?.price         != null ? String(plan.price) : '',
    student_limit: plan?.student_limit != null ? String(plan.student_limit) : '',
    description:   plan?.description   ?? '',
    duration_value: plan?.duration_value != null ? String(plan.duration_value) : '12',
    duration_unit:  plan?.duration_unit  ?? 'month',
    is_active:      plan?.is_active      != null ? String(plan.is_active) : '1',
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name:          form.name.trim(),
        price:         parseInt(form.price, 10) || 0,
        student_limit: form.student_limit !== '' ? parseInt(form.student_limit, 10) : null,
        description:   form.description.trim() || null,
        duration_value: parseInt(form.duration_value, 10) || 12,
        duration_unit:  form.duration_unit,
        is_active:      parseInt(form.is_active, 10),
        type:          plan?.type ?? 'custom',
      };

      const result = isEdit
        ? await platformService.updatePlan(plan.id, payload)
        : await platformService.createPlan(payload);

      onSaved(result, isEdit);
      toast.success(`Plan "${result.name}" ${isEdit ? 'updated' : 'created'}.`, isEdit ? 'Plan Updated' : 'Plan Created');
      onClose();
    } catch (err) {
      toast.error(err.message || 'Failed to save plan.', 'Error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-surface border border-border rounded-2xl shadow-2xl w-full max-w-md p-6 animate-in zoom-in-95 fade-in duration-200">
        <div className="flex items-center justify-between mb-5 border-b border-border/60 pb-3">
          <div>
            <h3 className="text-base font-bold text-text-primary">{isEdit ? `Configure ${plan.name} Plan` : 'Create New Plan'}</h3>
            <p className="text-xs text-text-muted mt-0.5">Define student limits, pricing, and duration</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 text-text-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-text-secondary uppercase">Plan Name</label>
            <Input
              placeholder="e.g. Starter, Professional, Unlimited"
              value={form.name}
              onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              required
              disabled={isEdit && plan?.type === 'standard'}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-secondary uppercase">Amount (₹)</label>
              <Input
                type="number"
                min="0"
                placeholder="0 = Free Plan"
                value={form.price}
                onChange={e => setForm(p => ({ ...p, price: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-secondary uppercase">Student Limit</label>
              <Input
                type="number"
                min="0"
                placeholder="Blank = Unlimited"
                value={form.student_limit}
                onChange={e => setForm(p => ({ ...p, student_limit: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-secondary uppercase">Duration Value</label>
              <Select
                value={form.duration_value}
                onChange={e => setForm(p => ({ ...p, duration_value: e.target.value }))}
              >
                {form.duration_unit === 'month' ? (
                  <>
                    <option value="3">3 Months</option>
                    <option value="6">6 Months</option>
                    <option value="9">9 Months</option>
                    <option value="12">12 Months</option>
                  </>
                ) : (
                  <>
                    <option value="1">1 Year</option>
                    <option value="2">2 Years</option>
                    <option value="3">3 Years</option>
                    <option value="4">4 Years</option>
                    <option value="5">5 Years</option>
                  </>
                )}
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-secondary uppercase">Duration Unit</label>
              <Select
                value={form.duration_unit}
                onChange={e => {
                  const unit = e.target.value;
                  const defaultVal = unit === 'month' ? '12' : '1';
                  setForm(p => ({ ...p, duration_unit: unit, duration_value: defaultVal }));
                }}
              >
                <option value="month">Monthly Cycle</option>
                <option value="year">Yearly Cycle</option>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-text-secondary uppercase">Status</label>
            <Select
              value={form.is_active}
              onChange={e => setForm(p => ({ ...p, is_active: e.target.value }))}
            >
              <option value="1">Active</option>
              <option value="0">Inactive</option>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-text-secondary uppercase">Description</label>
            <textarea
              rows={3}
              value={form.description}
              onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
              placeholder="Features and standard services included in this tier"
              className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
              required
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
            <Button type="submit" className="flex-1" disabled={saving}>
              {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Plan'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function PlansPage() {
  const toast = useToast();
  const confirm = useConfirm();
  const [plans, setPlans] = useState([]);
  const [configuringPlan, setConfiguringPlan] = useState(null);
  const [showNewPlan, setShowNewPlan] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('ALL'); // 'ALL', 'ACTIVE', 'INACTIVE'

  useEffect(() => {
    loadPlans();
  }, []);

  const loadPlans = async () => {
    setLoading(true);
    try {
      const data = await platformService.getPlans();
      setPlans(Array.isArray(data) ? data : []);
    } catch {}
    setLoading(false);
  };

  const handleSaved = () => {
    loadPlans();
  };

  const handleDelete = async (id, name) => {
    const ok = await confirm({
      title: 'Delete Plan?',
      message: `Are you sure you want to permanently delete plan "${name}"? Existing schools on this plan will not be modified automatically but new schools won't be able to select it.`,
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;

    try {
      await platformService.deletePlan(id);
      toast.success(`Plan "${name}" deleted successfully.`);
      loadPlans();
    } catch (err) {
      toast.error(err.message || 'Failed to delete plan.');
    }
  };

  const filteredPlans = plans.filter(p => {
    if (filter === 'ACTIVE') return p.is_active === 1 || p.is_active === '1' || p.is_active === true;
    if (filter === 'INACTIVE') return p.is_active === 0 || p.is_active === '0' || p.is_active === false;
    return true;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-border/60 pb-6">
        <div>
          <h2 className="text-3xl font-bold text-text-primary tracking-tight font-display">Manage Plans</h2>
          <p className="text-text-secondary text-sm mt-1">Configure subscription pricing tiers, student limits, and durations.</p>
        </div>
        <Button className="flex items-center gap-2 justify-center" onClick={() => setShowNewPlan(true)}>
          <Plus className="h-4 w-4" /> New Plan
        </Button>
      </div>

      {/* Filter Tabs */}
      <div className="flex border-b border-border/60 gap-4">
        {['ALL', 'ACTIVE', 'INACTIVE'].map((t) => (
          <button
            key={t}
            onClick={() => setFilter(t)}
            className={`px-4 py-2 text-xs font-bold transition-all relative border-b-2 -mb-[2px] ${
              filter === t
                ? 'border-primary text-primary font-bold'
                : 'border-transparent text-text-muted hover:text-text-primary'
            }`}
          >
            {t === 'ALL' ? 'All Plans' : t === 'ACTIVE' ? 'Active' : 'Inactive'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-12 text-center text-sm text-text-muted">Loading plans…</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPlans.length === 0 ? (
            <div className="col-span-full py-16 text-center text-text-muted text-sm border-2 border-dashed border-border rounded-2xl bg-surface/50 font-bold">
              {filter === 'ALL' 
                ? 'No subscription plans configured. Click "New Plan" to get started.'
                : filter === 'ACTIVE' 
                  ? 'No active subscription plans found.' 
                  : 'No inactive subscription plans found.'
              }
            </div>
          ) : (
            filteredPlans.map(p => (
              <Card
                key={p.id}
                className={`relative overflow-hidden border border-border bg-surface shadow-sm rounded-2xl flex flex-col justify-between h-[320px] transition-all hover:shadow-md ${p.is_active === 0 || p.is_active === '0' || p.is_active === false ? 'opacity-65 bg-zinc-50/50 dark:bg-zinc-900/10' : ''}`}
              >
                <div className="p-6 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex items-start justify-between">
                      <h3 className="text-lg font-bold text-text-primary truncate">{p.name}</h3>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase ${p.is_active === 1 || p.is_active === '1' || p.is_active === true ? 'bg-green-500/10 text-green-600 border border-green-500/20' : 'bg-zinc-100 dark:bg-zinc-800 text-text-muted border border-zinc-200 dark:border-zinc-700'}`}>
                        {p.is_active === 1 || p.is_active === '1' || p.is_active === true ? 'Active' : 'Inactive'}
                      </span>
                    </div>

                    <div className="mt-3 flex items-baseline gap-0.5">
                      <span className="text-3xl font-bold text-text-primary">
                        {p.price > 0 ? `₹${Number(p.price).toLocaleString()}` : 'Free'}
                      </span>
                      {p.price > 0 && (
                        <span className="text-xs text-text-muted">
                          /{p.duration_value} {p.duration_unit}{p.duration_value > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>

                    <div className="mt-4 text-xs text-text-secondary border-t border-border/50 pt-3 space-y-1.5 font-semibold">
                      <div>
                        Student Limit:{' '}
                        <span className="text-text-primary font-bold">
                          {p.student_limit ? Number(p.student_limit).toLocaleString() : 'Unlimited'}
                        </span>
                      </div>
                      <div>
                        Duration:{' '}
                        <span className="text-text-primary font-bold">
                          {p.duration_value} {p.duration_unit === 'month' ? 'Month' : 'Year'}{p.duration_value > 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>

                    <p className="mt-4 text-xs text-text-muted line-clamp-3 leading-relaxed font-semibold">
                      {p.description || 'No plan description provided.'}
                    </p>
                  </div>

                  <div className="flex gap-2.5 mt-6 border-t border-border/50 pt-4">
                    <Button
                      variant="outline"
                      className="flex-1 text-xs py-1.5 flex items-center justify-center gap-1.5 font-bold"
                      onClick={() => setConfiguringPlan(p)}
                    >
                      <Pencil className="h-3.5 w-3.5" /> Edit
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1 text-xs py-1.5 flex items-center justify-center gap-1.5 text-red-600 hover:bg-red-500/5 hover:text-red-700 border-red-200 dark:border-red-950 font-bold"
                      onClick={() => handleDelete(p.id, p.name)}
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Delete
                    </Button>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      {configuringPlan && (
        <PlanDialog
          plan={configuringPlan}
          onClose={() => setConfiguringPlan(null)}
          onSaved={handleSaved}
        />
      )}

      {showNewPlan && (
        <PlanDialog
          plan={null}
          onClose={() => setShowNewPlan(false)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
