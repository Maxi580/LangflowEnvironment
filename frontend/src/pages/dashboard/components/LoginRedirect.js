import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import userService from '../../../requests/UserRequests';
import LoginPage from '../../Login';
import config from '../../../config';

const LoginRedirect = () => {
  const [authState, setAuthState] = useState({
    isAuthenticated: null,
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
    await checkAuth();
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

  if (authState.isAuthenticated) {
    return <Navigate to={config.routes.dashboard} replace />;
  }

  return <LoginPage onLoginSuccess={handleLoginSuccess} />;
};

export default LoginRedirect;