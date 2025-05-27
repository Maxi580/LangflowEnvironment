import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import userService from '../services/UserService';
import langflowRedirectService from '../services/LangflowRedirectService';
import FlowManagement from '../components/FlowManagement';
import DeleteConfirmation from '../components/DeleteConfirmation';

const Dashboard = ({ user }) => {
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      await userService.logout();
      navigate('/login', { replace: true });
    } catch (error) {
      navigate('/login', { replace: true });
    } finally {
      setIsLoggingOut(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!user?.userId) {
      alert('User ID not found');
      return;
    }

    try {
      setIsDeleting(true);
      const result = await userService.deleteUser(user.userId);

      if (result.success) {
        await userService.logout();
        alert('Account deleted successfully');
        navigate('/login', { replace: true });
      } else {
        alert(`Failed to delete account: ${result.message}`);
      }
    } catch (error) {
      alert(`Error deleting account: ${error.message}`);
    } finally {
      setIsDeleting(false);
      setShowDeleteModal(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Header with centered title and buttons on sides */}
      <header className="bg-slate-800 border-b border-slate-700 px-4 py-3">
        <div className="flex items-center justify-between">
          {/* Left side - Delete Account Button */}
          <div className="flex items-center">
            <button
              onClick={() => setShowDeleteModal(true)}
              className="px-4 py-2 bg-red-800 hover:bg-red-700 text-red-200 rounded transition-colors
                       flex items-center space-x-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              <span>Delete Account</span>
            </button>
          </div>

          {/* Center - Title and Welcome Message */}
          <div className="flex flex-col items-center">
            <h1 className="text-xl font-bold text-white">Agenten Dashboard</h1>
            {user && (
              <span className="text-slate-300 text-sm mt-1">
                Welcome, {user.username}
              </span>
            )}
          </div>

          {/* Right side - Langflow and Logout Buttons */}
          <div className="flex items-center space-x-2">
            {/* Langflow Button */}
            <button
              onClick={() => langflowRedirectService.redirectToLangflow("/flows")}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded transition-colors
                        flex items-center space-x-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span>Langflow</span>
            </button>

            {/* Logout Button */}
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
        {/* User Info Section */}
        <div className="mb-6 bg-slate-800 rounded-lg p-4">
          <h2 className="text-lg font-semibold text-white mb-2">Account Information</h2>
          {user && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-slate-400">Username:</span>
                <span className="ml-2 text-white">{user.username}</span>
              </div>
              <div>
                <span className="text-slate-400">User ID:</span>
                <span className="ml-2 text-white font-mono text-xs">{user.userId}</span>
              </div>
              {user.tokenExpiry && (
                <div>
                  <span className="text-slate-400">Token expires:</span>
                  <span className="ml-2 text-white text-xs">
                    {new Date(user.tokenExpiry * 1000).toLocaleString()}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Flow Management Section */}
        <FlowManagement />
      </main>

      {/* Delete Confirmation Modal */}
      <DeleteConfirmation
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDeleteUser}
        isLoading={isDeleting}
        username={user?.username}
      />
    </div>
  );
};

export default Dashboard;