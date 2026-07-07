import React, { useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { authService } from './common/services/authService';
import { ROLE_HOME } from './routes/roleMap';

import AppLayout from './layouts/AppLayout';
import ProtectedRoute from './routes/ProtectedRoute';
import LoginPage from './features/auth/pages/LoginPage';
import SuperAdminPortal from './features/super-admin/SuperAdminPortal';
import SchoolAdminPortal from './features/school-admin/SchoolAdminPortal';
import TeacherPortal from './features/teacher/TeacherPortal';
import StudentParentPortal from './features/student-parent/StudentParentPortal';
import { AcademicYearProvider } from './common/contexts/AcademicYearContext';

function RootRedirect() {
  const isAuth = authService.isAuthenticated();
  const role   = authService.getUserRole();
  if (!isAuth) return <Navigate to="/login" replace />;
  return <Navigate to={ROLE_HOME[role] || '/login'} replace />;
}

function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}

export default function App() {
  return (
    <AcademicYearProvider>
      <ScrollToTop />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<RootRedirect />} />

        <Route path="/super-admin/*" element={
          <ProtectedRoute allowedRoles={['SUPER_ADMIN']}>
            <AppLayout><SuperAdminPortal /></AppLayout>
          </ProtectedRoute>
        } />

        <Route path="/school-admin/*" element={
          <ProtectedRoute allowedRoles={['SCHOOL_ADMIN']}>
            <AppLayout><SchoolAdminPortal /></AppLayout>
          </ProtectedRoute>
        } />

        <Route path="/teacher/*" element={
          <ProtectedRoute allowedRoles={['TEACHER']}>
            <AppLayout><TeacherPortal /></AppLayout>
          </ProtectedRoute>
        } />

        <Route path="/student/*" element={
          <ProtectedRoute allowedRoles={['STUDENT']}>
            <AppLayout><StudentParentPortal /></AppLayout>
          </ProtectedRoute>
        } />

        <Route path="/parent/*" element={
          <ProtectedRoute allowedRoles={['PARENT']}>
            <AppLayout><StudentParentPortal /></AppLayout>
          </ProtectedRoute>
        } />

        <Route path="*" element={<RootRedirect />} />
      </Routes>
    </AcademicYearProvider>
  );
}
