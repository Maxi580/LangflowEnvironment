import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import userService from '../services/UserService';
import langflowRedirectService from '../services/LangflowRedirectService'
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
        // First logout the user, then redirect
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

  const redirectToLangflow = (targetPath = "/") => {
    const redirectUrl = `http://localhost:7860${targetPath}`;
    window.location.href = `http://localhost:8000/api/auth/redirect-langflow?redirect_url=${encodeURIComponent(redirectUrl)}`;
  };

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Header with user info, langflow, logout, and delete */}
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

            {/* Delete Account Button */}
            <button
              onClick={() => setShowDeleteModal(true)}
              className="px-3 py-2 bg-red-800 hover:bg-red-700 text-red-200 rounded transition-colors
                       flex items-center space-x-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              <span className="text-sm">Delete</span>
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

      {/* Empty main content - just the header */}
      <main className="container mx-auto px-4 py-6">
        <div className="text-center text-slate-400">
          <p>Dashboard content coming soon...</p>
        </div>
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