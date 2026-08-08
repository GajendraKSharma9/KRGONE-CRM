import React from 'react';
import { UserProfile } from '../types';

interface ProtectedRouteProps {
  user: UserProfile | null;
  loading: boolean;
  children: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ user, loading, children }) => {
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center space-y-3">
          <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm text-slate-500 font-medium">Loading KRGONE Sales Navigator...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    window.location.hash = '#/login';
    return null;
  }

  return <>{children}</>;
};
