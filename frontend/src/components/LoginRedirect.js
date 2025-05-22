import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import userService from '../services/UserService';
import LoginPage from '../pages/Login';

/**
 * Login wrapper that redirects authenticated users to dashboard
 */
const LoginRedirect = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(null); // null = loading

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const isAuth = await userService.isAuthenticated();
      setIsAuthenticated(isAuth);
    } catch (error) {
      setIsAuthenticated(false);
    }
  };

  const handleLoginSuccess = (userData) => {
    // Force a re-check after successful login
    setIsAuthenticated(true);
  };

  // Loading state
  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-sky-500 mx-auto mb-4"></div>
          <p className="text-slate-300">Loading...</p>
        </div>
      </div>
    );
  }

  // Already authenticated - redirect to dashboard
  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  // Not authenticated - show login page
  return <LoginPage onLoginSuccess={handleLoginSuccess} />;
};

export default LoginRedirect;