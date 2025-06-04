import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import userService from '../services/UserService';

/**
 * Protected route component that checks authentication
 * Redirects to login if not authenticated
 */
const AuthGuard = ({ children }) => {
  const [authState, setAuthState] = useState({
    isAuthenticated: null, // null = loading, true/false = determined
    user: null,
    isLoading: true
  });

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      setAuthState(prev => ({ ...prev, isLoading: true }));

      // Simple auth check - this returns a boolean
      const isAuth = await userService.isAuthenticated();

      let user = null;
      if (isAuth) {
        // Get user info from local cookies if authenticated
        user = userService.getCurrentUser();
      }

      setAuthState({
        isAuthenticated: isAuth,
        user: user,
        isLoading: false
      });

    } catch (error) {
      console.error('Auth check failed:', error);
      setAuthState({
        isAuthenticated: false,
        user: null,
        isLoading: false
      });
    }
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

  // Not authenticated - redirect to login
  if (!authState.isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Authenticated - render children with user context
  return React.cloneElement(children, {
    user: authState.user,
    onAuthError: checkAuth // Allow children to trigger re-auth
  });
};

export default AuthGuard;