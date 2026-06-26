import React from 'react';
import { Building2, CreditCard, Activity, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '../../../common/ui/card';
import { Button } from '../../../common/ui/button';

const getSchoolColor = (name) => {
  const colors = [
    'bg-blue-500 text-white',
    'bg-emerald-500 text-white',
    'bg-amber-500 text-white',
    'bg-indigo-500 text-white',
    'bg-teal-500 text-white',
    'bg-purple-500 text-white',
    'bg-rose-500 text-white',
  ];
  let sum = 0;
  for (let i = 0; i < name.length; i++) sum += name.charCodeAt(i);
  return colors[sum % colors.length];
};

export default function DashboardPage({ schools, auditLogs, stats }) {
  const nav = useNavigate();
  const recentSignups = schools.slice(0, 2);

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black text-text-primary tracking-tight font-display">Super Admin Overview</h2>
          <p className="text-text-secondary text-sm mt-1 max-w-2xl">Monitor system health, institutional growth, and platform-wide revenue metrics.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="bg-green-500/5 border border-green-500/10 rounded-xl px-4 py-2 flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </span>
            <span className="text-xs text-green-600 font-bold">Systems Normal</span>
          </div>
        </div>
      </div>

      {/* Dashboard Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <Card className="shadow-sm">
          <CardContent className="p-6">
            <div className="flex justify-between items-start mb-4">
              <div className="p-2.5 bg-primary/10 rounded-xl text-primary"><Building2 className="h-5 w-5" /></div>
              <span className="text-green-600 text-xs font-bold bg-green-500/10 px-2 py-0.5 rounded-full">{stats.active_schools || 0} active</span>
            </div>
            <p className="text-text-muted text-xs uppercase tracking-wider font-semibold">Total Schools</p>
            <p className="text-3xl font-black text-text-primary mt-1 font-display">{schools.length || stats.schools_count || 0}</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="p-6">
            <div className="flex justify-between items-start mb-4">
              <div className="p-2.5 bg-teal-500/10 rounded-xl text-teal-600"><CreditCard className="h-5 w-5" /></div>
              <span className="text-green-600 text-xs font-bold bg-green-500/10 px-2 py-0.5 rounded-full">MRR</span>
            </div>
            <p className="text-text-muted text-xs uppercase tracking-wider font-semibold">Monthly Revenue</p>
            <p className="text-3xl font-black text-text-primary mt-1 font-display">₹{(stats.billing_mrr || 0).toLocaleString()}</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="p-6">
            <div className="flex justify-between items-start mb-4">
              <div className="p-2.5 bg-amber-500/10 rounded-xl text-amber-600"><Activity className="h-5 w-5" /></div>
              <span className="text-amber-600 text-xs font-bold bg-amber-500/10 px-2 py-0.5 rounded-full">Registered</span>
            </div>
            <p className="text-text-muted text-xs uppercase tracking-wider font-semibold">Total Students</p>
            <p className="text-3xl font-black text-text-primary mt-1 font-display">{(stats.total_students || 0).toLocaleString()}</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="p-6">
            <div className="flex justify-between items-start mb-4">
              <div className="p-2.5 bg-indigo-500/10 rounded-xl text-indigo-600"><Activity className="h-5 w-5" /></div>
              <span className="text-indigo-600 text-xs font-bold bg-indigo-500/10 px-2 py-0.5 rounded-full">Across schools</span>
            </div>
            <p className="text-text-muted text-xs uppercase tracking-wider font-semibold">Total Teachers</p>
            <p className="text-3xl font-black text-text-primary mt-1 font-display">{(stats.total_teachers || 0).toLocaleString()}</p>
          </CardContent>
        </Card>
      </div>

      {/* Subscriptions Chart and Signups */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Chart */}
        <div className="lg:col-span-8 bg-surface border border-border rounded-2xl p-6 sm:p-8">
          <h3 className="text-base font-bold text-text-primary mb-6">Active Subscriptions Growth</h3>
          <div className="h-64 relative flex items-end justify-between px-2 sm:px-6 border-b border-border pb-2">
            {/* Grid Lines */}
            <div className="absolute inset-0 flex flex-col justify-between pointer-events-none pb-8 pt-4">
              <div className="border-b border-zinc-100 dark:border-zinc-800/40 w-full"></div>
              <div className="border-b border-zinc-100 dark:border-zinc-800/40 w-full"></div>
              <div className="border-b border-zinc-100 dark:border-zinc-800/40 w-full"></div>
              <div className="border-b border-zinc-100 dark:border-zinc-800/40 w-full"></div>
            </div>
            {/* Chart bars */}
            {[45, 60, 55, 78, 92, 100].map((h, i) => (
              <div key={i} className="flex-1 flex flex-col items-center group cursor-pointer z-10">
                <div
                  className="w-8 sm:w-12 bg-primary/10 border-t-2 border-primary rounded-t group-hover:bg-primary/20 transition-all"
                  style={{ height: `${h * 1.8}px` }}
                ></div>
                <span className="mt-2 text-xs text-text-muted font-medium">{['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'][i]}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Signups */}
        <div className="lg:col-span-4 space-y-4 flex flex-col justify-between">
          <div>
            <h3 className="text-base font-bold text-text-primary mb-4">Recent Sign-ups</h3>
            <div className="space-y-3">
              {recentSignups.length === 0 ? (
                <div className="p-4 bg-zinc-50 dark:bg-zinc-900 border border-border rounded-xl text-center text-xs text-text-muted font-medium">
                  No provisions registered yet.
                </div>
              ) : (
                recentSignups.map(school => (
                  <div
                    key={school.id}
                    onClick={() => nav(`/super-admin/schools/${school.id}`)}
                    className="flex items-center justify-between p-4 bg-surface border border-border rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-all cursor-pointer shadow-xs"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-xs ${getSchoolColor(school.name)}`}>
                        {school.name.substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-text-primary">{school.name}</p>
                        <p className="text-xs text-text-secondary">{school.plan} • Active</p>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-text-muted" />
                  </div>
                ))
              )}
            </div>
          </div>
          <Button
            onClick={() => nav('/super-admin/schools')}
            variant="outline"
            className="w-full justify-center text-xs font-bold py-2.5"
          >
            View All Institutions
          </Button>
        </div>
      </div>
    </div>
  );
}
