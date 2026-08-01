import React, { useState } from 'react';
import { CreditCard, Download, CheckCircle2 } from 'lucide-react';
import { Button } from '../../../common/ui/button';
import { Card, CardContent } from '../../../common/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '../../../common/ui/table';
import { Input } from '../../../common/ui/input';
import { Dialog } from '../../../common/ui/dialog';

export default function FeesPage({ fees, payments }) {
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [payForm, setPayForm] = useState({ cardName: '', cardNumber: '', expiry: '', cvv: '', amount: String(fees.outstanding) });
  const [paying, setPaying] = useState(false);
  const [paySuccess, setPaySuccess] = useState(false);

  const handlePaymentSubmit = (e) => {
    e.preventDefault();
    setPaying(true);
    setTimeout(() => {
      setPaying(false);
      setPaySuccess(true);
    }, 1800);
  };

  const openPayDialog = () => {
    setPaySuccess(false);
    setPaymentDialogOpen(true);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-text-primary tracking-tight font-display">Fees & Payments</h2>
          <p className="text-text-secondary text-sm mt-1">Outstanding balances, payment history, and receipts.</p>
        </div>
        <Button onClick={openPayDialog} className="flex items-center gap-2">
          <CreditCard className="h-4 w-4" /> Pay Online
        </Button>
      </div>

      {/* Outstanding Fee Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 p-6 bg-zinc-950 dark:bg-zinc-900 text-zinc-50 rounded-2xl relative overflow-hidden shadow-lg">
          <div className="absolute -top-6 -right-6 h-32 w-32 rounded-full bg-zinc-800/40 blur-2xl pointer-events-none" />
          <div className="relative z-10">
            <div className="flex items-start justify-between mb-6">
              <div>
                <p className="text-zinc-400 text-[11px] font-bold uppercase tracking-wider">Outstanding Balance</p>
                <p className="text-4xl font-bold tabular-nums mt-1">₹{fees.outstanding.toLocaleString()}</p>
              </div>
              <span className="bg-amber-500 text-white text-[11px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider">Due</span>
            </div>
            <div className="space-y-2 mb-6">
              {fees.breakdown.map(item => (
                <div key={item.label} className="flex justify-between text-xs font-semibold border-b border-zinc-800 pb-2">
                  <span className="text-zinc-400">{item.label}</span>
                  <span className="tabular-nums">₹{item.amount.toLocaleString()}</span>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-zinc-500">Due date: <span className="text-zinc-200 font-bold">{fees.dueDate}</span></span>
              <Button
                onClick={openPayDialog}
                className="bg-zinc-50 text-zinc-900 hover:bg-zinc-200 border-none text-xs font-bold py-2 px-4"
              >
                Pay Now
              </Button>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <Card className="shadow-sm">
            <CardContent className="p-5">
              <p className="text-[11px] font-bold text-text-muted uppercase tracking-wider">Last Payment</p>
              <p className="text-2xl font-bold text-emerald-600 tabular-nums mt-1">₹{fees.lastPaid.toLocaleString()}</p>
              <p className="text-xs text-text-muted mt-1">{fees.lastPaidDate}</p>
            </CardContent>
          </Card>
          <Card className="shadow-sm">
            <CardContent className="p-5">
              <p className="text-[11px] font-bold text-text-muted uppercase tracking-wider">Annual Fee Paid</p>
              <p className="text-2xl font-bold text-text-primary tabular-nums mt-1">₹66,000</p>
              <div className="mt-2 h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full" style={{ width: '75%' }} />
              </div>
              <p className="text-[11px] text-text-muted mt-1.5">75% of ₹88,000 annual fee</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Receipts */}
      <div>
        <h3 className="text-base font-bold text-text-primary mb-4">Payment Receipts</h3>
        <Card className="overflow-hidden shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Receipt No.</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Mode</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.map(r => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs font-bold text-text-primary py-3.5">{r.id}</TableCell>
                  <TableCell className="text-sm text-text-secondary">{r.description}</TableCell>
                  <TableCell className="text-xs text-text-muted">{r.date}</TableCell>
                  <TableCell>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-text-secondary">{r.mode}</span>
                  </TableCell>
                  <TableCell className="font-mono font-bold text-text-primary tabular-nums">₹{r.amount.toLocaleString()}</TableCell>
                  <TableCell>
                    <button className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-text-muted hover:text-text-primary transition-colors">
                      <Download className="h-3.5 w-3.5" />
                    </button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>

      {/* Payment Dialog */}
      <Dialog
        isOpen={paymentDialogOpen}
        onClose={() => setPaymentDialogOpen(false)}
        title="Online Fee Payment"
        description={`Pay outstanding fee of ₹${fees.outstanding.toLocaleString()} securely.`}
        footer={
          paySuccess ? (
            <Button onClick={() => setPaymentDialogOpen(false)}>Close</Button>
          ) : (
            <>
              <Button variant="secondary" onClick={() => setPaymentDialogOpen(false)}>Cancel</Button>
              <Button onClick={handlePaymentSubmit} disabled={paying}>
                {paying ? 'Processing...' : `Pay ₹${parseInt(payForm.amount || 0).toLocaleString()}`}
              </Button>
            </>
          )
        }
      >
        {paySuccess ? (
          <div className="py-6 flex flex-col items-center text-center gap-3">
            <div className="h-14 w-14 rounded-full bg-emerald-500/10 flex items-center justify-center">
              <CheckCircle2 className="h-7 w-7 text-emerald-600" />
            </div>
            <h3 className="text-lg font-bold text-text-primary">Payment Successful</h3>
            <p className="text-sm text-text-secondary">₹{parseInt(payForm.amount || 0).toLocaleString()} has been received. Receipt will be emailed shortly.</p>
          </div>
        ) : (
          <form onSubmit={handlePaymentSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-secondary uppercase">Amount (₹)</label>
              <Input
                type="number"
                value={payForm.amount}
                onChange={e => setPayForm(p => ({ ...p, amount: e.target.value }))}
                placeholder="14500"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-secondary uppercase">Cardholder Name</label>
              <Input
                value={payForm.cardName}
                onChange={e => setPayForm(p => ({ ...p, cardName: e.target.value }))}
                placeholder="As it appears on card"
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-secondary uppercase">Card Number</label>
              <Input
                value={payForm.cardNumber}
                onChange={e => setPayForm(p => ({ ...p, cardNumber: e.target.value }))}
                placeholder="0000 0000 0000 0000"
                maxLength={19}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-text-secondary uppercase">Expiry</label>
                <Input
                  value={payForm.expiry}
                  onChange={e => setPayForm(p => ({ ...p, expiry: e.target.value }))}
                  placeholder="MM / YY"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-text-secondary uppercase">CVV</label>
                <Input
                  value={payForm.cvv}
                  onChange={e => setPayForm(p => ({ ...p, cvv: e.target.value }))}
                  placeholder="•••"
                  maxLength={4}
                  required
                />
              </div>
            </div>
            <p className="text-[11px] text-text-muted flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-full border border-text-muted flex items-center justify-center text-[7px]">🔒</span>
              Simulated secure payment. No real data is transmitted.
            </p>
          </form>
        )}
      </Dialog>
    </div>
  );
}
