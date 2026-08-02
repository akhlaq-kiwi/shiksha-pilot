import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { authService } from '../common/services/authService';
import { ROLE_HOME } from './roleMap';

/**
 * Requires the user to be authenticated.
 * If not, redirects to /login (preserving the attempted location).
 * If authenticated but wrong role, redirects to their own home.
 */
export default function ProtectedRoute({ children, allowedRoles }) {
  const location = useLocation();
  const isAuth = authService.isAuthenticated();
  const role   = authService.getUserRole();

  if (!isAuth) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(role)) {
    const home = ROLE_HOME[role] || '/login';
    return <Navigate to={home} replace />;
  }

  return children;
}
