import React, { useState } from 'react';
import { X } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../../../common/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '../../../common/ui/table';
import { Button } from '../../../common/ui/button';
import { Input } from '../../../common/ui/input';
import { useToast } from '../../../common/components/Toast';

const DEFAULT_PLANS = [
  { name: 'Standard',   price: 7999,  studentLimit: 1500,  desc: 'Includes standard gradebooks and audit logs up to 1,500 students.',                          popular: false },
  { name: 'Premium',    price: 19999, studentLimit: 5000,  desc: 'Includes dynamic timetables, color themes, and multi-branch configurations.',                popular: true  },
  { name: 'Enterprise', price: 39999, studentLimit: null,  desc: 'Unlimited students, custom domain matching, and dedicated audit log exports.',               popular: false },
];

function ConfigurePlanDialog({ plan, onClose, onSave }) {
  const [form, setForm] = useState({
    price:        String(plan.price),
    studentLimit: plan.studentLimit !== null ? String(plan.studentLimit) : '',
    desc:         plan.desc,
  });
  const set = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({
      ...plan,
      price:        parseInt(form.price, 10),
      studentLimit: form.studentLimit ? parseInt(form.studentLimit, 10) : null,
      desc:         form.desc,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-surface border border-border rounded-2xl shadow-2xl w-full max-w-md p-6 animate-in zoom-in-95 fade-in duration-200">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-base font-bold text-text-primary">Configure {plan.name} Plan</h3>
            <p className="text-xs text-text-muted mt-0.5">Adjust pricing and limits for this tier</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 text-text-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-secondary uppercase">Monthly Price (₹)</label>
              <Input
                type="number"
                min="0"
                value={form.price}
                onChange={set('price')}
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-secondary uppercase">Student Limit</label>
              <Input
                type="number"
                min="0"
                placeholder="Leave empty for unlimited"
                value={form.studentLimit}
                onChange={set('studentLimit')}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-text-secondary uppercase">Description</label>
            <textarea
              rows={3}
              value={form.desc}
              onChange={set('desc')}
              className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
            <Button type="submit" className="flex-1">Save Changes</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

const PLAN_PRICE_MAP = (plans) => Object.fromEntries(plans.map(p => [p.name, p.price]));

export default function BillingPage({ schools, stats, plans: apiPlans }) {
  const toast = useToast();
  const [localPlans, setLocalPlans] = useState(DEFAULT_PLANS);
  const [configuringPlan, setConfiguringPlan] = useState(null);

  const handleSavePlan = (updated) => {
    setLocalPlans(prev => prev.map(p => p.name === updated.name ? updated : p));
    toast.success(`${updated.name} plan updated to ₹${updated.price.toLocaleString()}/mo.`, 'Plan Configured');
  };

  const priceMap = PLAN_PRICE_MAP(localPlans);

  const getSchoolAmount = (school) => {
    const price = priceMap[school.plan];
    return price ? `₹${price.toLocaleString()}.00` : '—';
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <div>
        <h2 className="text-3xl font-black text-text-primary tracking-tight font-display">Revenue & Subscriptions</h2>
        <p className="text-text-secondary text-sm mt-1">Global billing history and institution tier management.</p>
      </div>

      {/* ARR Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
        <Card className="shadow-sm">
          <CardContent className="p-4">
            <p className="text-text-muted text-[10px] font-bold uppercase tracking-wider">Total ARR Estimate</p>
            <p className="text-2xl font-black text-primary mt-1 font-display">₹{((stats.billing_mrr || 0) * 12).toLocaleString()}</p>
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
                ? `₹${Math.round(schools.reduce((sum, s) => sum + (priceMap[s.plan] || 0), 0) / schools.length).toLocaleString()}`
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

      {/* Pricing Tiers */}
      <div>
        <h3 className="text-base font-bold text-text-primary mb-4">Pricing Tiers</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {localPlans.map(tier => (
            <div
              key={tier.name}
              className={`p-6 sm:p-8 rounded-2xl border flex flex-col justify-between bg-surface relative shadow-xs ${tier.popular ? 'border-zinc-900 border-2 dark:border-zinc-50' : 'border-border'}`}
            >
              {tier.popular && (
                <span className="absolute top-3 right-3 bg-zinc-900 text-zinc-50 dark:bg-zinc-50 dark:text-zinc-900 text-[9px] font-bold py-0.5 px-2 rounded uppercase tracking-wider">
                  Most Popular
                </span>
              )}
              <div>
                <h3 className="text-lg font-bold text-text-primary">{tier.name} Plan</h3>
                <p className="text-xs text-text-secondary mt-2">{tier.desc}</p>
                <div className="my-6 flex items-baseline gap-0.5">
                  <span className="text-3xl font-black text-text-primary">₹{tier.price.toLocaleString()}</span>
                  <span className="text-xs text-text-muted">/month</span>
                </div>
                <p className="text-[10px] text-text-muted font-semibold">
                  Students: {tier.studentLimit ? tier.studentLimit.toLocaleString() : 'Unlimited'}
                </p>
              </div>
              <Button
                variant={tier.popular ? 'default' : 'outline'}
                className="w-full py-2.5 text-xs font-bold justify-center mt-6"
                onClick={() => setConfiguringPlan(tier)}
              >
                Configure Plan
              </Button>
            </div>
          ))}
        </div>
      </div>

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
        <ConfigurePlanDialog
          plan={configuringPlan}
          onClose={() => setConfiguringPlan(null)}
          onSave={handleSavePlan}
        />
      )}
    </div>
  );
}
