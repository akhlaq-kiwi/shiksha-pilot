import React from 'react';
import { Plus } from 'lucide-react';
import { Button } from '../../../common/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '../../../common/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '../../../common/ui/table';

const STAFF_FOR_PROFILE = [
  { name: 'Dr. Meena Iyer', department: 'Administration' },
  { name: 'Mr. Suresh Kumar', department: 'Mathematics' },
  { name: 'Ms. Divya Rao', department: 'Science' },
  { name: 'Mr. Akhil Singh', department: 'English' },
  { name: 'Ms. Rekha Joshi', department: 'Administration' },
  { name: 'Mr. Vivek Tiwari', department: 'Social Studies' },
];

export default function ProfilePage() {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div>
        <h2 className="text-3xl font-black text-text-primary tracking-tight font-display">School Profile</h2>
        <p className="text-text-secondary text-sm mt-1">Manage your school's identity, contact information, and academic configuration.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-5">
          <Card>
            <CardHeader className="py-4 border-b border-border bg-zinc-50/50 dark:bg-zinc-900/50 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-bold text-text-primary">Basic Information</CardTitle>
              <Button variant="outline" className="text-xs h-8 px-3">Edit Profile</Button>
            </CardHeader>
            <CardContent className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-6">
              {[
                ['School Name', 'Bright Horizon Academy'],
                ['Registration No.', 'SCH-2015-MH-0042'],
                ['Affiliation Board', 'CBSE New Delhi'],
                ['School Type', 'Co-educational'],
                ['Founded Year', '2008'],
                ['Medium of Instruction', 'English'],
                ['Contact Email', 'admin@brighthorizon.edu'],
                ['Contact Phone', '+91 22 4567 8900'],
              ].map(([k, v]) => (
                <div key={k}>
                  <p className="text-[10px] font-black text-text-muted uppercase tracking-wider">{k}</p>
                  <p className="text-sm font-semibold text-text-primary mt-0.5">{v}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="py-4 border-b border-border bg-zinc-50/50 dark:bg-zinc-900/50">
              <CardTitle className="text-sm font-bold text-text-primary">Address & Location</CardTitle>
            </CardHeader>
            <CardContent className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-6">
              {[
                ['Street Address', '14, Prabhadevi Road'],
                ['City', 'Mumbai'],
                ['State', 'Maharashtra'],
                ['PIN Code', '400025'],
              ].map(([k, v]) => (
                <div key={k}>
                  <p className="text-[10px] font-black text-text-muted uppercase tracking-wider">{k}</p>
                  <p className="text-sm font-semibold text-text-primary mt-0.5">{v}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="py-4 border-b border-border bg-zinc-50/50 dark:bg-zinc-900/50">
              <CardTitle className="text-sm font-bold text-text-primary">Departments</CardTitle>
            </CardHeader>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Department</TableHead>
                  <TableHead>Head</TableHead>
                  <TableHead>Staff Count</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {['Mathematics', 'Science', 'English', 'Social Studies', 'Administration'].map(dept => (
                  <TableRow key={dept}>
                    <TableCell className="font-semibold text-text-primary">{dept}</TableCell>
                    <TableCell className="text-text-secondary text-xs">{STAFF_FOR_PROFILE.find(s => s.department === dept)?.name || '—'}</TableCell>
                    <TableCell className="text-text-secondary text-xs">{STAFF_FOR_PROFILE.filter(s => s.department === dept).length}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <CardContent className="p-6 flex flex-col items-center text-center gap-3">
              <div className="w-20 h-20 rounded-2xl bg-zinc-900 dark:bg-zinc-100 text-zinc-50 dark:text-zinc-900 flex items-center justify-center text-2xl font-black">BH</div>
              <div>
                <p className="font-bold text-text-primary">Bright Horizon Academy</p>
                <p className="text-xs text-text-muted mt-0.5">brighthorizon.shikshapilot.com</p>
              </div>
              <Button variant="outline" className="text-xs w-full">Upload Logo</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="py-4 border-b border-border bg-zinc-50/50 dark:bg-zinc-900/50">
              <CardTitle className="text-sm font-bold text-text-primary">Academic Session</CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-3 text-xs">
              {[
                ['Current Year', '2025–2026'],
                ['Current Term', 'Term 1'],
                ['Term Start', '01 June 2026'],
                ['Term End', '31 October 2026'],
                ['Classes Offered', '1 – 12'],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between border-b border-border/60 pb-2 last:border-0 last:pb-0">
                  <span className="text-text-muted font-semibold">{k}</span>
                  <span className="font-bold text-text-primary">{v}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
