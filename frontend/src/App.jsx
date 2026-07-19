import React, { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { authService } from './common/services/authService';
import { ROLE_HOME } from './routes/roleMap';
import { WifiOff } from 'lucide-react';
import { Button } from './common/ui/button';

import AppLayout from './layouts/AppLayout';
import ProtectedRoute from './routes/ProtectedRoute';
import LoginPage from './features/auth/pages/LoginPage';
import SuperAdminPortal from './features/super-admin/SuperAdminPortal';
import SchoolAdminPortal from './features/school-admin/SchoolAdminPortal';
import StudentParentPortal from './features/student-parent/StudentParentPortal';
import TeacherPortal from './features/teacher/TeacherPortal';
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
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      window.location.reload();
    };
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

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
          <ProtectedRoute allowedRoles={['SCHOOL_ADMIN', 'TEACHER']}>
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

      {isOffline && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[9999] p-6 animate-in fade-in duration-300">
          <div className="bg-surface border border-border rounded-2xl w-full max-w-md shadow-2xl p-8 flex flex-col items-center text-center space-y-6">
            <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center text-red-500 animate-bounce">
              <WifiOff className="h-8 w-8" />
            </div>
            <div className="space-y-2">
              <h3 className="font-extrabold text-text-primary text-xl tracking-tight font-display">
                No Internet Connection
              </h3>
              <p className="text-sm text-text-secondary leading-relaxed">
                Please check your internet connection and try again. <br />
                Once your connection is restored, the page will load automatically.
              </p>
            </div>
            <div className="flex gap-4 w-full justify-center pt-2">
              <Button 
                onClick={() => {
                  if (navigator.onLine) {
                    setIsOffline(false);
                    window.location.reload();
                  }
                }}
                className="font-bold flex-1 bg-primary hover:bg-primary/95 text-white"
              >
                Retry
              </Button>
              <Button 
                variant="outline"
                onClick={() => window.location.reload()}
                className="font-bold flex-1 border border-border text-text-primary hover:bg-zinc-100"
              >
                Refresh
              </Button>
            </div>
          </div>
        </div>
      )}
    </AcademicYearProvider>
  );
}
