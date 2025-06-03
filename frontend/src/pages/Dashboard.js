import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import userService from '../services/UserService';
import langflowRedirectService from '../services/LangflowRedirectService';
import fileService from '../services/FileService';
import FlowManagement from '../components/FlowManagement';
import DeleteConfirmation from '../components/DeleteConfirmation';
import ChatManagement from "../components/ChatManagement";
import FileManagement from "../components/FileManagement";

const Dashboard = ({ user }) => {
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedFlow, setSelectedFlow] = useState(null);

  // Add these missing state variables
  const [messages, setMessages] = useState([]);
  const [files, setFiles] = useState([]);

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
      return;
    }

    try {
      setIsDeleting(true);
      const result = await userService.deleteUser(user.userId);

      if (result.success) {
        await userService.logout();
        navigate('/login', { replace: true });
      } else {
      }
    } catch (error) {
    } finally {
      setIsDeleting(false);
      setShowDeleteModal(false);
    }
  };

  const handleFlowSelect = async (flow) => {
    setSelectedFlow(flow);
    // Clear messages when switching flows
    setMessages([]);

    // If a flow is selected, ensure collection exists
    if (flow) {
      try {
        // Create collection if it doesn't exist (this is safe - won't recreate if exists)
        await fileService.createCollection(flow.id);
        console.log(`Collection ready for flow: ${flow.id}`);
      } catch (error) {
        console.error('Error creating collection:', error);
        // Don't block the flow selection, just log the error
      }
    }
  };

  return (
    <div className="h-screen bg-slate-900 flex flex-col overflow-hidden">
      {/* Header - same as before */}
      <header className="bg-slate-800 border-b border-slate-700 px-4 py-3 flex-shrink-0">
        <div className="flex items-center justify-between">
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

          <div className="flex flex-col items-center">
            <h1 className="text-xl font-bold text-white">Agenten Dashboard</h1>
            {user && (
              <span className="text-slate-300 text-sm mt-1">
                Welcome, {user.username}
              </span>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => langflowRedirectService.redirectToLangflow("/flows", true)}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded transition-colors
                        flex items-center space-x-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span>Langflow</span>
            </button>

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

      {/* Main Dashboard Content - uses remaining space */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <div className="container mx-auto px-4 py-6 flex flex-col h-full">
          {/* Flow Management Section - fixed height */}
          <div className="flex-shrink-0 mb-6">
            <FlowManagement
              onFlowSelect={handleFlowSelect}
              selectedFlowId={selectedFlow?.id}
            />
          </div>

          {/* Chat and File Management Section - takes remaining space and matches flow width */}
          <div className="flex-1 flex gap-4 min-h-0">
            {/* Chat Management - takes remaining space after file management */}
            <div className="flex-1">
              <ChatManagement
                selectedFlow={selectedFlow}
                files={files}
                messages={messages}
                setMessages={setMessages}
              />
            </div>

            {/* File Management - fixed width to match flow management alignment */}
            <div className="w-80 flex-shrink-0">
              <FileManagement
                flowId={selectedFlow?.id}
                setMessages={setMessages}
              />
            </div>
          </div>
        </div>
      </main>

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
