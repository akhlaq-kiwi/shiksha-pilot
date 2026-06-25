import React, { useState } from 'react';
import { Plus, Search, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../../common/ui/button';
import { Input } from '../../../common/ui/input';

const getSchoolColor = (name) => {
  const colors = [
    'bg-blue-500 text-white', 'bg-emerald-500 text-white', 'bg-amber-500 text-white',
    'bg-indigo-500 text-white', 'bg-teal-500 text-white', 'bg-purple-500 text-white', 'bg-rose-500 text-white',
  ];
  let sum = 0;
  for (let i = 0; i < name.length; i++) sum += name.charCodeAt(i);
  return colors[sum % colors.length];
};

export default function SchoolsPage({ schools, onCreateSchool }) {
  const nav = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const filtered = Array.isArray(schools) ? schools.filter(s => {
    const matchSearch = (s.name || '').toLowerCase().includes(search.toLowerCase())
      || (s.subdomain || '').toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all'
      || (s.status || '').toLowerCase() === statusFilter;
    return matchSearch && matchStatus;
  }) : [];

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-text-primary tracking-tight font-display">Schools</h2>
          <p className="text-text-secondary text-sm mt-1">Manage and monitor all schools on the platform.</p>
        </div>
        <Button className="flex items-center gap-2 justify-center" onClick={onCreateSchool}>
          <Plus className="h-4 w-4" /> Add School
        </Button>
      </div>

      {/* Filters */}
      <div className="bg-surface border border-border rounded-xl p-4 flex flex-col md:flex-row gap-4 items-center justify-between shadow-xs">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-3 h-4 w-4 text-text-muted" />
          <Input
            placeholder="Search by name or subdomain..."
            className="pl-9"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto whitespace-nowrap w-full md:w-auto scrollbar-none">
          {['all', 'active', 'suspended'].map(f => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${statusFilter === f ? 'bg-primary text-zinc-50 border-primary dark:bg-zinc-50 dark:text-zinc-900 dark:border-zinc-50' : 'bg-transparent text-text-secondary border-border hover:bg-zinc-50 dark:hover:bg-zinc-900'}`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.length === 0 ? (
          <div className="col-span-full py-12 text-center text-text-muted text-sm border-2 border-dashed border-border rounded-2xl">
            No schools match your filters.
          </div>
        ) : (
          filtered.map(school => (
            <div
              key={school.id}
              onClick={() => nav(`/super-admin/schools/${school.id}`)}
              className="bg-surface border border-border rounded-xl p-5 hover:shadow-md hover:border-zinc-400 dark:hover:border-zinc-600 transition-all group cursor-pointer flex flex-col justify-between h-44 shadow-xs"
            >
              <div className="flex items-start justify-between">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-sm ${getSchoolColor(school.name)}`}>
                  {school.name.substring(0, 2).toUpperCase()}
                </div>
                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${school.status === 'ACTIVE' ? 'bg-green-500/10 text-green-600' : 'bg-red-500/10 text-red-600'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${school.status === 'ACTIVE' ? 'bg-green-500' : 'bg-red-500'}`}></span>
                  {school.status}
                </span>
              </div>
              <div className="mt-4">
                <h3 className="font-bold text-base text-text-primary group-hover:text-primary transition-colors">{school.name}</h3>
                <p className="text-text-muted text-xs font-semibold">{school.subdomain}.shikshapilot.com</p>
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-3 text-xs text-text-secondary">
                <span>{school.plan} Plan</span>
                <ChevronRight className="h-4 w-4 text-text-muted group-hover:translate-x-1 transition-all" />
              </div>
            </div>
          ))
        )}

        <div
          onClick={onCreateSchool}
          className="border-2 border-dashed border-border hover:border-zinc-400 dark:hover:border-zinc-600 rounded-xl flex flex-col items-center justify-center p-6 text-center hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-all cursor-pointer group h-44"
        >
          <div className="w-10 h-10 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
            <Plus className="h-5 w-5 text-zinc-600 dark:text-zinc-400" />
          </div>
          <h3 className="font-bold text-sm text-text-primary">Add New School</h3>
          <p className="text-xs text-text-secondary mt-0.5">Provision a new school account.</p>
        </div>
      </div>
    </div>
  );
}
