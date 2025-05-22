import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import LoginRedirect from './components/LoginRedirect';
import AuthGuard from './components/AuthGuard';
import './App.css';

function App() {
  return (
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
  );
}

export default App;