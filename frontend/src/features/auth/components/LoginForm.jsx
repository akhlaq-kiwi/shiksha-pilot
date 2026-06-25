import React, { useState } from 'react';
import { Shield, Key, Phone, AlertCircle, RefreshCw } from 'lucide-react';
import { authService } from '../../../common/services/authService';
import { Button } from '../../../common/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../../common/ui/card';
import { Input } from '../../../common/ui/input';

export default function LoginForm({ onLoginSuccess }) {
  const [step, setStep] = useState('login'); // login, otp-login, forgot, otp-verify, reset-pass
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handlePasswordLogin = async (e) => {
    e.preventDefault();
    if (!phone || !password) return;
    setLoading(true);
    setError('');
    try {
      const data = await authService.login(phone, password);
      onLoginSuccess(data.user);
    } catch (err) {
      setError(err.message || 'Invalid phone or password credentials');
    } finally {
      setLoading(false);
    }
  };

  const handleOtpLogin = async (e) => {
    e.preventDefault();
    if (!phone || !otp) return;
    setLoading(true);
    setError('');
    try {
      const data = await authService.otpLogin(phone, otp);
      onLoginSuccess(data.user);
    } catch (err) {
      setError(err.message || 'Invalid or expired OTP code');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    if (!phone) return;
    setLoading(true);
    setError('');
    try {
      await authService.forgotPassword(phone);
      setSuccessMsg('OTP code sent to your mobile phone number.');
      setStep('otp-verify');
    } catch (err) {
      setError(err.message || 'Forgot password failed');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if (!phone || !otp) return;
    setLoading(true);
    setError('');
    try {
      await authService.verifyOtp(phone, otp);
      setStep('reset-pass');
    } catch (err) {
      setError(err.message || 'OTP verification failed');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!phone || !otp || !newPassword) return;
    setLoading(true);
    setError('');
    try {
      await authService.resetPassword(phone, otp, newPassword);
      setSuccessMsg('Password reset successfully. You can now login.');
      setStep('login');
      setPassword('');
    } catch (err) {
      setError(err.message || 'Reset password failed');
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
          <CardTitle className="text-xl font-bold font-display">BN School Portal Login</CardTitle>
          <CardDescription>Enter credentials to access your isolated workspace</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-600 rounded-md text-xs flex items-center gap-2 font-semibold">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-green-500/10 border border-green-500/20 text-green-600 rounded-md text-xs font-semibold">
              {successMsg}
            </div>
          )}

          {step === 'login' && (
            <form onSubmit={handlePasswordLogin} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-text-secondary uppercase">Mobile Phone Number</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-2.5 h-4 w-4 text-text-muted" />
                  <Input 
                    placeholder="e.g. 9876543210" 
                    className="pl-9"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-text-secondary uppercase">Password</label>
                  <button 
                    type="button" 
                    onClick={() => setStep('forgot')}
                    className="text-xs text-zinc-500 hover:text-zinc-900 hover:underline"
                  >
                    Forgot Password?
                  </button>
                </div>
                <div className="relative">
                  <Key className="absolute left-3 top-2.5 h-4 w-4 text-text-muted" />
                  <Input 
                    type="password"
                    placeholder="••••••••" 
                    className="pl-9"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                  />
                </div>
              </div>
              <Button type="submit" className="w-full flex justify-center items-center gap-2 py-2.5" disabled={loading}>
                {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : 'Login'}
              </Button>
              <div className="text-center pt-2">
                <button 
                  type="button" 
                  onClick={() => setStep('otp-login')} 
                  className="text-xs text-primary font-bold hover:underline"
                >
                  Use Mobile OTP Login instead
                </button>
              </div>
            </form>
          )}

          {step === 'otp-login' && (
            <form onSubmit={handleOtpLogin} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-text-secondary uppercase">Mobile Phone Number</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-2.5 h-4 w-4 text-text-muted" />
                  <Input 
                    placeholder="e.g. 9876543210" 
                    className="pl-9"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-text-secondary uppercase">OTP Code</label>
                <Input 
                  placeholder="e.g. 123456" 
                  value={otp}
                  onChange={e => setOtp(e.target.value)}
                  maxLength={6}
                  required
                />
              </div>
              <Button type="submit" className="w-full flex justify-center items-center gap-2 py-2.5" disabled={loading}>
                {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : 'Login with OTP'}
              </Button>
              <div className="text-center pt-2">
                <button 
                  type="button" 
                  onClick={() => setStep('login')} 
                  className="text-xs text-primary font-bold hover:underline"
                >
                  Use Password Login instead
                </button>
              </div>
            </form>
          )}

          {step === 'forgot' && (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-text-secondary uppercase">Mobile Phone Number</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-2.5 h-4 w-4 text-text-muted" />
                  <Input 
                    placeholder="e.g. 9876543210" 
                    className="pl-9"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    required
                  />
                </div>
              </div>
              <p className="text-xs text-text-secondary">We will send an OTP verification code to reset your account password.</p>
              <Button type="submit" className="w-full flex justify-center items-center gap-2 py-2.5" disabled={loading}>
                {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : 'Send Reset OTP'}
              </Button>
              <Button type="button" variant="outline" className="w-full py-2.5" onClick={() => setStep('login')}>Cancel</Button>
            </form>
          )}

          {step === 'otp-verify' && (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-text-secondary uppercase">Enter 6-Digit OTP</label>
                <Input 
                  placeholder="e.g. 123456" 
                  value={otp}
                  onChange={e => setOtp(e.target.value)}
                  maxLength={6}
                  required
                />
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => setStep('login')} className="flex-1 py-2.5">Back</Button>
                <Button type="submit" className="flex-1 flex justify-center items-center gap-2 py-2.5" disabled={loading}>
                  {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : 'Verify Code'}
                </Button>
              </div>
            </form>
          )}

          {step === 'reset-pass' && (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-text-secondary uppercase">Enter New Password</label>
                <Input 
                  type="password"
                  placeholder="New Password" 
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full flex justify-center items-center gap-2 py-2.5" disabled={loading}>
                {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : 'Update Password'}
              </Button>
            </form>
          )}

        </CardContent>
      </Card>
    </div>
  );
}
