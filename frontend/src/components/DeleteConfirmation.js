import React from 'react';

const DeleteConfirmationModal = ({ isOpen, onClose, onConfirm, isLoading, username }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-slate-800 rounded-lg p-6 max-w-md w-full mx-4 border border-slate-700">
        <div className="text-center">
          <div className="mb-4">
            <svg className="w-16 h-16 text-red-400 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 18.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
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