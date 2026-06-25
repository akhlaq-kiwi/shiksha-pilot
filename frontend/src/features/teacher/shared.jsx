import React from 'react';
import { X } from 'lucide-react';
import { Card } from '../../common/ui/card';

// ─── Date helpers ────────────────────────────────────────────────────────────

export function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ─── Shared UI ───────────────────────────────────────────────────────────────

export function StatusBadge({ status }) {
  const map = {
    active:    { label: 'ACTIVE',    cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
    graded:    { label: 'Graded',    cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
    draft:     { label: 'Draft',     cls: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400' },
    completed: { label: 'Completed', cls: 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400' },
    upcoming:  { label: 'Upcoming',  cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
    break:     { label: 'Break',     cls: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400' },
  };
  const cfg = map[status] || { label: status, cls: 'bg-zinc-100 text-zinc-500' };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold tracking-wide ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

export function PriorityDot({ priority }) {
  const map = { high: 'bg-red-500', medium: 'bg-amber-400', low: 'bg-emerald-500' };
  return <span className={`inline-block h-2 w-2 rounded-full flex-shrink-0 ${map[priority] || 'bg-zinc-400'}`} />;
}

export function SectionHeader({ title, description, action }) {
  return (
    <div className="flex items-start justify-between gap-4 mb-5">
      <div>
        <h2 className="text-xl font-bold text-text-primary tracking-tight">{title}</h2>
        {description && <p className="text-sm text-text-muted mt-0.5">{description}</p>}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}

export function StatCard({ icon: Icon, label, value, sub, accent }) {
  return (
    <Card className="flex flex-col gap-2 p-5">
      <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${accent || 'bg-primary/10 text-primary'}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-2xl font-bold text-text-primary font-display tabular-nums">{value}</p>
        <p className="text-xs font-semibold text-text-secondary uppercase tracking-wide mt-0.5">{label}</p>
        {sub && <p className="text-xs text-text-muted mt-1">{sub}</p>}
      </div>
    </Card>
  );
}

export function Modal({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(9,9,11,0.55)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-surface border border-border rounded-xl shadow-lg w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h3 className="font-bold text-text-primary text-base">{title}</h3>
          <button
            onClick={onClose}
            className="h-7 w-7 flex items-center justify-center rounded-md text-text-muted hover:bg-background hover:text-text-primary transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

export function Label({ children, htmlFor }) {
  return (
    <label htmlFor={htmlFor} className="block text-xs font-semibold text-text-secondary uppercase tracking-wide mb-1.5">
      {children}
    </label>
  );
}

export function FormSelect({ value, onChange, children, className = '' }) {
  return (
    <select
      value={value}
      onChange={onChange}
      className={`w-full h-9 rounded-md border border-border bg-background text-text-primary text-sm px-3 focus:outline-none focus:ring-1 focus:ring-primary/30 transition-colors ${className}`}
    >
      {children}
    </select>
  );
}

export function Textarea({ value, onChange, placeholder, rows = 3 }) {
  return (
    <textarea
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      rows={rows}
      className="w-full rounded-md border border-border bg-background text-text-primary text-sm px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary/30 transition-colors resize-none placeholder:text-text-muted"
    />
  );
}
