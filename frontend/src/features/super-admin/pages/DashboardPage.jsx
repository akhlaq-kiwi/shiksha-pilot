import React from 'react';
import { Building2, Users, GraduationCap, Landmark, Sparkles } from 'lucide-react';
import { Card } from '../../../common/ui/card';
import { SkeletonStatGrid } from '../../../common/ui/skeleton';
import { formatCurrency, formatNumber } from '../../../common/utils/format';

/**
 * Platform dashboard.
 *
 * The four KPIs here (active schools, teachers, students, revenue) are real
 * counts from platformService.getStats() - no trend/delta is fabricated,
 * because the backend has no MRR-over-time, last-login, or failed-payment
 * data to back one. Inventing a trend arrow with nothing behind it would be
 * worse than showing none (see the phase-0 principle on this).
 *
 * Fixes over the previous version:
 *  - Raw Tailwind palette gradients (blue/violet/emerald/amber) replaced with
 *    the --chart-N tokens, so this follows dark mode and stays visually
 *    consistent with every other chart in the app.
 *  - Revenue was interpolated as a raw `₹${n}` string; now goes through the
 *    tenant-aware formatCurrency, matching the fix applied to the school-admin
 *    dashboard which had the same shadowing bug.
 *  - `loading` renders a skeleton grid instead of a silent wall of zeroes -
 *    previously a failed stats fetch (which was swallowed with a bare
 *    `catch {}` upstream) looked identical to "0 schools", now fixed at the
 *    fetch call site with a toast, and here with a real loading state.
 */
export default function DashboardPage({ stats = {}, loading = false }) {
  const cards = [
    {
      title: 'Total schools',
      value: formatNumber(stats.active_schools ?? 0),
      description: 'Active schools',
      icon: Building2,
      accent: 'chart-1',
    },
    {
      title: 'Total teachers',
      value: formatNumber(stats.total_teachers ?? 0),
      description: 'Active teachers across active schools',
      icon: Users,
      accent: 'chart-6',
    },
    {
      title: 'Total students',
      value: formatNumber(stats.total_students ?? 0),
      description: 'Active students across active schools',
      icon: GraduationCap,
      accent: 'chart-2',
    },
    {
      title: 'Total revenue',
      value: stats.total_revenue != null ? formatCurrency(stats.total_revenue) : formatCurrency(0),
      description: 'Total revenue generated',
      icon: Landmark,
      accent: 'chart-3',
    },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-border/60 pb-6">
        <div>
          <div className="mb-1.5 flex items-center gap-2 text-overline text-primary">
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            Super admin console
          </div>
          <h2 className="text-display-lg font-display text-text-primary">Platform overview</h2>
          <p className="mt-1 max-w-xl text-body-md text-text-secondary">
            Administrative snapshot across all active schools and subscription tiers.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-success-200 bg-success-50 px-4 py-2.5">
          <span className="relative flex h-2 w-2" aria-hidden="true">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-success-500" />
          </span>
          <span className="text-body-sm font-semibold text-success-700">Platform status: Active</span>
        </div>
      </div>

      {/* KPI Cards */}
      {loading ? (
        <SkeletonStatGrid count={4} />
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {cards.map((card) => {
            const Icon = card.icon;
            return (
              <Card
                key={card.title}
                className="group relative flex h-48 flex-col justify-between overflow-hidden rounded-2xl border border-border bg-surface p-6 shadow-sm transition-shadow hover:shadow-md sm:p-8"
              >
                <div
                  className="absolute inset-x-0 top-0 h-1.5"
                  style={{ backgroundColor: `var(--${card.accent})` }}
                  aria-hidden="true"
                />

                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <p className="text-overline text-text-muted">{card.title}</p>
                    <p className="mt-2 text-4xl font-display font-bold tabular-nums text-text-primary">
                      {card.value}
                    </p>
                  </div>
                  <div
                    className="rounded-xl p-3 transition-transform group-hover:scale-105"
                    style={{
                      backgroundColor: `color-mix(in srgb, var(--${card.accent}) 12%, transparent)`,
                      color: `var(--${card.accent})`,
                    }}
                  >
                    <Icon className="h-6 w-6" aria-hidden="true" />
                  </div>
                </div>

                <div className="mt-4 border-t border-border/50 pt-4">
                  <p className="text-body-sm font-medium text-text-secondary">{card.description}</p>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
