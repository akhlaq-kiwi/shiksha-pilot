import React, { useState, useEffect } from 'react';
import { Shield, Key, Phone, AlertCircle, RefreshCw, Eye, EyeOff } from 'lucide-react';
import logoImg from '../../../assets/logo.png';
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

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlErr = params.get('error');
    const sessionErr = sessionStorage.getItem('login_error_message');
    const msg = urlErr || sessionErr;
    if (msg) {
      const decodedMsg = decodeURIComponent(msg);
      // Only show error message if it explicitly pertains to inactive account or specific error
      if (decodedMsg.toLowerCase().includes('inactive') || decodedMsg.toLowerCase().includes('password') || decodedMsg.toLowerCase().includes('blocked')) {
        setErrors({ phone: decodedMsg });
      }
      sessionStorage.removeItem('login_error_message');
    }
  }, []);

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
      const msg = err.message || (err.data && (err.data.message || err.data.phone || err.data.errors?.phone)) || '';
      if (msg.toLowerCase().includes('inactive')) {
        setErrors({ phone: 'Your account marked as Inactive Please contact Academy management' });
      } else if (err.data && err.data.errors) {
        setErrors(err.data.errors);
      } else if (err.data && typeof err.data === 'object') {
        setErrors(err.data);
      } else {
        if (msg.toLowerCase().includes('phone') || msg.toLowerCase().includes('mobile') || msg.toLowerCase().includes('account')) {
          setErrors({ phone: 'No account found with this mobile number.' });
        } else if (msg.toLowerCase().includes('password')) {
          setErrors({ password: 'Incorrect password. Please try again.' });
        } else {
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
          <div className="mx-auto h-[70px] w-auto flex items-center justify-center mb-3">
            <img src={logoImg} alt="Shiksha Pilot Logo" className="h-[70px] w-auto object-contain" />
          </div>
          <CardTitle className="text-xl font-bold font-display">Login Shiksha Pilot</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">

          <form onSubmit={handlePasswordLogin} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="mobile-phone-number" className="text-xs font-bold text-text-secondary uppercase">Mobile Phone Number</label>
              <div className="relative">
                <Phone className="absolute left-3 top-2.5 h-4 w-4 text-text-muted" />
                <Input id="mobile-phone-number"
                  data-testid="login-phone-input"
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
                <p data-testid="login-phone-error" className="text-[11px] font-bold text-red-500 mt-0.5">{errors.phone}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <label htmlFor="password" className="text-xs font-bold text-text-secondary uppercase">Password</label>
              <div className="relative">
                <Key className="absolute left-3 top-2.5 h-4 w-4 text-text-muted" />
                <Input id="password"
                  data-testid="login-password-input"
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
                <p data-testid="login-password-error" className="text-[11px] font-bold text-red-500 mt-0.5">{errors.password}</p>
              )}
            </div>
            <Button type="submit" data-testid="login-submit-button" className="w-full flex justify-center items-center gap-2 py-2.5" disabled={loading}>
              {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : 'Login'}
            </Button>
          </form>

        </CardContent>
      </Card>
    </div>
  );
}
