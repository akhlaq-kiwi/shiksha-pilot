import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Clock, Calendar, CheckCircle2, ShieldAlert } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../../../common/ui/card';
import { Button } from '../../../common/ui/button';
import { platformService } from '../../../common/services/platformService';

export default function SchoolHistoryPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const [history, setHistory] = useState([]);
  const [schoolName, setSchoolName] = useState('School');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const schools = await platformService.getSchools();
        const sc = schools.find(s => String(s.id) === String(id));
        if (sc) {
          setSchoolName(sc.name);
        }

        const data = await platformService.getSchoolSubscriptions(id);
        setHistory(Array.isArray(data) ? data : []);
      } catch {}
      setLoading(false);
    }
    fetchData();
  }, [id]);

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    const opt = { year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(dateStr).toLocaleDateString('en-US', opt);
  };

  const getTransactionLabel = (type) => {
    switch (type) {
      case 'new':
        return { label: 'New Subscription', color: 'bg-primary/10 text-primary border-primary/20' };
      case 'renewal':
        return { label: 'Renewal', color: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' };
      case 'upgrade':
        return { label: 'Upgrade', color: 'bg-purple-500/10 text-purple-600 border-purple-500/20' };
      default:
        return { label: 'Subscription Purchase', color: 'bg-zinc-500/10 text-zinc-600 border-zinc-500/20' };
    }
  };

  const dNow = new Date();
  const today = `${dNow.getFullYear()}-${String(dNow.getMonth() + 1).padStart(2, '0')}-${String(dNow.getDate()).padStart(2, '0')}`;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Header */}
      <div className="flex items-center gap-4 border-b border-border/60 pb-6">
        <Button variant="outline" size="sm" onClick={() => nav('/super-admin/schools')} className="p-2 rounded-xl">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h2 className="text-3xl font-bold text-text-primary tracking-tight font-display">{schoolName} — Billing History</h2>
          <p className="text-text-secondary text-sm mt-1">Audit log of all subscription payments, renewals, and tier upgrades.</p>
        </div>
      </div>

      {/* Timeline view */}
      {loading ? (
        <div className="py-12 text-center text-xs text-text-muted">Loading billing logs…</div>
      ) : history.length === 0 ? (
        <Card className="p-8 text-center text-text-muted text-sm flex flex-col items-center gap-2 justify-center border border-border bg-surface rounded-2xl">
          <ShieldAlert className="h-8 w-8 text-text-muted animate-pulse" />
          <span>No subscription history has been recorded for this institution yet.</span>
        </Card>
      ) : (
        <div className="relative border-l-2 border-border pl-6 ml-4 space-y-8 py-2">
          {history.map((tx, idx) => {
            const badge = getTransactionLabel(tx.type);
            const isCurrentActive = tx.status === 'PAID' && today >= tx.start_date && today <= tx.expiry_date;
            
            return (
              <div key={tx.id} className="relative">
                {/* Timeline node icon */}
                <span className={`absolute -left-[35px] top-1.5 flex h-6 w-6 items-center justify-center rounded-full border-2 bg-surface ${isCurrentActive ? 'border-primary text-primary' : 'border-border text-text-muted'}`}>
                  {isCurrentActive ? (
                    <CheckCircle2 className="h-3.5 w-3.5 fill-current text-white bg-primary rounded-full" />
                  ) : (
                    <Clock className="h-3.5 w-3.5" />
                  )}
                </span>

                <Card className={`shadow-sm border rounded-2xl p-6 bg-surface hover:shadow-md transition-all ${isCurrentActive ? 'border-primary/50' : 'border-border'}`}>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/50 pb-4 mb-4">
                    <div>
                      <span className={`inline-flex px-2.5 py-0.5 rounded border text-[11px] font-bold uppercase tracking-wider ${badge.color}`}>
                        {badge.label}
                      </span>
                      <h3 className="text-lg font-bold text-text-primary mt-2 font-display">{tx.plan_name || 'Standard'} Tier</h3>
                      <p className="text-text-muted text-xs font-mono mt-0.5">Invoice {tx.invoice_no}</p>
                    </div>
                    
                    <div className="text-right sm:text-right flex flex-col items-start sm:items-end justify-between">
                      <div className="text-2xl font-bold text-text-primary">
                        {tx.amount > 0 ? `₹${Number(tx.amount).toLocaleString()}` : 'Free'}
                      </div>
                      <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase mt-1 ${isCurrentActive ? 'bg-green-500/10 text-green-600' : 'bg-zinc-100 dark:bg-zinc-800 text-text-muted'}`}>
                        {isCurrentActive ? 'Active Plan' : today > tx.expiry_date ? 'Expired' : 'Pending'}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-semibold text-text-secondary">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-text-muted" />
                      <div>
                        <p className="text-[11px] uppercase font-bold text-text-muted tracking-wider">Purchase Date</p>
                        <p className="text-text-primary font-bold mt-0.5">{formatDate(tx.created_at || tx.start_date)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-text-muted" />
                      <div>
                        <p className="text-[11px] uppercase font-bold text-text-muted tracking-wider">Plan Duration</p>
                        <p className="text-text-primary font-bold mt-0.5">
                          {tx.duration_value} {tx.duration_unit === 'month' ? 'Month' : 'Year'}{tx.duration_value > 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-text-muted" />
                      <div>
                        <p className="text-[11px] uppercase font-bold text-text-muted tracking-wider">Expiry Date</p>
                        <p className="text-text-primary font-bold mt-0.5">{formatDate(tx.expiry_date)}</p>
                      </div>
                    </div>
                  </div>
                </Card>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
