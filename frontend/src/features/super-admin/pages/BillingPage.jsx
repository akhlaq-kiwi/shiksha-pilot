import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../../../common/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '../../../common/ui/table';
import { Button } from '../../../common/ui/button';

export default function BillingPage({ schools, stats, plans }) {
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
            <p className="text-2xl font-black text-primary mt-1 font-display">₹{(stats.billing_mrr * 12).toLocaleString()}</p>
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
            <p className="text-2xl font-black text-text-primary mt-1 font-display">₹19,999</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardContent className="p-4">
            <p className="text-text-muted text-[10px] font-bold uppercase tracking-wider">Churn Rate</p>
            <p className="text-2xl font-black text-green-600 mt-1 font-display">1.8%</p>
          </CardContent>
        </Card>
      </div>

      {/* Pricing Tiers */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { name: 'Standard', price: 7999, desc: 'Includes standard gradebooks and audit logs up to 1,500 students.', popular: false },
          { name: 'Premium', price: 19999, desc: 'Includes dynamic timetables, color themes, and multi-branch configurations.', popular: true },
          { name: 'Enterprise', price: 39999, desc: 'Unlimited students, custom domain matching, and dedicated audit log exports.', popular: false },
        ].map(tier => (
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
            </div>
            <Button variant={tier.popular ? 'default' : 'outline'} className="w-full py-2.5 text-xs font-bold justify-center">
              Configure Plan
            </Button>
          </div>
        ))}
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
                    {s.plan === 'Standard' ? '₹7,999.00' : s.plan === 'Enterprise' ? '₹39,999.00' : '₹19,999.00'}
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
    </div>
  );
}
