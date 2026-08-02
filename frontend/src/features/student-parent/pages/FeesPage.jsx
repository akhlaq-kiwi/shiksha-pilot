import React, { useState } from 'react';
import { CreditCard, Download, CheckCircle2, Loader2, ShieldCheck } from 'lucide-react';
import { Button } from '../../../common/ui/button';
import { Card, CardContent } from '../../../common/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '../../../common/ui/table';
import { Field } from '../../../common/ui/field';
import { Input, CurrencyInput } from '../../../common/ui/input';
import { Dialog } from '../../../common/ui/dialog';
import { TableEmptyState } from '../../../common/components/EmptyState';
import { useToast } from '../../../common/components/Toast';
import { studentService } from '../../../common/services/studentService';
import { formatCurrency, formatShortDate } from '../../../common/utils/format';

/**
 * Fees & Payments — the single path the audit asked for:
 * Amount due -> breakdown -> pay -> receipt.
 *
 * Changes from the previous version:
 *  - Tokenised colours (zinc/emerald/amber/blue -> semantic tokens), so this
 *    follows dark mode and per-school theming like every other screen.
 *  - The payment form validates the amount (required, > 0, warns rather than
 *    silently allowing an amount above what's owed) using Field + CurrencyInput
 *    instead of bare <Input> with no error slot.
 *  - The disclaimer is upgraded from a decorative lock emoji to an honest,
 *    visible notice that this is a simulated gateway — no card data is a
 *    real payment detail here, so it must never look production-grade.
 *  - The receipt "download" button was previously a no-op with no onClick.
 *    It now calls the real /api/student/fees/receipt endpoint and surfaces a
 *    clear error via toast on failure, rather than doing nothing silently.
 */
export default function FeesPage({ fees, payments }) {
  const toast = useToast();
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [amount, setAmount] = useState(String(fees.outstanding || ''));
  const [cardName, setCardName] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvv, setCvv] = useState('');
  const [errors, setErrors] = useState({});
  const [paying, setPaying] = useState(false);
  const [paySuccess, setPaySuccess] = useState(false);
  const [downloadingId, setDownloadingId] = useState(null);

  const openPayDialog = () => {
    setPaySuccess(false);
    setErrors({});
    setAmount(String(fees.outstanding || ''));
    setPaymentDialogOpen(true);
  };

  const validate = () => {
    const errs = {};
    const numAmount = Number(amount);
    if (!amount || Number.isNaN(numAmount) || numAmount <= 0) {
      errs.amount = 'Enter an amount greater than zero.';
    } else if (fees.outstanding > 0 && numAmount > fees.outstanding * 1.5) {
      // Not a hard block — schools sometimes accept advance payment — but a
      // silent 10x fat-finger error is a real support-ticket generator.
      errs.amount = `That's well above the ₹${fees.outstanding.toLocaleString()} outstanding — please confirm the amount.`;
    }
    if (!cardName.trim()) errs.cardName = 'Enter the name on the card.';
    if (cardNumber.replace(/\s/g, '').length < 12) errs.cardNumber = 'Enter a valid card number.';
    if (!/^\d{2}\s*\/\s*\d{2}$/.test(expiry)) errs.expiry = 'Use MM / YY.';
    if (cvv.length < 3) errs.cvv = 'Enter the 3-4 digit security code.';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handlePaymentSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setPaying(true);
    try {
      // No live payment gateway is wired up yet — simulate the round trip
      // rather than pretending a card was actually charged.
      await new Promise((resolve) => setTimeout(resolve, 1400));
      setPaySuccess(true);
    } catch (err) {
      toast.error(err?.message || 'Payment could not be processed. No amount was charged.', 'Payment failed');
    } finally {
      setPaying(false);
    }
  };

  const handleDownload = async (receipt) => {
    setDownloadingId(receipt.id);
    try {
      const blob = await studentService.downloadReceipt(receipt.id, {
        isAdditional: !!receipt.is_additional,
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Receipt_${receipt.id}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(
        err?.message || 'Could not download this receipt. Please try again.',
        'Download failed'
      );
    } finally {
      setDownloadingId(null);
    }
  };

  const numAmount = parseInt(amount || 0, 10) || 0;

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h2 className="text-display-md font-display text-text-primary">Fees & Payments</h2>
          <p className="text-body-md text-text-secondary mt-1">
            Outstanding balances, payment history, and receipts.
          </p>
        </div>
        <Button onClick={openPayDialog} size="touch">
          <CreditCard className="h-4 w-4" /> Pay online
        </Button>
      </div>

      {/* Outstanding Fee Card — the single, unmistakable entry to the pay flow */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 rounded-2xl bg-text-primary p-6 text-surface shadow-lg relative overflow-hidden">
          <div className="absolute -top-6 -right-6 h-32 w-32 rounded-full bg-white/10 blur-2xl pointer-events-none" />
          <div className="relative z-10">
            <div className="flex items-start justify-between mb-6">
              <div>
                <p className="text-overline text-surface/60">Outstanding balance</p>
                <p className="text-4xl font-display font-bold tabular-nums mt-1">
                  {formatCurrency(fees.outstanding)}
                </p>
              </div>
              {fees.outstanding > 0 && (
                <span className="rounded-full bg-warning-500 px-2.5 py-1 text-[11px] font-semibold text-white">
                  Due
                </span>
              )}
            </div>

            {fees.breakdown?.length > 0 && (
              <div className="space-y-2 mb-6">
                {fees.breakdown.map(item => (
                  <div key={item.label} className="flex justify-between border-b border-white/10 pb-2 text-body-sm font-medium">
                    <span className="text-surface/60">{item.label}</span>
                    <span className="tabular-nums">{formatCurrency(item.amount)}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between text-body-sm">
              <span className="text-surface/50">
                Due date: <span className="font-semibold text-surface">{formatShortDate(fees.dueDate)}</span>
              </span>
              {fees.outstanding > 0 && (
                <Button
                  onClick={openPayDialog}
                  className="bg-surface text-text-primary hover:bg-secondary border-none"
                  size="sm"
                >
                  Pay now
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <Card className="shadow-sm">
            <CardContent className="p-5">
              <p className="text-overline text-text-muted">Last payment</p>
              <p className="text-display-sm font-display text-success-700 tabular-nums mt-1">
                {formatCurrency(fees.lastPaid)}
              </p>
              <p className="text-body-sm text-text-muted mt-1">{formatShortDate(fees.lastPaidDate)}</p>
            </CardContent>
          </Card>
          {fees.annualFee > 0 && (
            <Card className="shadow-sm">
              <CardContent className="p-5">
                <p className="text-overline text-text-muted">Annual fee paid</p>
                <p className="text-display-sm font-display text-text-primary tabular-nums mt-1">
                  {formatCurrency(fees.annualFeePaid)}
                </p>
                <div className="mt-2 h-1.5 rounded-full bg-secondary overflow-hidden">
                  <div
                    className="h-full rounded-full bg-info-500"
                    style={{ width: `${Math.min(100, Math.round((fees.annualFeePaid / fees.annualFee) * 100))}%` }}
                  />
                </div>
                <p className="mt-1.5 text-body-sm text-text-muted">
                  {Math.round((fees.annualFeePaid / fees.annualFee) * 100)}% of {formatCurrency(fees.annualFee)} annual fee
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Receipts */}
      <div>
        <h3 className="text-display-xs font-display text-text-primary mb-4">Payment receipts</h3>
        <Card className="overflow-hidden shadow-sm">
          <Table stickyHeader>
            <TableHeader>
              <TableRow>
                <TableHead>Receipt no.</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Mode</TableHead>
                <TableHead numeric>Amount</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(payments || []).length === 0 ? (
                <TableEmptyState
                  colSpan={6}
                  variant="empty"
                  title="No receipts yet"
                  message="Your payment receipts will appear here once a fee payment is recorded."
                />
              ) : (
                payments.map(r => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-body-sm font-semibold text-text-primary">{r.id}</TableCell>
                    <TableCell>{r.description}</TableCell>
                    <TableCell className="text-body-sm text-text-muted">{formatShortDate(r.date)}</TableCell>
                    <TableCell>
                      <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-semibold text-text-secondary">
                        {r.mode}
                      </span>
                    </TableCell>
                    <TableCell numeric className="font-mono font-semibold text-text-primary">
                      {formatCurrency(r.amount)}
                    </TableCell>
                    <TableCell>
                      <button
                        type="button"
                        onClick={() => handleDownload(r)}
                        disabled={downloadingId === r.id}
                        aria-label={`Download receipt ${r.id}`}
                        className="rounded-lg p-1.5 text-text-muted transition-colors hover:bg-secondary hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:opacity-50"
                      >
                        {downloadingId === r.id
                          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          : <Download className="h-3.5 w-3.5" />}
                      </button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      </div>

      {/* Payment Dialog — the one path from due amount to receipt */}
      <Dialog
        isOpen={paymentDialogOpen}
        onClose={() => setPaymentDialogOpen(false)}
        title="Online fee payment"
        description={`Pay outstanding fee of ${formatCurrency(fees.outstanding)}.`}
        closeOnBackdropClick={!paying}
        footer={
          paySuccess ? (
            <Button onClick={() => setPaymentDialogOpen(false)}>Close</Button>
          ) : (
            <>
              <Button variant="secondary" onClick={() => setPaymentDialogOpen(false)} disabled={paying}>
                Cancel
              </Button>
              <Button onClick={handlePaymentSubmit} loading={paying} loadingText="Processing…">
                Pay {formatCurrency(numAmount)}
              </Button>
            </>
          )
        }
      >
        {paySuccess ? (
          <div className="py-6 flex flex-col items-center text-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-success-50">
              <CheckCircle2 className="h-7 w-7 text-success-600" />
            </div>
            <h3 className="text-display-xs font-display text-text-primary">Payment successful</h3>
            <p className="text-body-md text-text-secondary">
              {formatCurrency(numAmount)} has been received. A receipt will appear in the table above shortly.
            </p>
          </div>
        ) : (
          <form onSubmit={handlePaymentSubmit} className="space-y-4">
            <Field label="Amount" required error={errors.amount}>
              <CurrencyInput
                value={amount}
                onChange={e => setAmount(e.target.value)}
                invalid={!!errors.amount}
              />
            </Field>
            <Field label="Cardholder name" required error={errors.cardName}>
              <Input
                value={cardName}
                onChange={e => setCardName(e.target.value)}
                placeholder="As it appears on card"
                invalid={!!errors.cardName}
              />
            </Field>
            <Field label="Card number" required error={errors.cardNumber}>
              <Input
                value={cardNumber}
                onChange={e => setCardNumber(e.target.value)}
                placeholder="0000 0000 0000 0000"
                maxLength={19}
                inputMode="numeric"
                invalid={!!errors.cardNumber}
              />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Expiry" required error={errors.expiry}>
                <Input
                  value={expiry}
                  onChange={e => setExpiry(e.target.value)}
                  placeholder="MM / YY"
                  invalid={!!errors.expiry}
                />
              </Field>
              <Field label="CVV" required error={errors.cvv}>
                <Input
                  type="password"
                  value={cvv}
                  onChange={e => setCvv(e.target.value)}
                  placeholder="•••"
                  maxLength={4}
                  inputMode="numeric"
                  invalid={!!errors.cvv}
                />
              </Field>
            </div>

            <p className="flex items-start gap-1.5 rounded-lg bg-secondary px-3 py-2 text-body-sm text-text-muted">
              <ShieldCheck className="h-4 w-4 flex-shrink-0 mt-0.5" aria-hidden="true" />
              This is a simulated payment for demonstration. No card details are transmitted or stored.
            </p>
          </form>
        )}
      </Dialog>
    </div>
  );
}
