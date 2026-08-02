import React, { useState, useEffect } from 'react';
import { Inbox, Trash2, Mail, Phone } from 'lucide-react';
import { Card, CardContent } from '../../../common/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '../../../common/ui/table';
import { Button } from '../../../common/ui/button';
import { platformService } from '../../../common/services/platformService';
import { useToast } from '../../../common/components/Toast';
import { useConfirm } from '../../../common/components/ConfirmDialog';
import { formatDateTime } from '../../../common/utils/format';

export default function WebsiteLeadsPage() {
  const toast = useToast();
  const confirm = useConfirm();
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadLeads = async () => {
    setLoading(true);
    try {
      const data = await platformService.getWebsiteLeads();
      setLeads(Array.isArray(data) ? data : []);
    } catch (err) {
      toast.error(err.message || 'Failed to load website leads.');
    }
    setLoading(false);
  };

  useEffect(() => {
    loadLeads();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDelete = async (id, name) => {
    const ok = await confirm({
      title: 'Delete this lead?',
      message: `Remove the demo request from "${name}"? This can't be undone.`,
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;

    try {
      await platformService.deleteWebsiteLead(id);
      toast.success('Lead deleted.');
      setLeads((prev) => prev.filter((l) => l.id !== id));
    } catch (err) {
      toast.error(err.message || 'Failed to delete lead.');
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center gap-4 border-b border-border/60 pb-6">
        <div>
          <h2 className="text-3xl font-bold text-text-primary tracking-tight font-display">Website Leads</h2>
          <p className="text-text-secondary text-sm mt-1">Demo requests submitted from the "Book a Demo" form on the public marketing site.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="shadow-sm border border-border bg-surface rounded-2xl">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="p-3.5 bg-primary/10 text-primary rounded-2xl">
              <Inbox className="h-6 w-6" />
            </div>
            <div>
              <p className="text-text-muted text-[11px] font-bold uppercase tracking-wider">Total Leads</p>
              <p className="text-3xl font-bold text-text-primary mt-1 font-display">{leads.length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-sm border border-border bg-surface rounded-2xl overflow-hidden">
        {loading ? (
          <div className="py-12 text-center text-xs text-text-muted">Loading website leads&hellip;</div>
        ) : leads.length === 0 ? (
          <div className="py-16 text-center text-text-muted text-sm flex flex-col items-center gap-2 justify-center">
            <Inbox className="h-8 w-8 text-text-muted" />
            <span>No demo requests yet.</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>School</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Message</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead numeric>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leads.map((lead) => (
                  <TableRow key={lead.id}>
                    <TableCell className="font-bold text-text-primary">{lead.name}</TableCell>
                    <TableCell>{lead.school}</TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1 text-xs">
                        <a href={`mailto:${lead.email}`} className="inline-flex items-center gap-1.5 text-primary hover:underline">
                          <Mail className="h-3 w-3" /> {lead.email}
                        </a>
                        {lead.phone && (
                          <span className="inline-flex items-center gap-1.5 text-text-muted">
                            <Phone className="h-3 w-3" /> {lead.phone}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-xs">
                      <span className="text-xs text-text-secondary line-clamp-2">{lead.message || '—'}</span>
                    </TableCell>
                    <TableCell className="text-xs text-text-muted whitespace-nowrap">{formatDateTime(lead.created_at)}</TableCell>
                    <TableCell numeric>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-red-600 hover:bg-red-500/5 hover:text-red-700 border-red-200 dark:border-red-950"
                        onClick={() => handleDelete(lead.id, lead.name)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
    </div>
  );
}
