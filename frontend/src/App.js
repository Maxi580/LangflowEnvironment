import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import LoginRedirect from './components/LoginRedirect';
import AuthGuard from './components/AuthGuard';
import './App.css';

class AuthErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Auth Error Boundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-xl text-red-400 mb-4">Authentication Error</h2>
            <p className="text-slate-300 mb-4">Please try refreshing the page</p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-sky-500 text-white rounded hover:bg-sky-600"
            >
              Refresh Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

function App() {
  return (
    <AuthErrorBoundary>
      <Router>
        <Routes>
          {/* Login route - redirects to dashboard if already authenticated */}
          <Route path="/login" element={<LoginRedirect />} />

          {/* Protected dashboard route */}
          <Route
            path="/dashboard"
            element={
              <AuthGuard>
                <Dashboard />
              </AuthGuard>
            }
          />

          {/* Root route - redirect based on auth status */}
          <Route
            path="/"
            element={
              <AuthGuard>
                <Navigate to="/dashboard" replace />
              </AuthGuard>
            }
          />

          {/* Catch all other routes - redirect to login */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </Router>
    </AuthErrorBoundary>
  );
}

export default App;