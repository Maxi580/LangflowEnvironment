import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import userService from '../services/UserService';

/**
 * Protected route component that checks authentication
 * Redirects to login if not authenticated
 */
const AuthGuard = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(null); // null = loading
  const [user, setUser] = useState(null);

  useEffect(() => {
    checkAuth();

    // Listen for auth events
    const handleAuthEvent = (event) => {
      if (event.type === 'tokens_updated') {
        checkAuth();
      } else if (event.type === 'tokens_cleared' || event.type === 'refresh_failed') {
        setIsAuthenticated(false);
        setUser(null);
      }
    };

    userService.onAuthEvent(handleAuthEvent);

    return () => {
      userService.offAuthEvent(handleAuthEvent);
    };
  }, []);

  const checkAuth = async () => {
    try {
      const authStatus = await userService.getAuthStatus();
      setIsAuthenticated(authStatus.isAuthenticated);
      setUser(authStatus.user);
    } catch (error) {
      setIsAuthenticated(false);
      setUser(null);
    }
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

  // Not authenticated - redirect to login
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Authenticated - render children with user context
  return React.cloneElement(children, { user });
};

export default AuthGuard;