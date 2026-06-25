import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../../../common/services/authService';
import { ROLE_HOME } from '../../../routes/roleMap';
import AuthLayout from '../../../layouts/AuthLayout';
import LoginForm from '../components/LoginForm';

export default function LoginPage() {
  const navigate = useNavigate();

  // Already logged in → redirect to their portal
  useEffect(() => {
    if (authService.isAuthenticated()) {
      const role = authService.getUserRole();
      navigate(ROLE_HOME[role] || '/', { replace: true });
    }
  }, [navigate]);

  const handleLoginSuccess = (user) => {
    const home = ROLE_HOME[user.role] || '/';
    navigate(home, { replace: true });
  };

  return (
    <AuthLayout>
      <LoginForm onLoginSuccess={handleLoginSuccess} />
    </AuthLayout>
  );
}
