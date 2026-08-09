import React, { useEffect, useState } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { UserProfile } from './types';
import { authService } from './services/authService';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Businesses } from './pages/Businesses';
import { Activities } from './pages/Activities';
import { BulkImport } from './pages/BulkImport';
import { Settings } from './pages/Settings';
import { SalesPerformance } from './pages/SalesPerformance';


export default function App() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = authService.onAuthChange((profile) => {
      setUser(profile);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="flex flex-col items-center space-y-3">
          <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-xs text-slate-400 font-medium tracking-wide">Initializing KRGONE Sales Navigator™...</p>
        </div>
      </div>
    );
  }

  return (
    <HashRouter>
      <Routes>
        {/* Public Login Route */}
        <Route 
          path="/login" 
          element={user ? <Navigate to="/dashboard" replace /> : <Login />} 
        />

        {/* Protected Dashboard */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute user={user} loading={loading}>
              <Layout user={user}>
                <Dashboard user={user!} />
              </Layout>
            </ProtectedRoute>
          }
        />

        {/* Protected Businesses */}
        <Route
          path="/businesses"
          element={
            <ProtectedRoute user={user} loading={loading}>
              <Layout user={user}>
                <Businesses user={user!} />
              </Layout>
            </ProtectedRoute>
          }
        />

        {/* Protected Activities */}
        <Route
          path="/activities"
          element={
            <ProtectedRoute user={user} loading={loading}>
              <Layout user={user}>
                <Activities user={user!} />
              </Layout>
            </ProtectedRoute>
          }
        />

        {/* Protected Bulk Import */}
        <Route
          path="/bulk-import"
          element={
            <ProtectedRoute user={user} loading={loading}>
              <Layout user={user}>
                <BulkImport user={user!} />
              </Layout>
            </ProtectedRoute>
          }
        />

        {/* Protected Sales Performance Routes */}
        <Route
          path="/sales-performance"
          element={
            <ProtectedRoute user={user} loading={loading}>
              <Layout user={user}>
                <SalesPerformance user={user!} tab="dashboard" />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/sales-performance/dashboard"
          element={
            <ProtectedRoute user={user} loading={loading}>
              <Layout user={user}>
                <SalesPerformance user={user!} tab="dashboard" />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/sales-performance/target-setting"
          element={
            <ProtectedRoute user={user} loading={loading}>
              <Layout user={user}>
                <SalesPerformance user={user!} tab="target-setting" />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/sales-performance/achievement-entry"
          element={
            <ProtectedRoute user={user} loading={loading}>
              <Layout user={user}>
                <SalesPerformance user={user!} tab="achievement-entry" />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/sales-performance/team-review"
          element={
            <ProtectedRoute user={user} loading={loading}>
              <Layout user={user}>
                <SalesPerformance user={user!} tab="team-review" />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/sales-performance/reports"
          element={
            <ProtectedRoute user={user} loading={loading}>
              <Layout user={user}>
                <SalesPerformance user={user!} tab="reports" />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/sales-performance/settings"
          element={
            <ProtectedRoute user={user} loading={loading}>
              <Layout user={user}>
                <SalesPerformance user={user!} tab="settings" />
              </Layout>
            </ProtectedRoute>
          }
        />

        {/* Protected Settings */}
        <Route
          path="/settings"
          element={
            <ProtectedRoute user={user} loading={loading}>
              <Layout user={user}>
                <Settings user={user!} />
              </Layout>
            </ProtectedRoute>
          }
        />

        {/* Default Fallback Redirect */}
        <Route
          path="*"
          element={<Navigate to={user ? "/dashboard" : "/login"} replace />}
        />
      </Routes>
    </HashRouter>
  );
}
