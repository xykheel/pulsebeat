import { lazy, Suspense, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Box, CircularProgress } from '@mui/material';
import Layout from './components/Layout';
import ChangelogModal from './components/ChangelogModal';
import LoginPage from './pages/LoginPage';
import { useAuth } from './contexts/AuthContext';
import { brand } from './theme';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const MonitorDetail = lazy(() => import('./pages/MonitorDetail'));
const NotificationsPage = lazy(() => import('./pages/NotificationsPage'));
const ChangePasswordPage = lazy(() => import('./pages/ChangePasswordPage'));

function Loading() {
  return (
    <Box className="flex min-h-[50vh] items-center justify-center">
      <CircularProgress className="text-pb-primary" />
    </Box>
  );
}

function AuthenticatedRoutes() {
  return (
    <Layout>
      <ChangelogModal />
      <Suspense fallback={<Loading />}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/monitors/:id" element={<MonitorDetail />} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/account/password" element={<ChangePasswordPage />} />
          <Route path="/login" element={<Navigate to="/" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </Layout>
  );
}

export default function App() {
  const { user, ready } = useAuth();

  useEffect(() => {
    document.title = brand.displayName;
  }, []);

  if (!ready) {
    return <Loading />;
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return <AuthenticatedRoutes />;
}
