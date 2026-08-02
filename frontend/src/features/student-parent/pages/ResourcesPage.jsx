import React from 'react';
import { Download, Play, FileText, Folder, ChevronRight } from 'lucide-react';

const subjectColors = {
  'Mathematics': 'bg-blue-500/10 text-blue-700 dark:text-blue-400',
  'Physics': 'bg-purple-500/10 text-purple-700 dark:text-purple-400',
  'Chemistry': 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
  'English': 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  'History': 'bg-rose-500/10 text-rose-700 dark:text-rose-400',
  'Computer Science': 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-400',
};

const getSubjectColor = (subject) =>
  subjectColors[subject] || 'bg-zinc-100 text-zinc-700 dark:text-zinc-400';

export default function ResourcesPage({ materials }) {
  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <div>
        <h2 className="text-3xl font-bold text-text-primary tracking-tight font-display">Learning Resources</h2>
        <p className="text-text-secondary text-sm mt-1">Notes, video lessons, and study materials from your teachers.</p>
      </div>

      {/* Notes */}
      <div>
        <h3 className="text-base font-bold text-text-primary mb-4">Class Notes</h3>
        <div className="space-y-3">
          {materials.notes.map(note => (
            <div key={note.id} className="flex items-center justify-between p-4 bg-surface border border-border rounded-xl shadow-xs hover:shadow-sm transition-shadow">
              <div className="flex items-center gap-4">
                <div className={`p-2.5 rounded-lg ${getSubjectColor(note.subject)}`}>
                  <FileText className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-bold text-text-primary">{note.title}</p>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded ${getSubjectColor(note.subject)}`}>{note.subject}</span>
                    <span className="text-[11px] text-text-muted">{note.size} · {note.date}</span>
                  </div>
                </div>
              </div>
              <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-xs font-bold text-text-primary transition-colors">
                <Download className="h-3.5 w-3.5" /> Download
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Videos */}
      <div>
        <h3 className="text-base font-bold text-text-primary mb-4">Video Lessons</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {materials.videos.map(vid => (
            <div key={vid.id} className="p-4 bg-surface border border-border rounded-xl shadow-xs hover:shadow-sm transition-shadow flex items-center gap-4">
              <div className="h-16 w-24 rounded-lg bg-zinc-900 dark:bg-zinc-800 flex items-center justify-center flex-shrink-0 relative overflow-hidden">
                <Play className="h-6 w-6 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-text-primary leading-tight">{vid.title}</p>
                <p className={`text-[11px] font-bold mt-1 ${getSubjectColor(vid.subject)} px-2 py-0.5 rounded w-fit`}>{vid.subject}</p>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-[11px] text-text-muted">{vid.duration} · {vid.date}</span>
                  <button className="text-[11px] font-bold text-primary hover:underline flex items-center gap-1">
                    Watch <ChevronRight className="h-3 w-3" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Study Materials */}
      <div>
        <h3 className="text-base font-bold text-text-primary mb-4">Study Materials</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {materials.materials.map(mat => (
            <div key={mat.id} className="flex items-center justify-between p-4 border border-border rounded-xl bg-surface shadow-xs hover:shadow-sm transition-shadow">
              <div className="flex items-center gap-3">
                <Folder className="h-5 w-5 text-text-muted flex-shrink-0" />
                <div>
                  <p className="text-sm font-bold text-text-primary">{mat.title}</p>
                  <p className="text-[11px] text-text-muted">{mat.type} · {mat.size}</p>
                </div>
              </div>
              <button className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-text-muted hover:text-text-primary">
                <Download className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
