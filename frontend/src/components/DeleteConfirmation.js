import React from 'react';

const DeleteConfirmationModal = ({ isOpen, onClose, onConfirm, isLoading, username }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-slate-800 rounded-lg p-6 max-w-md w-full mx-4 border border-slate-700">
        <div className="text-center">
          <div className="mb-4">
            {/* Simplified warning icon with exclamation mark */}
            <div className="w-16 h-16 mx-auto bg-red-100 rounded-full flex items-center justify-center">
              <svg className="w-12 h-12 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 8v4m0 4h.01" />
              </svg>
            </div>
          </div>

          <h3 className="text-xl font-bold text-white mb-2">Delete Account</h3>

          <p className="text-slate-300 mb-6">
            Do you really want to delete your account <strong className="text-white">{username}</strong>?
            <br />
            <span className="text-red-300 text-sm">This action cannot be undone.</span>
          </p>

          <div className="flex space-x-3 justify-center">
            <button
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2 bg-slate-600 hover:bg-slate-500 disabled:opacity-50
                       text-slate-200 rounded transition-colors"
            >
              Cancel
            </button>

            <button
              onClick={onConfirm}
              disabled={isLoading}
              className="px-4 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-50
                       disabled:cursor-not-allowed text-white rounded transition-colors"
            >
              {isLoading ? 'Deleting...' : 'Yes, Delete Account'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DeleteConfirmationModal;