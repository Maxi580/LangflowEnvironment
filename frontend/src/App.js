import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import './App.css';
import Dashboard from './pages/dashboard';
import LoginPage from "./pages/login";

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      setIsAuthenticated(true);
    }
  }, []);

  const handleLogin = (credentials) => {
    console.log('Login attempted with:', credentials);
    localStorage.setItem('auth_token', 'demo_token');
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    localStorage.removeItem('auth_token');
    setIsAuthenticated(false);
  };

  return (
    <Router>
      <Routes>
        {/* Root path shows login, redirects to dashboard if authenticated */}
        <Route
          path="/"
          element={
            isAuthenticated ?
            <Navigate to="/dashboard" /> :
            <LoginPage onLogin={handleLogin} />
          }
        />

        {/* Protected dashboard route */}
        <Route
          path="/dashboard"
          element={
            isAuthenticated ?
            <Dashboard onLogout={handleLogout} /> :
            <Navigate to="/" />
          }
        />

        {/* Catch-all route redirects to root */}
        <Route
          path="*"
          element={<Navigate to="/" />}
        />
      </Routes>
    </Router>
  );
}

export default App;