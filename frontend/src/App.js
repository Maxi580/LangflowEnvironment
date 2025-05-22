import React, { useState, useEffect } from 'react';
import Dashboard from './pages/dashboard';
import LoginPage from './pages/login';
import userService from './services/UserService';
import './App.css';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [authError, setAuthError] = useState(null);

  useEffect(() => {
    checkAuthStatus();
  }, []);

  useEffect(() => {
    const handleAuthEvent = (event) => {
      console.log('🔔 Auth event received:', event.type);

      if (event.type === 'TOKEN_UPDATED') {
        console.log('✅ Token updated, user remains authenticated');
        checkAuthStatus();
      } else if (event.type === 'AUTH_FAILED') {
        console.log('❌ Authentication failed, logging out user');
        handleAuthFailure();
      }
    };

    userService.onAuthEvent(handleAuthEvent);

    return () => {
      userService.offAuthEvent(handleAuthEvent);
    };
  }, []);

  /**
   * Checks current authentication status (update authenticated state)
   */
  const checkAuthStatus = async () => {
    try {
      setIsLoading(true);
      setAuthError(null);

      // Use UserService which internally uses AuthService for accurate validation
      const authStatus = await userService.getAuthStatus();

      if (authStatus.isAuthenticated && authStatus.user) {
        setIsAuthenticated(true);
        setUser(authStatus.user);
        console.log('✅ User authenticated:', authStatus.user.username);

      } else {
        setIsAuthenticated(false);
        setUser(null);
        console.log('❌ User not authenticated');
      }
    } catch (error) {
      console.error('Error checking auth status:', error);
      setAuthError(error.message);
      setIsAuthenticated(false);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Handles user login
   * @param {Object} credentials - Username and password
   */
  const handleLogin = async (credentials) => {
    try {
      setIsLoading(true);
      setAuthError(null);

      console.log('🔐 Attempting login...');

      const loginResult = await userService.login(credentials);

      if (loginResult.success) {
        // Note: We don't need to manually set state here because
        // the TOKEN_UPDATED event will trigger checkAuthStatus()
        // which will update the state and cause the redirect
        console.log('🎉 Login successful for:', loginResult.user.username);
        console.log('⏳ Waiting for auth event to trigger redirect...');
      } else {
        throw new Error('Login failed');
      }
    } catch (error) {
      console.error('Login failed:', error);
      setAuthError(error.message);
      setIsAuthenticated(false);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Handles user logout
   */
  const handleLogout = async () => {
    try {
      console.log('🚪 Logging out...');

      await userService.logout();

      setIsAuthenticated(false);
      setUser(null);
      setAuthError(null);

      console.log('✅ Logout successful');
    } catch (error) {
      console.error('Logout error:', error);
      // Even if logout fails, clear the UI state
      setIsAuthenticated(false);
      setUser(null);
      setAuthError(null);
    }
  };

  /**
   * Handles authentication failure (token expired and couldn't refresh)
   */
  const handleAuthFailure = () => {
    console.log('🚨 Authentication failure - redirecting to login');
    setIsAuthenticated(false);
    setUser(null);
    setAuthError('Your session has expired. Please log in again.');
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-slate-300">Loading...</p>
        </div>
      </div>
    );
  }

  // Authentication required
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-900">
        <LoginPage
          onLogin={handleLogin}
          error={authError}
          isLoading={isLoading}
        />
      </div>
    );
  }

  // Authenticated - show main app
  return (
    <div className="min-h-screen bg-slate-900">
      {/* Header with user info and logout */}
      <header className="bg-slate-800 border-b border-slate-700 px-4 py-3">
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <h1 className="text-xl font-bold text-white">LangFlow Dashboard</h1>
            {user && (
              <span className="text-slate-300 text-sm">
                Welcome, {user.username}
              </span>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Main Dashboard */}
      <main className="container mx-auto px-4 py-6">
        <Dashboard user={user} />
      </main>
    </div>
  );
}

export default App;