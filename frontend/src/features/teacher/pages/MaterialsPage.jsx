import React, { useState } from 'react';
import { Upload, Search, Link2, Download, Video, File, StickyNote } from 'lucide-react';
import { Button } from '../../../common/ui/button';
import { Input } from '../../../common/ui/input';
import { Card, CardContent } from '../../../common/ui/card';
import { teacherService } from '../../../common/services/teacherService';
import { SectionHeader, Modal, Label, FormSelect, formatDate } from '../shared';

function today() {
  return new Date().toISOString().split('T')[0];
}

export default function MaterialsPage({ classes, materials: initMaterials }) {
  const [materials, setMaterials] = useState(initMaterials);
  const [showUpload, setShowUpload] = useState(false);
  const [form, setForm] = useState({ title: '', type: 'notes', class: '', url: '', format: 'PDF' });
  const [search, setSearch] = useState('');

  const typeIcon = (type) => {
    if (type === 'video') return <Video className="h-4 w-4 text-violet-500" />;
    if (type === 'notes') return <StickyNote className="h-4 w-4 text-amber-500" />;
    return <File className="h-4 w-4 text-primary" />;
  };

  const filtered = materials.filter((m) =>
    m.title.toLowerCase().includes(search.toLowerCase()) ||
    m.class.toLowerCase().includes(search.toLowerCase())
  );

  const handleUpload = () => {
    const newM = {
      id: 'm-' + Date.now(),
      ...form,
      uploadedAt: today(),
      size: form.type === 'video' ? '—' : '—',
    };
    teacherService.uploadMaterial(newM);
    setMaterials((prev) => [newM, ...prev]);
    setShowUpload(false);
    setForm({ title: '', type: 'notes', class: '', url: '', format: 'PDF' });
  };

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Learning Materials"
        description="Upload notes, documents, and video links for students"
        action={
          <Button onClick={() => setShowUpload(true)}>
            <Upload className="h-3.5 w-3.5 mr-1.5" /> Upload Material
          </Button>
        }
      />

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search materials…"
          className="pl-9 h-9"
        />
      </div>

      {/* Type filter pills */}
      <div className="flex gap-2 flex-wrap">
        {['All', 'Notes', 'Document', 'Video'].map((f) => (
          <button
            key={f}
            className="px-3 py-1.5 rounded-full text-xs font-semibold border border-border bg-surface text-text-secondary hover:border-primary/40 hover:text-text-primary transition-colors"
          >
            {f}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((m) => (
          <Card key={m.id} className="flex flex-col">
            <CardContent className="p-4 flex flex-col gap-3 flex-1">
              <div className="flex items-start gap-3">
                <div className="h-9 w-9 rounded-lg bg-background border border-border flex items-center justify-center flex-shrink-0">
                  {typeIcon(m.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-text-primary leading-snug line-clamp-2">{m.title}</p>
                  <p className="text-xs text-text-muted mt-0.5">{m.class}</p>
                </div>
              </div>
              <div className="flex items-center justify-between mt-auto pt-1 border-t border-border/40">
                <div className="flex items-center gap-2 text-xs text-text-muted">
                  <span className="px-1.5 py-0.5 rounded bg-background border border-border font-mono">{m.format}</span>
                  {m.size !== '—' && <span>{m.size}</span>}
                </div>
                <span className="text-[11px] text-text-muted">{formatDate(m.uploadedAt)}</span>
              </div>
              <div className="flex gap-2">
                {m.type === 'video' ? (
                  <a href={m.url} target="_blank" rel="noopener noreferrer" className="flex-1">
                    <Button variant="outline" size="sm" className="w-full text-xs">
                      <Link2 className="h-3 w-3 mr-1" /> Open Link
                    </Button>
                  </a>
                ) : (
                  <Button variant="outline" size="sm" className="flex-1 text-xs">
                    <Download className="h-3 w-3 mr-1" /> Download
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Modal open={showUpload} onClose={() => setShowUpload(false)} title="Upload Learning Material">
        <div className="space-y-4">
          <div>
            <Label>Title</Label>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Chapter 6 – Polynomials Notes" className="h-9" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Type</Label>
              <FormSelect value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                <option value="notes">Notes</option>
                <option value="document">Document</option>
                <option value="video">Video Link</option>
              </FormSelect>
            </div>
            <div>
              <Label>Class</Label>
              <FormSelect value={form.class} onChange={(e) => setForm({ ...form, class: e.target.value })}>
                <option value="">Select class…</option>
                <option value="All Classes">All Classes</option>
                {classes.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
              </FormSelect>
            </div>
          </div>
          {form.type === 'video' ? (
            <div>
              <Label>Video URL</Label>
              <Input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://…" className="h-9" />
            </div>
          ) : (
            <div>
              <Label>File Format</Label>
              <FormSelect value={form.format} onChange={(e) => setForm({ ...form, format: e.target.value })}>
                {['PDF', 'DOCX', 'PPTX', 'XLSX', 'ZIP'].map((f) => <option key={f} value={f}>{f}</option>)}
              </FormSelect>
              <div className="mt-3 border-2 border-dashed border-border rounded-lg p-6 text-center">
                <Upload className="h-8 w-8 text-text-muted mx-auto mb-2" />
                <p className="text-sm text-text-muted">Drag & drop file or <span className="text-primary font-semibold">browse</span></p>
                <p className="text-xs text-text-muted mt-1">Max file size: 50 MB</p>
              </div>
            </div>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" size="sm" onClick={() => setShowUpload(false)}>Cancel</Button>
            <Button size="sm" onClick={handleUpload} disabled={!form.title || !form.class}>
              <Upload className="h-3.5 w-3.5 mr-1.5" /> Upload
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
