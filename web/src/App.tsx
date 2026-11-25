import { Box, CircularProgress } from '@mui/material';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from './auth/AuthContext';
import { LoginPage } from './pages/LoginPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { SetPasswordPage } from './pages/SetPasswordPage';
import { OrgSelectorPage } from './pages/OrgSelectorPage';
import { Shell } from './components/Shell';
import { DashboardPage } from './pages/DashboardPage';
import { StudentsPage } from './pages/StudentsPage';
import { StudentProfilePage } from './pages/StudentProfilePage';
import { ClassesPage } from './pages/ClassesPage';
import { RolesPage } from './pages/RolesPage';
import { StaffPage } from './pages/StaffPage';
import { SettingsPage } from './pages/SettingsPage';
import { AttendancePage } from './pages/AttendancePage';
import { ComingSoonPage } from './pages/ComingSoonPage';

export function Loading() {
  return (
    <Box sx={{ display: 'grid', placeItems: 'center', minHeight: '50vh' }}>
      <CircularProgress />
    </Box>
  );
}

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, ready } = useAuth();
  const location = useLocation();
  if (!ready) return <Loading />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <>{children}</>;
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/forgot" element={<ForgotPasswordPage />} />
      <Route path="/set-password" element={<SetPasswordPage />} />
      <Route path="/organizations" element={<RequireAuth><OrgSelectorPage /></RequireAuth>} />
      <Route path="/org/:orgId" element={<RequireAuth><Shell /></RequireAuth>}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="students" element={<StudentsPage />} />
        <Route path="students/:studentId" element={<StudentProfilePage />} />
        <Route path="attendance" element={<AttendancePage />} />
        <Route path="classes" element={<ClassesPage />} />
        <Route path="roles" element={<RolesPage />} />
        <Route path="staff" element={<StaffPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="soon/:module" element={<ComingSoonPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/organizations" replace />} />
    </Routes>
  );
}
