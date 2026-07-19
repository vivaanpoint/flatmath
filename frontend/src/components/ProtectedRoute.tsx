import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface ProtectedRouteProps {
  requireHousehold?: boolean;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ requireHousehold = true }) => {
  const { user, householdId, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0f0f12]">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-gray-400 text-sm animate-pulse">Restoring your session...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (requireHousehold && !householdId) {
    return <Navigate to="/households" replace />;
  }

  return <Outlet />;
};
export default ProtectedRoute;
