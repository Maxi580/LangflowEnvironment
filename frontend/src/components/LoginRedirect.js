import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import userService from '../services/UserService';
import LoginPage from '../pages/Login';


const LoginRedirect = () => {
  const [authState, setAuthState] = useState({
    isAuthenticated: null, // null = loading
    isLoading: true
  });

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      setAuthState(prev => ({ ...prev, isLoading: true }));

      const isAuth = await userService.isAuthenticated();

      setAuthState({
        isAuthenticated: isAuth,
        isLoading: false
      });

    } catch (error) {
      console.error('Auth check failed:', error);
      setAuthState({
        isAuthenticated: false,
        isLoading: false
      });
    }
  };

  const handleLoginSuccess = async (userData) => {
    // Force a re-check to ensure we have the latest auth state
    await checkAuth();

    // The Navigate will happen automatically when isAuthenticated becomes true
  };

  // Loading state
  if (authState.isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-sky-500 mx-auto mb-4"></div>
          <p className="text-slate-300">Checking authentication...</p>
        </div>
      </div>
    );
  }

  // Already authenticated - redirect to dashboard
  if (authState.isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  // Not authenticated - show login page
  return <LoginPage onLoginSuccess={handleLoginSuccess} />;
};

export default LoginRedirect;