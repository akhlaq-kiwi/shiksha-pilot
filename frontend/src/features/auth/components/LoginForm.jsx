import React, { useState } from 'react';
import { Mail, Lock, Eye, EyeOff, CheckCircle2, AlertTriangle, RefreshCw, Key, Shield, Sliders, GraduationCap } from 'lucide-react';
import { sha256Sync, decodeJwt } from '../../../common/utils/crypto';

export default function LoginForm({ 
  onLoginSuccess, 
  isSuperAdminLoginPage = false,
  showToast 
}) {
  // Login Form States
  const [loginUser, setLoginUser] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState('');

  // Forgot Password Flow States
  const [forgotPasswordStep, setForgotPasswordStep] = useState(0); // 0: Login, 1: Email, 2: OTP, 3: Reset
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotOtp, setForgotOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [isForgotLoading, setIsForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState('');

  // Handle standard Login Submit
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    setIsLoggingIn(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginUser, password: sha256Sync(loginPass) })
      });
      if (res.ok) {
        const data = await res.json();
        
        let setupVal = data.setup_completed;
        if (setupVal === undefined || setupVal === null) {
          const decoded = decodeJwt(data.access_token);
          if (decoded && decoded.setup_completed !== undefined) {
            setupVal = decoded.setup_completed;
          } else {
            setupVal = 1;
          }
        }
        setupVal = parseInt(setupVal);
        if (isNaN(setupVal)) setupVal = 1;

        const schoolNameVal = data.school_name || (data.access_token ? (decodeJwt(data.access_token)?.school_name) : null) || 'BN School';

        setIsLoggingIn(false);
        showToast('Logged In Successfully', 'success');
        
        // Pass data back up
        onLoginSuccess({
          access_token: data.access_token,
          email: data.email,
          role: data.role,
          school_id: data.school_id || '',
          setup_completed: setupVal,
          school_name: schoolNameVal,
          permissions: data.permissions || [],
          linked_student_ids: data.linked_student_ids || []
        });

      } else {
        if (res.status === 500) {
          throw new Error('Database offline. Triggering mock fallback.');
        }

        const savedUsers = JSON.parse(localStorage.getItem('bn_mock_users') || '[]');
        const matched = savedUsers.find(u => u.email.trim().toLowerCase() === loginUser.trim().toLowerCase() && u.password === sha256Sync(loginPass));
        if (matched) {
          throw new Error('Dynamic mock user fallback.');
        }

        const err = await res.json();
        setLoginError(err.detail || 'Invalid email or password. Please verify your credentials.');
        setIsLoggingIn(false);
      }
    } catch (err) {
      // Offline fallback login credentials
      const savedUsers = JSON.parse(localStorage.getItem('bn_mock_users') || '[]');
      const matched = savedUsers.find(u => u.email.trim().toLowerCase() === loginUser.trim().toLowerCase() && (u.password === sha256Sync(loginPass) || u.password === loginPass));
      
      if (matched) {
        const perms = matched.role === 'Super Admin' || matched.role === 'School Admin' 
          ? ['attendance', 'performance', 'planner', 'finance', 'reports', 'administration']
          : matched.role === 'Parent' ? ['parent_portal'] : ['attendance', 'performance'];

        const fallbackData = {
          access_token: 'mock-token-' + matched.school_id + '-' + btoa(matched.email),
          email: matched.email,
          role: matched.role,
          school_id: matched.school_id,
          setup_completed: matched.setup_completed ?? 1,
          school_name: matched.school_name || 'BN School',
          permissions: perms,
          linked_student_ids: matched.linked_student_ids || []
        };
        
        showToast('Logged In Successfully (Offline Sandbox Mode)', 'success');
        onLoginSuccess(fallbackData);
      } else {
        // Direct default static user fallbacks if offline
        const inputLower = loginUser.trim().toLowerCase();
        if (inputLower === 'bilal@yopmail.com' && loginPass === 'Bilal@123') {
          showToast('Logged In Successfully (Offline Sandbox Mode)', 'success');
          onLoginSuccess({
            access_token: 'mock-super-token',
            email: loginUser,
            role: 'Super Admin',
            permissions: ['attendance', 'performance', 'planner', 'finance', 'reports', 'administration'],
            school_id: '',
            setup_completed: 1,
            school_name: 'BN School'
          });
        } else if (inputLower === 'admin@yopmail.com' && loginPass === 'Admin@123') {
          showToast('Logged In Successfully (Offline Sandbox Mode)', 'success');
          onLoginSuccess({
            access_token: 'mock-token',
            email: loginUser,
            role: 'School Admin',
            permissions: ['attendance', 'performance', 'planner', 'finance', 'reports', 'administration'],
            school_id: 1,
            setup_completed: 1,
            school_name: "St. Xavier's International School"
          });
        } else if (loginUser === '9876543210' && loginPass === 'Test@123') {
          showToast('Logged In Successfully (Offline Sandbox Mode)', 'success');
          onLoginSuccess({
            access_token: 'mock-parent-token',
            email: 'parent@yopmail.com',
            role: 'Parent',
            permissions: ['parent_portal'],
            linked_student_ids: [1, 2],
            school_id: 1,
            setup_completed: 1,
            school_name: "St. Xavier's International School"
          });
        } else {
          setLoginError('Authentication failed. Database offline and no sandbox credentials match.');
        }
      }
      setIsLoggingIn(false);
    }
  };

  // Forgot Password Submit Steps
  const handleForgotPasswordSubmit = async (e) => {
    e.preventDefault();
    setForgotError('');
    setForgotSuccess('');
    setIsForgotLoading(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail })
      });
      const data = await res.json();
      if (res.ok) {
        setForgotSuccess(data.message || 'OTP code has been sent to your registered email address.');
        setForgotPasswordStep(2);
      } else {
        setForgotError(data.detail || 'Failed to send recovery OTP.');
      }
    } catch (err) {
      // Mock recovery OTP
      setForgotSuccess('OTP Code: 1234 (Offline Sandbox Fallback)');
      setForgotPasswordStep(2);
    } finally {
      setIsForgotLoading(false);
    }
  };

  const handleVerifyOtpSubmit = async (e) => {
    e.preventDefault();
    setForgotError('');
    setForgotSuccess('');
    setIsForgotLoading(true);
    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail, otp: forgotOtp })
      });
      const data = await res.json();
      if (res.ok) {
        setForgotSuccess('OTP verified successfully. Create your new password.');
        setForgotPasswordStep(3);
      } else {
        setForgotError(data.detail || 'Invalid or expired OTP.');
      }
    } catch (err) {
      if (forgotOtp === '1234') {
        setForgotSuccess('OTP verified successfully. Create your new password.');
        setForgotPasswordStep(3);
      } else {
        setForgotError('Invalid OTP.');
      }
    } finally {
      setIsForgotLoading(false);
    }
  };

  const handleResetPasswordSubmit = async (e) => {
    e.preventDefault();
    setForgotError('');
    setForgotSuccess('');
    if (newPassword !== confirmNewPassword) {
      setForgotError('Passwords do not match.');
      return;
    }
    setIsForgotLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail, otp: forgotOtp, password: sha256Sync(newPassword) })
      });
      const data = await res.json();
      if (res.ok) {
        showToast('Password reset successfully. You can now login.', 'success');
        setForgotPasswordStep(0);
        setForgotEmail('');
        setForgotOtp('');
        setNewPassword('');
        setConfirmNewPassword('');
      } else {
        setForgotError(data.detail || 'Reset password session failed.');
      }
    } catch (err) {
      // Offline fallback update locally
      const savedUsers = JSON.parse(localStorage.getItem('bn_mock_users') || '[]');
      const updated = savedUsers.map(u => 
        u.email.trim().toLowerCase() === forgotEmail.trim().toLowerCase() 
          ? { ...u, password: sha256Sync(newPassword) } 
          : u
      );
      localStorage.setItem('bn_mock_users', JSON.stringify(updated));
      showToast('Password reset successfully (Offline Sandbox Fallback).', 'success');
      setForgotPasswordStep(0);
      setForgotEmail('');
      setForgotOtp('');
      setNewPassword('');
      setConfirmNewPassword('');
    } finally {
      setIsForgotLoading(false);
    }
  };

  return (
    <div style={{ width: '100%' }}>
      {/* Dynamic Header */}
      <div style={{ textAlign: 'center', marginBottom: '32px' }}>
        <div style={{
          background: forgotPasswordStep > 0
            ? 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-secondary) 100%)'
            : isSuperAdminLoginPage
              ? 'linear-gradient(135deg, var(--color-secondary) 0%, #ec4899 100%)'
              : 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-secondary) 100%)',
          padding: '12px', borderRadius: '14px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px', boxShadow: '0 0 20px rgba(59,130,246,0.3)'
        }}>
          {forgotPasswordStep === 1 && <Key size={36} color="white" />}
          {forgotPasswordStep === 2 && <Shield size={36} color="white" />}
          {forgotPasswordStep === 3 && <Lock size={36} color="white" />}
          {forgotPasswordStep === 0 && (isSuperAdminLoginPage ? <Sliders size={36} color="white" /> : <GraduationCap size={36} color="white" />)}
        </div>
        <h2 style={{ fontSize: '1.6rem', fontWeight: 800 }}>
          {forgotPasswordStep === 1 && 'Forgot Password'}
          {forgotPasswordStep === 2 && 'Verify OTP'}
          {forgotPasswordStep === 3 && 'Reset Password'}
          {forgotPasswordStep === 0 && (isSuperAdminLoginPage ? 'Super Admin Portal' : 'BN College Portal')}
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '4px' }}>
          {forgotPasswordStep === 1 && 'Enter your registered email address.'}
          {forgotPasswordStep === 2 && 'Enter the 4-digit code sent to your email.'}
          {forgotPasswordStep === 3 && 'Enter and confirm your new password.'}
          {forgotPasswordStep === 0 && (isSuperAdminLoginPage ? 'Platform Administration Log-in' : 'Administrative Sign-in Required')}
        </p>
      </div>

      {/* Notifications / Errors */}
      {forgotPasswordStep > 0 && forgotError && (
        <div style={{
          padding: '10px 12px', borderRadius: 'var(--radius-sm)', backgroundColor: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.2)', color: '#f87171', fontSize: '0.8rem', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px'
        }}>
          <AlertTriangle size={14} />
          <span>{forgotError}</span>
        </div>
      )}

      {forgotPasswordStep > 0 && forgotSuccess && (
        <div style={{
          padding: '10px 12px', borderRadius: 'var(--radius-sm)', backgroundColor: 'rgba(16, 185, 129, 0.1)',
          border: '1px solid rgba(16, 185, 129, 0.2)', color: '#34d399', fontSize: '0.8rem', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px'
        }}>
          <CheckCircle2 size={14} />
          <span>{forgotSuccess}</span>
        </div>
      )}

      {forgotPasswordStep === 0 && loginError && (
        <div style={{
          padding: '10px 12px', borderRadius: 'var(--radius-sm)', backgroundColor: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.2)', color: '#f87171', fontSize: '0.8rem', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px'
        }}>
          <AlertTriangle size={14} />
          <span>{loginError}</span>
        </div>
      )}

      {/* Step 0: Login Form */}
      {forgotPasswordStep === 0 && (
        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Mail size={16} style={{ position: 'absolute', left: '14px', color: 'var(--text-muted)' }} />
              <input 
                id="login-email"
                type="text" 
                placeholder="Email Address" 
                value={loginUser}
                onChange={(e) => setLoginUser(e.target.value)}
                className="sp-input"
                style={{ paddingLeft: '40px' }}
                autoComplete="off"
                required
              />
            </div>
          </div>

          <div>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Lock size={16} style={{ position: 'absolute', left: '14px', color: 'var(--text-muted)' }} />
              <input 
                id="login-password"
                type={showPassword ? 'text' : 'password'} 
                placeholder="Password" 
                value={loginPass}
                onChange={(e) => setLoginPass(e.target.value)}
                className="sp-input"
                style={{ paddingLeft: '40px', paddingRight: '40px' }}
                autoComplete="new-password"
                required
              />
              <button
                type="button"
                id="password-visibility-toggle"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute', right: '12px', background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}
              >
                {showPassword ? <Eye size={18} /> : <EyeOff size={18} />}
              </button>
            </div>

            {!isSuperAdminLoginPage && (
              <div style={{ textAlign: 'right', marginTop: '8px' }}>
                <button
                  type="button"
                  onClick={() => {
                    setForgotPasswordStep(1);
                    setForgotError('');
                    setForgotSuccess('');
                    setForgotEmail('');
                    setForgotOtp('');
                  }}
                  style={{ background: 'transparent', border: 'none', color: 'var(--color-primary)', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}
                >
                  Forgot Password?
                </button>
              </div>
            )}
          </div>

          <button 
            id="btn-login-submit" 
            type="submit" 
            className="btn-primary" 
            style={{ width: '100%', justifyContent: 'center', padding: '12px', marginTop: '10px', background: isSuperAdminLoginPage ? 'linear-gradient(135deg, var(--color-secondary) 0%, #ec4899 100%)' : 'var(--color-primary)' }}
            disabled={isLoggingIn}
          >
            {isLoggingIn ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <RefreshCw className="animate-spin" size={18} />
                <span>Signing In...</span>
              </div>
            ) : (
              'Sign In'
            )}
          </button>
        </form>
      )}

      {/* Step 1: Forgot Password (Email submission) */}
      {forgotPasswordStep === 1 && (
        <form onSubmit={handleForgotPasswordSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Mail size={16} style={{ position: 'absolute', left: '14px', color: 'var(--text-muted)' }} />
              <input 
                id="forgot-email"
                type="email" 
                placeholder="Registered Email Address" 
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                className="sp-input"
                style={{ paddingLeft: '40px' }}
                autoComplete="off"
                required
              />
            </div>
          </div>

          <button 
            id="btn-forgot-submit" 
            type="submit" 
            className="btn-primary" 
            style={{ width: '100%', justifyContent: 'center', padding: '12px', marginTop: '10px', background: 'var(--color-primary)' }}
            disabled={isForgotLoading}
          >
            {isForgotLoading ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <RefreshCw className="animate-spin" size={18} />
                <span>Sending OTP...</span>
              </div>
            ) : (
              'Send OTP'
            )}
          </button>

          <div style={{ textAlign: 'center', marginTop: '8px' }}>
            <button
              type="button"
              onClick={() => {
                setForgotPasswordStep(0);
                setForgotError('');
                setForgotSuccess('');
              }}
              style={{ background: 'transparent', border: 'none', color: 'var(--color-primary)', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}
            >
              Back to Login
            </button>
          </div>
        </form>
      )}

      {/* Step 2: OTP Verification */}
      {forgotPasswordStep === 2 && (
        <form onSubmit={handleVerifyOtpSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Lock size={16} style={{ position: 'absolute', left: '14px', color: 'var(--text-muted)' }} />
              <input 
                id="forgot-otp"
                type="text" 
                placeholder="Enter 4-digit OTP" 
                value={forgotOtp}
                onChange={(e) => setForgotOtp(e.target.value)}
                className="sp-input"
                style={{ paddingLeft: '40px' }}
                maxLength={6}
                required
              />
            </div>
          </div>

          <button 
            id="btn-otp-verify-submit" 
            type="submit" 
            className="btn-primary" 
            style={{ width: '100%', justifyContent: 'center', padding: '12px', marginTop: '10px', background: 'var(--color-primary)' }}
            disabled={isForgotLoading}
          >
            {isForgotLoading ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <RefreshCw className="animate-spin" size={18} />
                <span>Verifying...</span>
              </div>
            ) : (
              'Verify OTP'
            )}
          </button>

          <div style={{ textAlign: 'center', marginTop: '8px' }}>
            <button
              type="button"
              onClick={() => {
                setForgotPasswordStep(1);
                setForgotError('');
                setForgotSuccess('');
              }}
              style={{ background: 'transparent', border: 'none', color: 'var(--color-primary)', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}
            >
              Request New OTP
            </button>
          </div>
        </form>
      )}

      {/* Step 3: Reset Password */}
      {forgotPasswordStep === 3 && (
        <form onSubmit={handleResetPasswordSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Lock size={16} style={{ position: 'absolute', left: '14px', color: 'var(--text-muted)' }} />
              <input 
                id="reset-new-password"
                type="password" 
                placeholder="New Password" 
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="sp-input"
                style={{ paddingLeft: '40px' }}
                required
              />
            </div>
          </div>

          <div>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Lock size={16} style={{ position: 'absolute', left: '14px', color: 'var(--text-muted)' }} />
              <input 
                id="reset-confirm-password"
                type="password" 
                placeholder="Confirm New Password" 
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                className="sp-input"
                style={{ paddingLeft: '40px' }}
                required
              />
            </div>
          </div>

          <button 
            id="btn-reset-password-submit" 
            type="submit" 
            className="btn-primary" 
            style={{ width: '100%', justifyContent: 'center', padding: '12px', marginTop: '10px', background: 'var(--color-primary)' }}
            disabled={isForgotLoading}
          >
            {isForgotLoading ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <RefreshCw className="animate-spin" size={18} />
                <span>Resetting...</span>
              </div>
            ) : (
              'Reset Password'
            )}
          </button>
        </form>
      )}
    </div>
  );
}
