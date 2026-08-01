import React, { useState } from 'react';
import { Shield, Key, Phone, AlertCircle, RefreshCw, Eye, EyeOff } from 'lucide-react';
import { authService } from '../../../common/services/authService';
import { Button } from '../../../common/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../../common/ui/card';
import { Input } from '../../../common/ui/input';

export default function LoginForm({ onLoginSuccess }) {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const handlePasswordLogin = async (e) => {
    e.preventDefault();
    setErrors({});
    
    let localErrors = {};
    if (!phone) {
      localErrors.phone = 'Mobile phone number is required.';
    }
    if (!password) {
      localErrors.password = 'Password is required.';
    }
    
    if (Object.keys(localErrors).length > 0) {
      setErrors(localErrors);
      return;
    }

    setLoading(true);
    try {
      const data = await authService.login(phone, password);
      onLoginSuccess(data.user);
    } catch (err) {
      if (err.data && err.data.errors) {
        setErrors(err.data.errors);
      } else if (err.data && typeof err.data === 'object') {
        setErrors(err.data);
      } else {
        const msg = err.message || '';
        if (msg.toLowerCase().includes('phone') || msg.toLowerCase().includes('mobile') || msg.toLowerCase().includes('account')) {
          setErrors({ phone: 'No account found with this mobile number.' });
        } else if (msg.toLowerCase().includes('password')) {
          setErrors({ password: 'Incorrect password. Please try again.' });
        } else {
          // Case 3 fallback
          setErrors({
            phone: ' ',
            password: 'Invalid mobile number or password.'
          });
        }
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto py-12 px-4">
      <Card className="border border-border shadow-md bg-surface animate-in fade-in duration-300">
        <CardHeader className="space-y-1 text-center">
          <div className="mx-auto h-12 w-12 bg-zinc-900 text-zinc-50 dark:bg-zinc-50 dark:text-zinc-900 rounded-xl flex items-center justify-center border shadow-xs mb-3">
            <Shield className="h-6 w-6" />
          </div>
          <CardTitle className="text-xl font-bold font-display">Shiksha Pilot Portal Login</CardTitle>
          <CardDescription>Sign in to continue</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">

          <form onSubmit={handlePasswordLogin} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-secondary uppercase">Mobile Phone Number</label>
              <div className="relative">
                <Phone className="absolute left-3 top-2.5 h-4 w-4 text-text-muted" />
                <Input 
                  placeholder="e.g. 9876543210" 
                  className={`pl-9 ${errors?.phone ? 'border-red-500 ring-1 ring-red-500' : ''}`}
                  value={phone}
                  onChange={e => {
                    setPhone(e.target.value);
                    if (errors?.phone) setErrors(prev => ({ ...prev, phone: '' }));
                  }}
                  required
                />
              </div>
              {errors?.phone && errors.phone.trim() !== '' && (
                <p className="text-[11px] font-bold text-red-500 mt-0.5">{errors.phone}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-secondary uppercase">Password</label>
              <div className="relative">
                <Key className="absolute left-3 top-2.5 h-4 w-4 text-text-muted" />
                <Input 
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••" 
                  className={`pl-9 pr-10 ${errors?.password ? 'border-red-500 ring-1 ring-red-500' : ''}`}
                  value={password}
                  onChange={e => {
                    setPassword(e.target.value);
                    if (errors?.password) setErrors(prev => ({ ...prev, password: '' }));
                    if (errors?.phone && errors.phone === ' ') setErrors(prev => ({ ...prev, phone: '' }));
                  }}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-text-muted hover:text-text-primary"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors?.password && (
                <p className="text-[11px] font-bold text-red-500 mt-0.5">{errors.password}</p>
              )}
            </div>
            <Button type="submit" className="w-full flex justify-center items-center gap-2 py-2.5" disabled={loading}>
              {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : 'Login'}
            </Button>
          </form>

        </CardContent>
      </Card>
    </div>
  );
}
