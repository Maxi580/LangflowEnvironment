import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import authService from '../services/AuthService';

/**
 * Protected Route component that validates authentication before rendering children
 * Re-validates token on each route access for maximum security
 */
const ProtectedRoute = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(null); // null = loading, true/false = result

  useEffect(() => {
    const validateAuth = async () => {
      try {
        const authenticated = await authService.isAuthenticated();
        setIsAuthenticated(authenticated);
      } catch (error) {
        console.error('Route protection authentication check failed:', error);
        setIsAuthenticated(false);
      }
    };

    validateAuth();
  }, []);

  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen w-full bg-slate-900 flex items-center justify-center">
        <div className="flex flex-col items-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-500 mb-2"></div>
          <div className="text-slate-300 text-sm">Validating access...</div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  // Render protected content
  return children;
};

export default ProtectedRoute;