import React, { useState, useEffect } from 'react';
import { X, Plus } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../../../common/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '../../../common/ui/table';
import { Button } from '../../../common/ui/button';
import { Input } from '../../../common/ui/input';
import { platformService } from '../../../common/services/platformService';
import { useToast } from '../../../common/components/Toast';

function PlanDialog({ plan, onClose, onSaved }) {
  const toast = useToast();
  const isEdit = !!plan?.id;
  const [form, setForm] = useState({
    name:          plan?.name          ?? '',
    price:         plan?.price         != null ? String(plan.price) : '',
    student_limit: plan?.student_limit != null ? String(plan.student_limit) : '',
    description:   plan?.description   ?? '',
  });
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name:          form.name,
        price:         parseInt(form.price, 10) || 0,
        student_limit: form.student_limit !== '' ? parseInt(form.student_limit, 10) : null,
        description:   form.description || null,
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
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-base font-bold text-text-primary">{isEdit ? `Configure ${plan.name} Plan` : 'Create New Plan'}</h3>
            <p className="text-xs text-text-muted mt-0.5">Adjust pricing, limits, and description</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 text-text-muted">
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-text-secondary uppercase">Plan Name</label>
            <Input placeholder="e.g. District Pro" value={form.name} onChange={set('name')} required disabled={isEdit && plan?.type === 'standard'} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-secondary uppercase">Monthly Price (₹)</label>
              <Input type="number" min="0" value={form.price} onChange={set('price')} required />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-secondary uppercase">Student Limit</label>
              <Input type="number" min="0" placeholder="Blank = unlimited" value={form.student_limit} onChange={set('student_limit')} />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-text-secondary uppercase">Description</label>
            <textarea
              rows={2}
              value={form.description}
              onChange={set('description')}
              placeholder="Brief description of what's included"
              className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
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

const PLAN_PRICE_MAP = (plans) => Object.fromEntries(plans.map(p => [p.name, p.price]));

const TYPE_BADGE = {
  standard: 'bg-zinc-100 dark:bg-zinc-800 text-text-secondary',
  trial:    'bg-amber-500/10 text-amber-600',
  custom:   'bg-blue-500/10 text-blue-600',
};

export default function BillingPage({ schools, stats }) {
  const toast = useToast();
  const [plans,          setPlans]          = useState([]);
  const [configuringPlan, setConfiguringPlan] = useState(null);
  const [showNewPlan,    setShowNewPlan]    = useState(false);

  useEffect(() => {
    platformService.getPlans()
      .then(d => setPlans(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, []);

  const handleSaved = (plan, isEdit) => {
    if (isEdit) {
      setPlans(prev => prev.map(p => p.id === plan.id ? plan : p));
    } else {
      setPlans(prev => [...prev, plan]);
    }
  };

  const standardPlans = plans.filter(p => p.type === 'standard').slice(0, 3);
  const priceMap = PLAN_PRICE_MAP(plans);

  const getSchoolAmount = (school) => {
    const price = priceMap[school.plan];
    return price != null ? `₹${Number(price).toLocaleString()}.00` : '—';
  };

  const mrrFromPlans = schools.reduce((sum, s) => sum + (priceMap[s.plan] || 0), 0);

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-text-primary tracking-tight font-display">Revenue & Subscriptions</h2>
          <p className="text-text-secondary text-sm mt-1">Global billing history and institution tier management.</p>
        </div>
        <Button className="flex items-center gap-2" onClick={() => setShowNewPlan(true)}>
          <Plus className="h-4 w-4" /> New Plan
        </Button>
      </div>

      {/* ARR Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
        <Card className="shadow-sm">
          <CardContent className="p-4">
            <p className="text-text-muted text-[10px] font-bold uppercase tracking-wider">Total ARR Estimate</p>
            <p className="text-2xl font-black text-primary mt-1 font-display">₹{(mrrFromPlans * 12).toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardContent className="p-4">
            <p className="text-text-muted text-[10px] font-bold uppercase tracking-wider">Active Invoices</p>
            <p className="text-2xl font-black text-text-primary mt-1 font-display">{schools.filter(s => s.status === 'ACTIVE').length}</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardContent className="p-4">
            <p className="text-text-muted text-[10px] font-bold uppercase tracking-wider">Avg Ticket Size</p>
            <p className="text-2xl font-black text-text-primary mt-1 font-display">
              {schools.length > 0
                ? `₹${Math.round(schools.reduce((s, sc) => s + (priceMap[sc.plan] || 0), 0) / schools.length).toLocaleString()}`
                : '—'}
            </p>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardContent className="p-4">
            <p className="text-text-muted text-[10px] font-bold uppercase tracking-wider">Suspended</p>
            <p className="text-2xl font-black text-red-500 mt-1 font-display">{schools.filter(s => s.status === 'SUSPENDED').length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Standard Pricing Tiers */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-text-primary">Pricing Tiers</h3>
          <button
            onClick={() => setShowNewPlan(true)}
            className="text-xs font-bold text-primary hover:underline"
          >
            View all plans ({plans.length}) →
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {standardPlans.map(tier => (
            <div
              key={tier.id}
              className={`p-6 sm:p-8 rounded-2xl border flex flex-col justify-between bg-surface relative shadow-xs ${tier.name === 'Premium' ? 'border-zinc-900 border-2 dark:border-zinc-50' : 'border-border'}`}
            >
              {tier.name === 'Premium' && (
                <span className="absolute top-3 right-3 bg-zinc-900 text-zinc-50 dark:bg-zinc-50 dark:text-zinc-900 text-[9px] font-bold py-0.5 px-2 rounded uppercase tracking-wider">
                  Most Popular
                </span>
              )}
              <div>
                <h3 className="text-lg font-bold text-text-primary">{tier.name} Plan</h3>
                <p className="text-xs text-text-secondary mt-2">{tier.description}</p>
                <div className="my-6 flex items-baseline gap-0.5">
                  <span className="text-3xl font-black text-text-primary">₹{Number(tier.price).toLocaleString()}</span>
                  <span className="text-xs text-text-muted">/month</span>
                </div>
                <p className="text-[10px] text-text-muted font-semibold">
                  Students: {tier.student_limit ? Number(tier.student_limit).toLocaleString() : 'Unlimited'}
                </p>
              </div>
              <Button
                variant={tier.name === 'Premium' ? 'default' : 'outline'}
                className="w-full py-2.5 text-xs font-bold justify-center mt-6"
                onClick={() => setConfiguringPlan(tier)}
              >
                Configure Plan
              </Button>
            </div>
          ))}
        </div>
      </div>

      {/* All Plans Table */}
      <Card>
        <CardHeader className="py-4 border-b border-border bg-zinc-50/50 dark:bg-zinc-900/50 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-bold text-text-primary">All Plans</CardTitle>
          <Button variant="outline" size="sm" className="text-xs" onClick={() => setShowNewPlan(true)}>
            <Plus className="h-3.5 w-3.5 mr-1" /> New Plan
          </Button>
        </CardHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Price / mo</TableHead>
              <TableHead>Student Limit</TableHead>
              <TableHead>Description</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {plans.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-6 text-text-muted">Loading plans…</TableCell>
              </TableRow>
            ) : (
              plans.map(p => (
                <TableRow key={p.id}>
                  <TableCell className="font-bold text-text-primary py-3">{p.name}</TableCell>
                  <TableCell>
                    <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-black uppercase ${TYPE_BADGE[p.type] || TYPE_BADGE.custom}`}>
                      {p.type}
                    </span>
                  </TableCell>
                  <TableCell className="font-mono text-xs font-bold">₹{Number(p.price).toLocaleString()}</TableCell>
                  <TableCell className="text-xs text-text-secondary">{p.student_limit ? Number(p.student_limit).toLocaleString() : 'Unlimited'}</TableCell>
                  <TableCell className="text-xs text-text-muted max-w-xs truncate">{p.description || '—'}</TableCell>
                  <TableCell>
                    <button
                      onClick={() => setConfiguringPlan(p)}
                      className="text-xs font-bold text-primary hover:underline"
                    >
                      Edit
                    </button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Invoices List */}
      <Card>
        <CardHeader className="py-4 border-b border-border bg-zinc-50/50 dark:bg-zinc-900/50">
          <CardTitle className="text-sm font-bold text-text-primary">Tenant Invoices & Billing States</CardTitle>
        </CardHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>School Tenant</TableHead>
              <TableHead>Tier</TableHead>
              <TableHead>Amount Due</TableHead>
              <TableHead>Billing State</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {schools.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-6 text-text-muted">
                  No billing data available.
                </TableCell>
              </TableRow>
            ) : (
              schools.map(s => (
                <TableRow key={s.id}>
                  <TableCell className="font-bold text-text-primary py-3.5">{s.name}</TableCell>
                  <TableCell>{s.plan}</TableCell>
                  <TableCell className="font-mono text-xs font-bold text-text-primary">
                    {getSchoolAmount(s)}
                  </TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${s.status === 'ACTIVE' ? 'bg-green-500/10 text-green-600' : 'bg-red-500/10 text-red-600'}`}>
                      {s.status === 'ACTIVE' ? 'Paid / Active' : 'SUSPENDED'}
                    </span>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

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
