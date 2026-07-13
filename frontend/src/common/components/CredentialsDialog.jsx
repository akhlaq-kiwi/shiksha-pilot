import React, { useState, useEffect } from 'react';
import { Dialog } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { schoolAdminService } from '../services/schoolAdminService';
import { Copy, Check, Key, RefreshCw, AlertTriangle } from 'lucide-react';

export default function CredentialsDialog({ isOpen, onClose, role, target }) {
  const [loading, setLoading] = useState(false);
  const [credentials, setCredentials] = useState(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const [customPassword, setCustomPassword] = useState('');

  const fetchCredentials = async () => {
    if (!target) return;
    setLoading(true);
    setError('');
    try {
      const response = await schoolAdminService.getCredentials(role, target.id);
      setCredentials(response || null);
    } catch (err) {
      console.error('Error fetching credentials:', err);
      setError('Failed to fetch credentials details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && target) {
      setCredentials(null);
      setCopied(false);
      setError('');
      setCustomPassword('');
      fetchCredentials();
    }
  }, [isOpen, target]);

  const handleUpdatePassword = async () => {
    setLoading(true);
    setError('');
    setCopied(false);
    try {
      const response = await schoolAdminService.generateCredentials(role, target.id, customPassword);
      setCredentials(response || null);
      setCustomPassword('');
    } catch (err) {
      console.error('Error updating credentials:', err);
      const msg = err.message || 'Failed to update credentials.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!credentials?.plain_password) return;
    navigator.clipboard.writeText(credentials.plain_password);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!target) return null;

  const title = `${role === 'TEACHER' ? 'Teacher' : 'Student/Parent'} Credentials`;
  const description = `Manage access credentials for ${target.name}.`;

  const phone = role === 'TEACHER' ? target.phone : target.student_mobile;

  return (
    <Dialog 
      isOpen={isOpen} 
      onClose={onClose}
      title={title}
      description={description}
      className="w-[95vw] md:max-w-md"
    >
      <div className="space-y-6 pt-4">
        {/* Info card */}
        <div className="p-4 bg-zinc-50 dark:bg-zinc-900/50 border border-border rounded-xl">
          <div className="flex flex-col gap-1 text-xs">
            <p className="font-semibold text-text-muted">Registered Name:</p>
            <p className="font-extrabold text-text-primary text-sm">{target.name}</p>
            
            <p className="font-semibold text-text-muted mt-2">Login Mobile Number:</p>
            <p className="font-mono font-bold text-text-primary text-sm">{phone || 'Not Registered'}</p>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-600 rounded-lg text-xs font-semibold">
            {error}
          </div>
        )}

        {loading && (
          <div className="flex flex-col items-center justify-center py-6 gap-2">
            <RefreshCw className="h-6 w-6 text-primary animate-spin" />
            <p className="text-xs text-text-muted font-semibold">Processing request...</p>
          </div>
        )}

        {!loading && (
          <>
            {/* Optional custom manual password entry */}
            <div className="space-y-2 border-t border-border pt-4">
              <label className="text-xs font-bold text-text-muted uppercase tracking-wider">
                Manual Password (Optional)
              </label>
              <Input
                type="text"
                placeholder="Leave blank to generate randomly..."
                value={customPassword}
                onChange={(e) => setCustomPassword(e.target.value)}
                className="w-full font-sans text-sm"
              />
              <p className="text-[10px] text-text-muted leading-tight">
                Must be at least 6 characters. If left empty, a secure password will be generated automatically.
              </p>
            </div>

            {credentials ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-text-muted uppercase tracking-wider">
                    Password
                  </label>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 p-3 bg-zinc-100 dark:bg-zinc-800 border border-border rounded-lg flex items-center justify-between font-mono font-bold text-sm tracking-widest text-text-primary select-all">
                      {credentials.plain_password}
                    </div>
                    <Button 
                      variant="outline" 
                      onClick={handleCopy}
                      className="p-3 flex items-center justify-center"
                      title="Copy Password"
                    >
                      {copied ? (
                        <Check className="h-4 w-4 text-green-600" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>

                <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-500 rounded-lg text-[11px] flex gap-2 items-start font-medium leading-relaxed">
                  <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                  <span>
                    Updating the password will <strong>immediately invalidate</strong> the current session. 
                    The user will be automatically logged out on their mobile device.
                  </span>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-border">
                  <Button variant="secondary" onClick={onClose}>
                    Close
                  </Button>
                  <Button 
                    onClick={handleUpdatePassword}
                    className="flex items-center gap-2"
                  >
                    Update Password
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4 text-center py-4">
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto text-primary">
                  <Key className="h-6 w-6" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-text-primary">No credentials generated</h4>
                  <p className="text-xs text-text-muted mt-1 px-4 leading-relaxed">
                    This account does not have mobile login credentials set up yet. Define a manual password or update to generate.
                  </p>
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t border-border">
                  <Button variant="secondary" onClick={onClose}>
                    Cancel
                  </Button>
                  <Button onClick={handleUpdatePassword} disabled={!phone}>
                    Update Password
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </Dialog>
  );
}
