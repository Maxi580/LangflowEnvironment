import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import './App.css';
import Dashboard from './pages/dashboard';
import LoginPage from "./pages/login";
import ProtectedRoute from './components/ProtectedRoute';
import authService from './services/AuthService';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true); // Add loading state

  // Check authentication status on app load
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const authenticated = await authService.isAuthenticated();
        setIsAuthenticated(authenticated);
      } catch (error) {
        console.error('Authentication check failed:', error);
        setIsAuthenticated(false);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, []);

  const handleLogin = async (loginResult) => {
    console.log('Login successful:', loginResult);

    // The UserService already stored the token in localStorage
    // Now verify the authentication with our AuthService
    try {
      const authenticated = await authService.isAuthenticated();
      if (authenticated) {
        setIsAuthenticated(true);
      } else {
        console.error('Authentication verification failed after login');
        setIsAuthenticated(false);
      }
    } catch (error) {
      console.error('Post-login authentication check failed:', error);
      setIsAuthenticated(false);
    }
  };

  const handleLogout = () => {
    // Clear all auth-related data
    localStorage.removeItem('langflow_access_token');
    localStorage.removeItem('langflow_token_type');
    localStorage.removeItem('langflow_refresh_token');
    localStorage.removeItem('auth_token');
    localStorage.removeItem('current_user');
    localStorage.removeItem('user_id');
    localStorage.removeItem('langflow_flowId');
    localStorage.removeItem('langflow_session_id');

    setIsAuthenticated(false);
  };

  // Show loading spinner while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen w-full bg-slate-900 flex items-center justify-center">
        <div className="flex flex-col items-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-500 mb-4"></div>
          <div className="text-slate-300">Checking authentication...</div>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        {/* Root path shows login, redirects to dashboard if authenticated */}
        <Route
          path="/"
          element={
            isAuthenticated ?
            <Navigate to="/dashboard" replace /> :
            <LoginPage onLogin={handleLogin} />
          }
        />

        {/* Protected dashboard route */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard onLogout={handleLogout} />
            </ProtectedRoute>
          }
        />

        {/* Catch-all route redirects to root */}
        <Route
          path="*"
          element={<Navigate to="/" replace />}
        />
      </Routes>
    </Router>
  );
}

export default App;