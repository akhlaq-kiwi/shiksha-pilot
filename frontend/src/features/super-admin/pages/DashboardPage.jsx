import React from 'react';
import { Building2, Users, GraduationCap, Landmark, Sparkles } from 'lucide-react';
import { Card, CardContent } from '../../../common/ui/card';

export default function DashboardPage({ stats }) {
  const cards = [
    {
      title: 'Total Schools',
      value: stats.active_schools != null ? stats.active_schools : 0,
      description: 'Active schools',
      icon: Building2,
      gradient: 'from-blue-600 to-indigo-600',
      iconBg: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    },
    {
      title: 'Total Teachers',
      value: stats.total_teachers != null ? stats.total_teachers : 0,
      description: 'Active teachers across active schools',
      icon: Users,
      gradient: 'from-violet-600 to-purple-600',
      iconBg: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
    },
    {
      title: 'Total Students',
      value: stats.total_students != null ? stats.total_students : 0,
      description: 'Active students across active schools',
      icon: GraduationCap,
      gradient: 'from-emerald-600 to-teal-600',
      iconBg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    },
    {
      title: 'Total Revenue',
      value: stats.total_revenue != null ? `₹${Number(stats.total_revenue).toLocaleString()}` : '₹0',
      description: 'Total Revenue Generated',
      icon: Landmark,
      gradient: 'from-amber-600 to-orange-600',
      iconBg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      
      {/* Premium Executive Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-border/60 pb-6">
        <div>
          <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider mb-1.5">
            <Sparkles className="h-3.5 w-3.5" />
            Super Admin Console
          </div>
          <h2 className="text-3xl font-black text-text-primary tracking-tight font-display">System Overview</h2>
          <p className="text-text-secondary text-sm mt-1 max-w-xl">
            Real-time administrative snapshot across all active subdomains and subscription tiers.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-xl px-4 py-2.5 flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-bold">Platform Status: Active</span>
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {cards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <Card key={idx} className="relative overflow-hidden border border-border bg-surface shadow-md hover:shadow-lg transition-all group rounded-2xl p-6 sm:p-8 flex flex-col justify-between h-48">
              {/* Subtle top decoration bar with plan colors */}
              <div className={`absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r ${card.gradient}`} />
              
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <p className="text-text-muted text-xs uppercase tracking-wider font-extrabold">{card.title}</p>
                  <p className="text-4xl font-black text-text-primary font-display tracking-tight mt-2">{card.value}</p>
                </div>
                <div className={`p-3 rounded-xl ${card.iconBg} group-hover:scale-105 transition-transform`}>
                  <Icon className="h-6 w-6" />
                </div>
              </div>
              
              <div className="border-t border-border/50 pt-4 mt-4">
                <p className="text-text-secondary text-xs font-semibold">{card.description}</p>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
