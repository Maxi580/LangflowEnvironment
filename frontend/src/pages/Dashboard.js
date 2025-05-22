import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import userService from '../services/UserService';

const Dashboard = ({ user }) => {
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      await userService.logout();
      navigate('/login', { replace: true });
    } catch (error) {
      // Even if logout fails, redirect to login
      navigate('/login', { replace: true });
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Header with user info and logout */}
      <header className="bg-slate-800 border-b border-slate-700 px-4 py-3">
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <h1 className="text-xl font-bold text-white">Agenten Dashboard</h1>
            {user && (
              <span className="text-slate-300 text-sm">
                Welcome, {user.username}
              </span>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50
                        disabled:cursor-not-allowed text-white rounded transition-colors"
            >
              {isLoggingOut ? 'Logging out...' : 'Logout'}
            </button>
          </div>
        </div>
      </header>

      {/* Main Dashboard Content */}
      <main className="container mx-auto px-4 py-6">
        <div className="bg-slate-800 rounded-lg p-6">
          <h2 className="text-2xl font-bold text-white mb-4">Dashboard</h2>

          {user && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="bg-slate-700 p-4 rounded-lg">
                <h3 className="text-lg font-semibold text-white mb-2">User Info</h3>
                <p className="text-slate-300">Username: {user.username}</p>
                <p className="text-slate-300">User ID: {user.userId}</p>
                {user.tokenExpiry && (
                  <p className="text-slate-300">
                    Token expires: {new Date(user.tokenExpiry * 1000).toLocaleString()}
                  </p>
                )}
              </div>

              <div className="bg-slate-700 p-4 rounded-lg">
                <h3 className="text-lg font-semibold text-white mb-2">Quick Actions</h3>
                <div className="space-y-2">
                  <button className="w-full px-3 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded transition-colors">
                    Create Flow
                  </button>
                  <button className="w-full px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded transition-colors">
                    View Analytics
                  </button>
                </div>
              </div>

              <div className="bg-slate-700 p-4 rounded-lg">
                <h3 className="text-lg font-semibold text-white mb-2">Status</h3>
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span className="text-slate-300">Connected</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default Dashboard;